import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/api";
import {
  getComplaint,
  problemTypeLabelBn,
  resolutionLabelBn,
  complaintStatusLabelBn,
} from "@/lib/reviews";
import { formatDateTimeBn } from "@/lib/format";
import { Badge } from "@/components/ui";
import { ComplaintThread } from "@/components/shop/complaint-thread";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "অভিযোগের বিস্তারিত",
  robots: { index: false, follow: false },
};

type Ctx = { params: Promise<{ id: string }> };

const STEPS = [
  { key: "open", bn: "খোলা" },
  { key: "in_review", bn: "পর্যালোচনায়" },
  { key: "resolved", bn: "সমাধান" },
];

export default async function ComplaintDetailPage({ params }: Ctx) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) notFound();

  const result = await getComplaint(id);
  if (!result) notFound();

  const { complaint, messages } = result;
  if (complaint.user_id !== user.id && user.role !== "admin") notFound();

  const status = complaintStatusLabelBn(complaint.status);
  const closed = complaint.status === "resolved" || complaint.status === "rejected";
  const stepIndex =
    complaint.status === "resolved" || complaint.status === "rejected"
      ? 2
      : complaint.status === "in_review"
        ? 1
        : 0;

  return (
    <div className="space-y-4">
      <nav aria-label="ব্রেডক্রাম্ব" className="text-[11.5px] text-sand-100/40">
        <Link href="/account/complaints" className="hover:text-leaf-200">
          অভিযোগ
        </Link>
        <span className="mx-1.5">/</span>
        <span className="font-mono text-sand-100/60">#{complaint.ticket_no}</span>
      </nav>

      <header className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-mono text-[12.5px] font-bold text-leaf-200">
              টিকিট #{complaint.ticket_no}
            </p>
            <h2 className="mt-0.5 text-[17px] font-bold text-sand-50">
              {problemTypeLabelBn(complaint.problem_type)}
            </h2>
            <p className="mt-0.5 text-[11px] text-sand-100/45">
              {formatDateTimeBn(complaint.created_at)}
            </p>
          </div>
          <Badge tone={status.tone}>{status.bn}</Badge>
        </div>

        {/* progress */}
        {complaint.status === "rejected" ? (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[11.5px] text-red-200">
            এই অভিযোগটি বাতিল করা হয়েছে। বিস্তারিত নিচের বার্তায় দেখুন।
          </p>
        ) : (
          <ol className="mt-3 flex items-center gap-1.5" aria-label="অভিযোগের অগ্রগতি">
            {STEPS.map((step, i) => {
              const reached = i <= stepIndex;
              return (
                <li key={step.key} className="flex flex-1 items-center gap-1.5">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      reached ? "bg-leaf-600 text-white" : "bg-white/[0.07] text-sand-100/40"
                    }`}
                  >
                    {reached ? "✓" : i + 1}
                  </span>
                  <span
                    className={`text-[11px] ${reached ? "text-leaf-200" : "text-sand-100/40"}`}
                  >
                    {step.bn}
                  </span>
                  {i < STEPS.length - 1 ? (
                    <span
                      aria-hidden
                      className={`h-px flex-1 ${i < stepIndex ? "bg-leaf-600/60" : "bg-white/10"}`}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </header>

      <section className="card space-y-2 p-4">
        <h3 className="text-[13px] font-semibold text-sand-50">আপনার অভিযোগ</h3>
        <p className="whitespace-pre-wrap text-[12.5px] leading-6 text-sand-100/75">
          {complaint.description}
        </p>

        {complaint.photos?.length ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {complaint.photos.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt="অভিযোগের ছবি"
                width={80}
                height={80}
                loading="lazy"
                className="h-20 w-20 rounded-lg object-cover"
              />
            ))}
          </div>
        ) : null}

        <dl className="grid gap-1.5 pt-2 text-[11.5px] sm:grid-cols-2">
          <div className="flex justify-between gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5">
            <dt className="text-sand-100/45">কাঙ্ক্ষিত সমাধান</dt>
            <dd className="font-semibold text-sand-100/80">
              {resolutionLabelBn(complaint.preferred_resolution)}
            </dd>
          </div>
          {complaint.status === "resolved" && complaint.resolution ? (
            <div className="flex justify-between gap-2 rounded-lg bg-leaf-600/10 px-2.5 py-1.5">
              <dt className="text-leaf-200/70">প্রদত্ত সমাধান</dt>
              <dd className="font-semibold text-leaf-100">
                {resolutionLabelBn(complaint.resolution)}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="card p-4">
        <h3 className="mb-2.5 text-[13px] font-semibold text-sand-50">কথোপকথন</h3>
        <ComplaintThread complaintId={complaint.id} initialMessages={messages} closed={closed} />
      </section>
    </div>
  );
}
