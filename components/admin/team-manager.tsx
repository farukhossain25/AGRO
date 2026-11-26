"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ShieldCheck, UserPlus, UserRoundCheck } from "lucide-react";
import { useToast } from "@/lib/toast";
import { formatDateBn } from "@/lib/format";
import { Spinner } from "@/components/ui";
import { ROLE_DESCRIPTIONS, roleLabelBn } from "@/lib/permissions";
import type { UserRole } from "@/lib/types";

/**
 * One row from v_team_members.
 *
 * The column names here MUST match the view, not what the screen would like
 * them to be called. They did not: the view returns `member_id` and
 * `full_name`, the table read `id` and `name`, so every row arrived with
 * `id === undefined`. The role dropdown then PATCHed `{ userId: undefined }`,
 * Zod rejected it (400) and the toast said "সংরক্ষণ হয়নি" — while the screen
 * itself showed the old role, because nothing had been saved. Fixing the names
 * is what makes "save" work; no server change was needed.
 */
export type TeamRow = {
  member_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};

/** One row from /api/foisal/team/lookup — an existing account to promote. */
export type LookupRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  is_active: boolean | null;
  created_at: string | null;
  can_manage: boolean;
};

/**
 * Team screen (section F). Two actions, both re-checked on the server:
 *   • invite — needs team.invite (admin only)
 *   • change role / suspend — needs team.role, and nobody can act on a peer
 *     at their own rank or above, or on themselves.
 */
