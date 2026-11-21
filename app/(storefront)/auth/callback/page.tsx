"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";

/* ==========================================================================
   /auth/callback — Google (and magic-link) return address
   --------------------------------------------------------------------------
   1. Supabase JS (PKCE) exchanges ?code=… for a session automatically when
      `detectSessionInUrl` is on. We also handle the implicit hash flow that
      older Supabase projects and the Android shell produce.
   2. We POST the access token to /api/auth/supabase/exchange, which mints the
      app's own httpOnly cookie.
   3. Redirect to `next` (the page the user came from) or /account.
   ========================================================================== */

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const next = params.get("next") || "/account";

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      try {
        const client = supabaseBrowser();

        // Implicit flow: tokens arrive in the URL fragment.
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const hashAccess = hash.get("access_token");
        const hashRefresh = hash.get("refresh_token");

        if (hashAccess && hashRefresh) {
          await client.auth.setSession({
            access_token: hashAccess,
            refresh_token: hashRefresh,
          });
          // clean the URL so the token isn't left in history
          window.history.replaceState(null, "", window.location.pathname);
        }

        // PKCE flow: the SDK has been exchanging the code; wait for it briefly.
        let session = (await client.auth.getSession()).data.session;

        if (!session) {
          // Sometimes the exchange finishes a tick later.
          await new Promise((r) => setTimeout(r, 900));
          session = (await client.auth.getSession()).data.session;
        }

        if (!session) {
          throw new Error("সেশন তৈরি হয়নি — আবার লগইন করুন");
        }

        const res = await fetch("/api/auth/supabase/exchange", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accessToken: session.access_token, remember: true }),
        });

        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.ok) {
          throw new Error(json?.message ?? "লগইন সম্পন্ন করা যায়নি");
        }

        if (cancelled) return;

        const isAdmin = json.data?.user?.role === "admin";
        const target = isAdmin ? "/admin" : next;

        router.replace(target);
        router.refresh();
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    }

    finish();
    return () => {
      cancelled = true;
    };
  }, [router, next]);

  if (error) {
    return (
      <div className="card mx-auto max-w-md p-6 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-red-500/15 text-red-300">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <h1 className="mt-3 text-lg font-bold">লগইন সম্পন্ন হয়নি</h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-sand-100/60">{error}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/login" className="btn-primary">
            আবার লগইন করুন
          </Link>
          <Link href="/" className="btn-ghost">
            হোমে ফিরুন
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <Loader2 className="mx-auto h-7 w-7 animate-spin text-leaf-300" />
      <p className="mt-3 text-sm font-semibold">লগইন সম্পন্ন হচ্ছে…</p>
      <p className="mt-1 text-[12px] text-sand-100/50">এক মুহূর্ত অপেক্ষা করুন</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="container-x flex min-h-[70vh] items-center justify-center py-10">
      <Suspense
        fallback={
          <div className="card mx-auto max-w-md p-8 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-leaf-300" />
          </div>
        }
      >
        <CallbackInner />
      </Suspense>
    </div>
  );
}
