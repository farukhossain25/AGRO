"use client";

import { useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createBrowserClient } from "./supabase/client";

/* ==========================================================================
   lib/use-realtime.ts — subscribe to a table, run a callback on change
   --------------------------------------------------------------------------
   Vercel's serverless functions cannot hold a long-lived connection and are
   frozen between requests, so the old "poll every 20 s" pattern was paying for
   a database round-trip all night and still showing the payment queue up to 20
   seconds late. Supabase Realtime pushes the row instead.

   Three details that matter:

     • The socket is authenticated with the BROWSER Supabase session, so RLS is
       applied per subscriber: a customer subscribing to `payments` only ever
       receives their own rows, an admin receives the queue.

     • Realtime is best-effort. If the socket never connects (blocked network,
       free-tier connection cap, mobile sleeping) we fall back to polling —
       slower, but correct. The caller does not need to know which happened.

     • The callback is held in a ref, so passing an inline arrow function does
       not tear down and rebuild the subscription on every render. Without this
       a busy console re-subscribes dozens of times and can hit the project's
       concurrent-connection limit.

   Migration 0010 adds `payments` and `notifications` to the
   `supabase_realtime` publication with REPLICA IDENTITY FULL.
   ========================================================================== */

type ChangeHandler = (payload: RealtimePayload) => void;

export type RealtimePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

export function useRealtimeTable({
  table,
  onChange,
  /** Realtime needs a session; skip the subscription when signed out. */
  enabled = true,
  /** Fallback interval. `0` disables polling entirely. */
  pollMs = 60_000,
  /** Optional PostgREST filter, e.g. `status=eq.pending`. */
  filter,
}: {
  table: string;
  onChange: ChangeHandler;
  enabled?: boolean;
  pollMs?: number;
  filter?: string;
}) {
  const handlerRef = useRef(onChange);
  handlerRef.current = onChange;

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let unsubscribe: (() => void) | null = null;

    async function connect() {
      let client: SupabaseClient;
      try {
        client = createBrowserClient();
      } catch {
        return; // Supabase not configured — polling below still covers it
      }

      /* Realtime authorises as the signed-in user. A page opened in a fresh
         tab restores the session asynchronously, so wait for it once; without
         this the first subscribe races the session and RLS rejects the rows. */
      const { data } = await client.auth.getSession();
      if (!data.session) {
        client.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_IN" && !disposed) void subscribe();
        });
        return;
      }

      await subscribe();

      async function subscribe() {
        if (disposed) return;

        /* setAuth is only needed when the socket was created before sign-in. */
        const token = (await client.auth.getSession()).data.session?.access_token;
        if (token) client.realtime.setAuth(token).catch(() => null);

        const channel = client
          .channel(`ba:${table}`)
          .on(
            /* The typed overload narrows `table` to a union of known table
               names; this helper is intentionally generic, so the string form
               is used and the payload is narrowed below. */
            "postgres_changes",
            { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
            (payload: {
              eventType: string;
              new: Record<string, unknown>;
              old: Record<string, unknown>;
            }) => {
              handlerRef.current({
                eventType: payload.eventType as RealtimePayload["eventType"],
                table,
                new: payload.new ?? {},
                old: payload.old ?? {},
              });
            }
          )
          .subscribe();

        unsubscribe = () => {
          void client.removeChannel(channel);
        };
      }
    }

    void connect();

    /* Polling fallback. Slower than Realtime, but it keeps a console usable on
       a network that blocks websockets; only runs while the tab is visible. */
    let timer: ReturnType<typeof setInterval> | null = null;
    if (pollMs > 0) {
      timer = setInterval(() => {
        if (document.visibilityState !== "visible") return;
        handlerRef.current({ eventType: "UPDATE", table, new: {}, old: {} });
      }, pollMs);
    }

    return () => {
      disposed = true;
      unsubscribe?.();
      if (timer) clearInterval(timer);
    };
    // `onChange` is deliberately excluded — it lives in a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, enabled, pollMs, filter]);
}