export function TeamManager({
  initial,
  selfId,
  canInvite,
  canChangeRole,
  dbReady,
}: {
  initial: TeamRow[];
  selfId: string;
  canInvite: boolean;
  canChangeRole: boolean;
  dbReady: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  /* Inline rename: the name is what a customer sees in live chat, so the owner
     needs to fix it without leaving this screen. */
  const [renaming, setRenaming] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", phone: "", role: "staff" as UserRole });

  /* ── find an EXISTING account ───────────────────────────────────────────
     The owner already has the person in the panel; making him send an email
     invite to his own staff was busywork. `mode` switches the card between
     "search an account that exists" and "invite someone new". */
  const [mode, setMode] = useState<"existing" | "invite">("existing");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LookupRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function findExisting(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      toast.error("অন্তত ২ অক্ষর লিখুন", "নাম, মোবাইল বা ইমেইলের অংশ লিখুন");
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/foisal/team/lookup?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "খোঁজা যায়নি");
      setResults((json.data?.rows ?? []) as LookupRow[]);
      setSearched(true);
    } catch (error) {
      toast.error("খোঁজা হয়নি", (error as Error).message);
    } finally {
      setSearching(false);
    }
  }

  /**
   * Promote an existing account. Reuses the SAME PATCH the table uses, so the
   * one-place rule (cannot act on a peer or above, cannot touch yourself) is
   * enforced by the server, not by this component.
   */
  async function promote(row: LookupRow, role: UserRole) {
    setPromoting(row.id);
    try {
      const res = await fetch("/api/foisal/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: row.id, role }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "রোল দেওয়া যায়নি");
      setResults((prev) => prev.map((r) => (r.id === row.id ? { ...r, role } : r)));
      toast.success(
        `${row.full_name ?? row.email} এখন ${roleLabelBn(role)}`,
        "প্যানেলে ঢোকার পর এই রোলটাই কাজ করবে"
      );
      // the team table must show the new member immediately, no reload
      setRows((prev) =>
        prev.some((r) => r.member_id === row.id)
          ? prev.map((r) => (r.member_id === row.id ? { ...r, role } : r))
          : [
              {
                member_id: row.id,
                full_name: row.full_name,
                email: row.email,
                phone: row.phone,
                role,
                is_active: row.is_active ?? true,
                created_at: row.created_at ?? new Date().toISOString(),
              },
              ...prev,
            ]
      );
      router.refresh();
    } catch (error) {
      toast.error("রোল দেওয়া হয়নি", (error as Error).message);
    } finally {
      setPromoting(null);
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    try {
      const res = await fetch("/api/foisal/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "ইনভাইট ব্যর্থ");
      toast.success("ইনভাইট পাঠানো হয়েছে", "সদস্য ইমেইলের লিংক থেকে পাসওয়ার্ড সেট করবেন");
      setForm({ email: "", full_name: "", phone: "", role: "staff" });
      router.refresh();
    } catch (error) {
      toast.error("ইনভাইট হয়নি", (error as Error).message);
    } finally {
      setInviting(false);
    }
  }

  async function patch(row: TeamRow, body: { role?: UserRole; is_active?: boolean; full_name?: string }) {
    setBusy(row.member_id);
    try {
      const res = await fetch("/api/foisal/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: row.member_id, ...body }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "পরিবর্তন ব্যর্থ");
      setRows((prev) => prev.map((r) => (r.member_id === row.member_id ? { ...r, ...body } : r)));
      setRenaming(null);
      /* The role also lives on the server (it is what the panel guard reads),
         so refetch instead of trusting the local copy. Without this a page
         reload still showed the old role even when the save had worked. */
      router.refresh();
      toast.success("সংরক্ষিত হয়েছে", "সদস্যকে জানিয়ে দেওয়া হয়েছে — পরের রিলোডেই নতুন রোল");
    } catch (error) {
      toast.error("সংরক্ষণ হয়নি", (error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const field =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13px] text-sand-50 placeholder:text-sand-100/30 focus:border-leaf-500/60 focus:outline-none";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">টিম ও রোল</h1>
        <p className="text-[12px] text-sand-100/45">
          স্টাফ, ম্যানেজার ও অ্যাডমিন — প্রত্যেকে শুধু নিজের অনুমতির অংশটুকুই দেখেন
        </p>
      </div>

      {!dbReady && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-200/90">
          ডেটাবেসে সংযোগ নেই — টিম লিস্ট দেখানো যাচ্ছে না।
        </p>
      )}

      {canInvite && (
        <div className="card space-y-3 p-4">
          {/* Two doors, and the first one is the one the owner asked for:
              pick a person who ALREADY has an account. */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                mode === "existing" ? "bg-leaf-600 text-white" : "bg-white/[0.05] text-sand-100/60 hover:bg-white/10"
              }`}
            >
              <UserRoundCheck className="h-3.5 w-3.5" /> বিদ্যমান ব্যবহারকারী
            </button>
            <button
              type="button"
              onClick={() => setMode("invite")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                mode === "invite" ? "bg-leaf-600 text-white" : "bg-white/[0.05] text-sand-100/60 hover:bg-white/10"
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" /> ইমেইলে ইনভাইট
            </button>
          </div>

          {mode === "existing" ? (
            <div className="space-y-2.5">
              <form onSubmit={findExisting} className="flex flex-wrap gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/35" />
                  <input
                    className={`${field} !pl-9`}
                    placeholder="নাম, মোবাইল নম্বর বা ইমেইল লিখুন"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="btn-primary min-h-[44px] shrink-0 rounded-xl px-4 text-[13px] font-semibold"
                >
                  {searching ? <Spinner className="h-4 w-4" /> : "খুঁজুন"}
                </button>
              </form>
              <p className="text-[11.5px] leading-relaxed text-sand-100/45">
                যিনি আগে থেকেই কাস্টমার হিসেবে আছেন — তাঁকে খুঁজে সরাসরি স্টাফ/ম্যানেজার/অ্যাডমিন
                বানাতে পারবেন। ইমেইল ইনভাইট লাগবে না, উনি আগের পাসওয়ার্ড দিয়েই প্যানেলে ঢুকবেন।
              </p>

              {results.length ? (
                <ul className="divide-y divide-white/[0.05] rounded-xl border border-white/[0.06]">
                  {results.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium text-sand-50">
                          {r.full_name ?? "নাম নেই"}
                          <span className="ml-2 rounded-full bg-leaf-600/15 px-1.5 py-0.5 text-[10px] font-semibold text-leaf-700">
                            {roleLabelBn(r.role as UserRole)}
                          </span>
                        </p>
                        <p className="truncate text-[11px] text-sand-100/40">
                          {[r.phone, r.email].filter(Boolean).join(" · ") || "ফোন/ইমেইল নেই"}
                        </p>
                      </div>

                      {r.can_manage ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <select
                            value={r.role}
                            disabled={promoting === r.id}
                            onChange={(e) => void promote(r, e.target.value as UserRole)}
                            className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11.5px] text-sand-50"
                          >
                            <option value="customer" className="bg-neu-raised text-neu-ink">
                              কাস্টমার (প্যানেল বন্ধ)
                            </option>
                            {ROLE_DESCRIPTIONS.map((d) => (
                              <option key={d.role} value={d.role} className="bg-neu-raised text-neu-ink">
                                {d.label}
                              </option>
                            ))}
                          </select>
                          {promoting === r.id ? <Spinner className="h-3.5 w-3.5" /> : null}
                        </div>
                      ) : (
                        <span className="shrink-0 text-[10.5px] text-sand-100/35">
                          এই অ্যাকাউন্টে আপনার অনুমতি নেই
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : searched && !searching ? (
                <p className="rounded-xl border border-white/[0.06] px-3 py-2.5 text-[12px] text-sand-100/45">
                  এই নামে কেউ পাওয়া যায়নি। নামের বানান বা মোবাইল নম্বর দিয়ে আবার চেষ্টা করুন —
                  অথবা পাশের ট্যাব থেকে ইমেইল ইনভাইট পাঠান।
                </p>
              ) : null}
            </div>
          ) : (
        <form onSubmit={invite} className="space-y-3">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold">
            <UserPlus className="h-4 w-4 text-leaf-300" /> নতুন সদস্য ইনভাইট করুন
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className={field}
              type="email"
              required
              placeholder="ইমেইল"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              className={field}
              required
              placeholder="পুরো নাম"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
            <input
              className={field}
              inputMode="tel"
              placeholder="মোবাইল (ঐচ্ছিক)"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <select
              className={field}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
            >
              {ROLE_DESCRIPTIONS.map((r) => (
                <option key={r.role} value={r.role} className="bg-neu-raised text-neu-ink">
                  {r.label} — {r.hint}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={inviting} className="btn-primary min-h-[44px] rounded-xl px-4 text-[13px] font-semibold">
            {inviting ? <Spinner className="h-4 w-4" /> : "ইনভাইট পাঠান"}
          </button>
        </form>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-[12.5px]">
            <thead className="border-b border-white/[0.06] text-[10.5px] uppercase tracking-wider text-sand-100/35">
              <tr>
                <th className="px-4 py-2.5">সদস্য</th>
                <th className="px-4 py-2.5">রোল</th>
                <th className="px-4 py-2.5">যোগদান</th>
                <th className="px-4 py-2.5">স্টেটাস</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {rows.map((row) => {
                const isSelf = row.member_id === selfId;
                return (
                  <tr key={row.member_id} className="align-middle">
                    <td className="px-4 py-3">
                      {canChangeRole && renaming === row.member_id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void patch(row, { full_name: nameDraft.trim() });
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <input
                            autoFocus
                            value={nameDraft}
                            onChange={(e) => setNameDraft(e.target.value)}
                            maxLength={80}
                            className="w-36 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[12px]"
                            placeholder="পুরো নাম"
                          />
                          <button
                            type="submit"
                            disabled={busy === row.member_id || nameDraft.trim().length < 2}
                            className="rounded-lg bg-leaf-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
                          >
                            সেভ
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenaming(null)}
                            className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-sand-100/60"
                          >
                            বাতিল
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          disabled={!canChangeRole}
                          onClick={() => {
                            setRenaming(row.member_id);
                            setNameDraft(row.full_name ?? "");
                          }}
                          title={canChangeRole ? "নাম বদলান — লাইভ চ্যাটে গ্রাহক এই নামটাই দেখে" : undefined}
                          className="text-left"
                        >
                          <span className="font-medium text-sand-50 underline-offset-2 hover:underline">
                            {row.full_name ?? "নাম দেওয়া হয়নি — ক্লিক করে দিন"}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-sand-100/40">{row.email}</span>
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canChangeRole && !isSelf ? (
                        <select
                          value={row.role}
                          disabled={busy === row.member_id}
                          onChange={(e) => patch(row, { role: e.target.value as UserRole })}
                          className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[12px]"
                        >
                          {ROLE_DESCRIPTIONS.map((r) => (
                            <option key={r.role} value={r.role} className="bg-neu-raised text-neu-ink">
                              {r.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-leaf-600/15 px-2 py-0.5 text-[11px] font-medium text-leaf-700">
                          <ShieldCheck className="h-3 w-3" /> {roleLabelBn(row.role)}
                          {isSelf && <span className="text-sand-100/40">(আপনি)</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sand-100/50">{formatDateBn(row.created_at)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          row.is_active ? "bg-leaf-600/15 text-leaf-700" : "bg-red-500/15 text-red-300"
                        }`}
                      >
                        {row.is_active ? "সক্রিয়" : "স্থগিত"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canChangeRole && !isSelf && (
                        <button
                          type="button"
                          disabled={busy === row.member_id}
                          onClick={() => patch(row, { is_active: !row.is_active })}
                          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11.5px] text-sand-100/70 transition hover:bg-white/5"
                        >
                          {row.is_active ? "স্থগিত করুন" : "সক্রিয় করুন"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[12px] text-sand-100/40">
                    এখনো কোনো টিম সদস্য নেই
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-4">
        <p className="mb-2 text-[12.5px] font-semibold">রোল কী কী করতে পারে</p>
        <ul className="space-y-1.5">
          {ROLE_DESCRIPTIONS.map((r) => (
            <li key={r.role} className="text-[12px] text-sand-100/60">
              <span className="font-medium text-sand-100/85">{r.label}</span> — {r.hint}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}


