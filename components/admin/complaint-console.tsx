"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/toast";
import { formatDateBn, toBn } from "@/lib/format";
import { Spinner } from "@/components/ui";

/* ==========================================================================
   ComplaintConsole — the panel’s complaint console
   --------------------------------------------------------------------------
   Filter by status and by seller, read the thread, reply, and move the ticket
   through Open → In review → Resolved / Rejected. Resolving requires a note
   (which is posted into the thread so the customer sees the outcome).
   ========================================================================== */

export type AdminComplaintRow = {
  id: string;
  ticket_no: string;
  problem_type: string;
  description: string;
  photos: string[] | null;
  preferred_resolution: string;
  status: "open" | "in_review" | "resolved" | "rejected";
  created_at: string;
  seller_id: string | null;
  products: { name_bn: string } | null;
  sellers: { name_bn: string; slug: string } | null;
  order_no?: string | null;
};

const PROBLEM: Record<string, string> = {
  spoiled: "পচা/নষ্ট",
  short_weight: "কম ওজন",
  wrong_item: "ভুল পণ্য",
  late: "দেরি",
  other: "অন্যান্য",
};

const RESOLUTION: Record<string, string> = {
  refund: "টাকা ফেরত",
  replacement: "পণ্য বদল",
  inform: "শুধু জানানো",
  none: "—",
};

const STATUS: Record<string, { bn: string; tone: string }> = {
  open: { bn: "খোলা", tone: "bg-amber-500/15 text-amber-300" },
  in_review: { bn: "পর্যালোচনায়", tone: "bg-sky-500/15 text-sky-300" },
  resolved: { bn: "সমাধান", tone: "bg-leaf-600/20 text-leaf-700" },
  rejected: { bn: "বাতিল", tone: "bg-red-500/15 text-red-300" },
};

