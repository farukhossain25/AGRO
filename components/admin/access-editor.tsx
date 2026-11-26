"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Loader2,
  Lock,
  RotateCcw,
  Save,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import { useToast } from "@/lib/toast";
import type { Permission } from "@/lib/permissions";

/* ==========================================================================
   components/admin/access-editor.tsx — কে কোন অংশে ঢুকতে পারবে
   --------------------------------------------------------------------------
   The screen the owner asked for: for each of staff and manager, a checkbox
   per permission, laid out by area, saved to `public.role_permissions`
   (migration 30).

   Three things this screen is careful about:

     1. **Admin is not here.** There is no checkbox that can take the owner's
        own panel away. The card says so rather than silently omitting it.
     2. **A tick is compared with the DEFAULT, not just the current value.**
        A permission the role already had shows as "ডিফল্টে আছে"; untick it and
        it becomes an explicit "কাড়া হয়েছে". Saving sends two lists — granted
        and revoked — and the RPC stores only the difference. That is what
        keeps a later release able to add a permission without a data migration.
     3. **Sensitive permissions look different.** Taking `payments.manage` or
        `team.role` away from admin is impossible, but granting them to staff
        is a real decision, so those rows carry a warning tone and their own
        hint.

   The save button is disabled for anyone without `team.role` — and the route
   re-checks it, so hiding is convenience, not the control.
   ========================================================================== */

type CatalogRow = {
  permission: string;
  group_key: string;
  group_bn: string;
  label_bn: string;
  hint_bn: string | null;
  is_sensitive: boolean;
  sort_order: number;
};

type Overrides = Record<string, Record<string, boolean>>;

