"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserPlus } from "lucide-react";
import { useToast } from "@/lib/toast";
import { formatDateBn } from "@/lib/format";
import { Spinner } from "@/components/ui";
import { ROLE_DESCRIPTIONS, roleLabelBn } from "@/lib/permissions";
import type { UserRole } from "@/lib/types";

export type TeamRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
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
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", phone: "", role: "staff" as UserRole });

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

  async function patch(row: TeamRow, body: { role?: UserRole; is_active?: boolean }) {
    setBusy(row.id);
    try {
      const res = await fetch("/api/foisal/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: row.id, ...body }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "পরিবর্তন ব্যর্থ");
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...body } : r)));
      toast.success("সংরক্ষিত হয়েছে");
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
        <form onSubmit={invite} className="card space-y-3 p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold">
            <UserPlus className="h-4 w-4 text-leaf-300" /> নতুন সদস্য যোগ করুন
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
                const isSelf = row.id === selfId;
                return (
                  <tr key={row.id} className="align-middle">
                    <td className="px-4 py-3">
                      <p className="font-medium text-sand-50">{row.name ?? "—"}</p>
                      <p className="text-[11px] text-sand-100/40">{row.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {canChangeRole && !isSelf ? (
                        <select
                          value={row.role}
                          disabled={busy === row.id}
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
                          disabled={busy === row.id}
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