export function ComplaintConsole({ initial }: { initial: AdminComplaintRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [status, setStatus] = useState<"all" | AdminComplaintRow["status"]>("open");
  const [seller, setSeller] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState<"refund" | "replacement" | "inform" | "none">("inform");
  const [busy, setBusy] = useState<string | null>(null);

  const sellers = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.seller_id && row.sellers?.name_bn) map.set(row.seller_id, row.sellers.name_bn);
    }
    return Array.from(map.entries());
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (status === "all" || row.status === status) &&
          (seller === "all" || row.seller_id === seller)
      ),
    [rows, status, seller]
  );

  const counts = useMemo(
    () => ({
      open: rows.filter((r) => r.status === "open").length,
      in_review: rows.filter((r) => r.status === "in_review").length,
      resolved: rows.filter((r) => r.status === "resolved").length,
      rejected: rows.filter((r) => r.status === "rejected").length,
    }),
    [rows]
  );

  async function act(id: string, next: AdminComplaintRow["status"]) {
    setBusy(id);
    try {
      const res = await fetch(`/api/foisal/complaints/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: next,
          note: note.trim() || undefined,
          resolution: next === "resolved" ? resolution : undefined,
        }),
      });

      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok) throw new Error(json.message ?? "আপডেট ব্যর্থ");

      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)));
      setNote("");
      toast.success("অভিযোগ আপডেট হয়েছে");
      router.refresh();
    } catch (err) {
      toast.error("ব্যর্থ", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[20px] font-bold text-sand-50">অভিযোগ</h1>
          <p className="mt-0.5 text-[12px] text-sand-100/50">
            খোলা {toBn(counts.open)} · পর্যালোচনায় {toBn(counts.in_review)} · সমাধান{" "}
            {toBn(counts.resolved)} · বাতিল {toBn(counts.rejected)}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {(["open", "in_review", "resolved", "rejected", "all"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatus(key)}
            aria-pressed={status === key}
            className={`badge h-9 px-3 text-[11.5px] transition ${
              status === key
                ? "bg-leaf-600/20 text-leaf-100 ring-1 ring-leaf-400/30"
                : "bg-white/[0.05] text-sand-100/55 hover:bg-white/[0.09]"
            }`}
          >
            {key === "all" ? "সব" : STATUS[key].bn}
          </button>
        ))}

        {sellers.length ? (
          <select
            value={seller}
            onChange={(e) => setSeller(e.target.value)}
            aria-label="সেলার অনুযায়ী ফিল্টার"
            className="input ml-auto h-9 w-auto min-w-[150px] py-0 text-[16px] sm:text-[12px]"
          >
            <option value="all">সব সেলার</option>
            {sellers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="card p-6 text-center text-[13px] text-sand-100/45">
          এই ফিল্টারে কোনো অভিযোগ নেই।
        </p>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((row) => {
            const meta = STATUS[row.status];
            const expanded = openId === row.id;

            return (
              <li key={row.id} className="card p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[11.5px] font-bold text-leaf-200">
                      #{row.ticket_no}
                    </p>
                    <p className="mt-0.5 truncate text-[13.5px] font-semibold text-sand-50">
                      {row.products?.name_bn ?? "পণ্য"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-sand-100/45">
                      {PROBLEM[row.problem_type] ?? row.problem_type}
                      {row.sellers?.name_bn ? ` · ${row.sellers.name_bn}` : ""}
                      {row.order_no ? ` · ${row.order_no}` : ""}
                      {" · "}
                      {formatDateBn(row.created_at)}
                    </p>
                  </div>
                  <span className={`badge ${meta.tone}`}>{meta.bn}</span>
                </div>

                <p className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-sand-100/65">
                  {row.description}
                </p>

                <p className="mt-1.5 text-[11px] text-sand-100/40">
                  চাওয়া হয়েছে: {RESOLUTION[row.preferred_resolution] ?? row.preferred_resolution}
                </p>

                {row.photos?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {row.photos.map((src) => (
                      <a key={src} href={src} target="_blank" rel="noreferrer">
                        <Image
                          src={src}
                          alt="অভিযোগের ছবি"
                          width={56}
                          height={56}
                          unoptimized
                          className="h-14 w-14 rounded-lg object-cover"
                        />
                      </a>
                    ))}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => setOpenId(expanded ? null : row.id)}
                  className="btn-ghost btn-sm mt-2.5 min-h-[44px]"
                >
                  {expanded ? "বন্ধ করুন" : "ব্যবস্থা নিন"}
                </button>

                {expanded ? (
                  <div className="neu-inset-sm mt-2.5 space-y-2 rounded-xl p-3">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      placeholder="গ্রাহককে যা জানাতে চান… (সমাধান/বাতিলের জন্য আবশ্যক)"
                      className="input text-[16px] sm:text-[13px]"
                    />

                    <div className="flex flex-wrap gap-1.5">
                      {(["refund", "replacement", "inform", "none"] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setResolution(r)}
                          aria-pressed={resolution === r}
                          className={`badge h-9 px-2.5 text-[11px] ${
                            resolution === r
                              ? "bg-leaf-600/20 text-leaf-100 ring-1 ring-leaf-400/30"
                              : "bg-white/[0.05] text-sand-100/55"
                          }`}
                        >
                          {RESOLUTION[r]}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => void act(row.id, "in_review")}
                        disabled={busy === row.id || row.status === "in_review"}
                        className="btn-ghost btn-sm min-h-[44px]"
                      >
                        {busy === row.id ? <Spinner /> : null} পর্যালোচনায়
                      </button>
                      <button
                        type="button"
                        onClick={() => void act(row.id, "resolved")}
                        disabled={busy === row.id || !note.trim()}
                        className="btn-primary btn-sm min-h-[44px]"
                      >
                        সমাধান করুন
                      </button>
                      <button
                        type="button"
                        onClick={() => void act(row.id, "rejected")}
                        disabled={busy === row.id || !note.trim()}
                        className="btn-ghost btn-sm min-h-[44px] text-red-300"
                      >
                        বাতিল
                      </button>
                    </div>

                    <a
                      href={`/account/complaints/${row.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-[11px] text-sand-100/40 underline hover:text-leaf-200"
                    >
                      গ্রাহকের দৃষ্টিতে থ্রেড দেখুন →
                    </a>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