export function AccessEditor({
  catalog,
  defaults,
  initialOverrides,
  roles,
  canEdit,
}: {
  catalog: CatalogRow[];
  /** role → the code defaults, as delivered by the SQL function. */
  defaults: Record<string, string[]>;
  /** role → { permission → is_granted } — only the differences. */
  initialOverrides: Overrides;
  roles: { role: string; labelBn: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  /* One draft per role so the owner can set up both and save each separately. */
  const [drafts, setDrafts] = useState<Record<string, Set<string>>>(() => {
    const out: Record<string, Set<string>> = {};
    for (const { role } of roles) {
      const held = new Set(defaults[role] ?? []);
      for (const [permission, granted] of Object.entries(initialOverrides[role] ?? {})) {
        if (granted) held.add(permission);
        else held.delete(permission);
      }
      out[role] = held;
    }
    return out;
  });

  const [saved, setSaved] = useState<Record<string, Set<string>>>(() => {
    const out: Record<string, Set<string>> = {};
    for (const { role } of roles) out[role] = new Set(drafts[role] ?? []);
    return out;
  });

  const [busy, setBusy] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; title: string; rows: CatalogRow[] }>();
    for (const row of catalog) {
      const existing = map.get(row.group_key);
      if (existing) existing.rows.push(row);
      else map.set(row.group_key, { key: row.group_key, title: row.group_bn, rows: [row] });
    }
    for (const group of map.values()) {
      group.rows.sort((a, b) => a.sort_order - b.sort_order);
    }
    return [...map.values()];
  }, [catalog]);

  function toggle(role: string, permission: string) {
    setDrafts((prev) => {
      const next = new Set(prev[role] ?? []);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return { ...prev, [role]: next };
    });
  }

  function isDirty(role: string) {
    const draft = drafts[role];
    const base = saved[role];
    if (!draft || !base) return false;
    if (draft.size !== base.size) return true;
    for (const permission of draft) if (!base.has(permission)) return true;
    return false;
  }

  function revert(role: string) {
    setDrafts((prev) => ({ ...prev, [role]: new Set(saved[role] ?? []) }));
  }

  async function save(role: string) {
    const defaultSet = new Set(defaults[role] ?? []);
    const held = drafts[role] ?? new Set<string>();

    /* Send only the DIFFERENCES. A permission already in the default is not
       mentioned; that is what lets a future release add one without a data
       migration. */
    const grants = [...held].filter((permission) => !defaultSet.has(permission));
    const revokes = [...defaultSet].filter((permission) => !held.has(permission));

    setBusy(role);
    try {
      const res = await fetch("/api/foisal/access", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, grants, revokes }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) throw new Error(json.message ?? "সেভ করা যায়নি");

      setSaved((prev) => ({ ...prev, [role]: new Set(held) }));
      toast.success("অ্যাক্সেস সেভ হয়েছে — পরের পেজ লোডেই কার্যকর");
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function reset(role: string) {
    setBusy(role);
    try {
      const res = await fetch(`/api/foisal/access?role=${encodeURIComponent(role)}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        data?: { effective?: string[] };
      };
      if (!res.ok || !json.ok) throw new Error(json.message ?? "রিসেট করা যায়নি");

      const restored = new Set(json.data?.effective ?? defaults[role] ?? []);
      setDrafts((prev) => ({ ...prev, [role]: restored }));
      setSaved((prev) => ({ ...prev, [role]: new Set(restored) }));
      toast.success("ডিফল্টে ফেরানো হয়েছে");
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">প্যানেল অ্যাক্সেস</h1>
        <p className="text-[12px] text-sand-100/45">
          কোন রোল প্যানেলের কোন অংশে ঢুকতে পারবে — সেটা এখান থেকেই ঠিক করুন, কোড ছোঁয়া লাগবে না।
        </p>
      </div>

      <div className="flex gap-2 rounded-xl border border-leaf-600/25 bg-leaf-600/[0.08] px-3 py-2.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf-700" />
        <p className="text-[11.5px] leading-relaxed text-sand-100/70">
          <b className="text-sand-100/90">অ্যাডমিন সব কিছুই পারবেন, সবসময়।</b> এই পাতা থেকে অ্যাডমিনের
          অ্যাক্সেস বদলানো যায় না — একটি ভুল টিকেও যেন আপনাকে নিজের প্যানেলের বাইরে বের করে দিতে না পারে।
          শুধু <b className="text-sand-100/90">স্টাফ</b> আর <b className="text-sand-100/90">ম্যানেজার</b>-এর
          অংশ এখানে।
        </p>
      </div>

      {!canEdit && (
        <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-[11.5px] text-amber-200/90">
            আপনি দেখতে পারছেন, কিন্তু বদলাতে পারবেন না — শুধু অ্যাডমিন এই সেটিং বদলায়।
          </p>
        </div>
      )}

      {roles.map(({ role, labelBn }) => {
        const held = drafts[role] ?? new Set<string>();
        const defaultSet = new Set(defaults[role] ?? []);
        const changedCount = catalog.filter((row) => {
          const inDefault = defaultSet.has(row.permission);
          const inDraft = held.has(row.permission);
          return inDefault !== inDraft;
        }).length;

        return (
          <section key={role} className="card overflow-hidden p-0">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold">{labelBn}</span>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] text-sand-100/60">
                  {held.size}টি অনুমতি
                </span>
                {changedCount > 0 && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10.5px] text-amber-300">
                    ডিফল্ট থেকে {changedCount}টি বদল
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => reset(role)}
                  disabled={!canEdit || !!busy}
                  className="flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 text-[11.5px] font-semibold text-sand-100/60 transition hover:bg-white/10 disabled:opacity-40"
                >
                  <Undo2 className="h-3.5 w-3.5" /> ডিফল্টে ফেরাও
                </button>
                <button
                  type="button"
                  onClick={() => save(role)}
                  disabled={!canEdit || !!busy || !isDirty(role)}
                  className="flex items-center gap-1.5 rounded-full bg-leaf-600 px-3 py-1.5 text-[11.5px] font-semibold text-white transition hover:bg-leaf-700 disabled:opacity-40"
                >
                  {busy === role ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  সেভ
                </button>
              </div>
            </header>

            <div className="divide-y divide-white/[0.05]">
              {groups.map((group) => (
                <div key={group.key} className="px-4 py-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neu-faint">
                    {group.title}
                  </p>
                  <ul className="space-y-1">
                    {group.rows.map((row) => {
                      const on = held.has(row.permission);
                      const inDefault = defaultSet.has(row.permission);
                      const differs = inDefault !== on;

                      return (
                        <li key={row.permission}>
                          <label
                            className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 transition ${
                              canEdit ? "hover:bg-white/[0.04]" : "cursor-default"
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                                on
                                  ? "border-leaf-600 bg-leaf-600 text-white"
                                  : "border-white/20 bg-transparent"
                              }`}
                            >
                              {on && <Check className="h-3 w-3" strokeWidth={3} />}
                            </span>
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={on}
                              disabled={!canEdit}
                              onChange={() => toggle(role, row.permission)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[12.5px] font-medium text-sand-100/85">
                                  {row.label_bn}
                                </span>
                                {row.is_sensitive && (
                                  <span className="flex items-center gap-0.5 rounded-full bg-red-500/12 px-1.5 py-0.5 text-[9.5px] font-semibold text-red-300/90">
                                    <AlertTriangle className="h-2.5 w-2.5" /> সাবধান
                                  </span>
                                )}
                                {differs && (
                                  <span
                                    className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold ${
                                      on
                                        ? "bg-leaf-600/15 text-leaf-700"
                                        : "bg-amber-500/15 text-amber-300"
                                    }`}
                                  >
                                    {on ? "ডিফল্টে ছিল না — দেওয়া হচ্ছে" : "ডিফল্টে ছিল — কাড়া হচ্ছে"}
                                  </span>
                                )}
                              </span>
                              {row.hint_bn && (
                                <span className="mt-0.5 block text-[10.5px] leading-relaxed text-sand-100/40">
                                  {row.hint_bn}
                                </span>
                              )}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            {isDirty(role) && (
              <footer className="flex items-center justify-between gap-2 border-t border-white/[0.06] bg-amber-500/[0.06] px-4 py-2.5">
                <p className="text-[11px] text-amber-200/80">সেভ করা হয়নি — নিচের বোতাম চাপুন</p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => revert(role)}
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-sand-100/60 hover:bg-white/[0.06]"
                  >
                    <RotateCcw className="h-3 w-3" /> বাতিল
                  </button>
                  <button
                    type="button"
                    onClick={() => save(role)}
                    disabled={!canEdit || !!busy}
                    className="rounded-full bg-leaf-600 px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
                  >
                    সেভ করুন
                  </button>
                </div>
              </footer>
            )}
          </section>
        );
      })}

      <p className="text-[11px] leading-relaxed text-sand-100/35">
        একটি টিক বদলালে সেটা <b>সেই রোলের সব সদস্যের</b> জন্য সাথে সাথে প্রযোজ্য হয় — পরেরবার পেজ
        লোড হলে। কোনো রোল এমন একটি পাতা খুলতে চাইলে যেটা তার অনুমতিতে নেই, সে আগের মতোই 404 পাবে।
      </p>
    </div>
  );
}

/** Only used to keep the Permission import meaningful for future rows. */
export type AccessPermission = Permission;
