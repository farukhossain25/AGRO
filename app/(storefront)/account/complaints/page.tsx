import Link from "next/link";
import type { Metadata } from "next";
import { currentUser } from "@/lib/api";
import {
  getComplaintsForUser,
  problemTypeLabelBn,
  complaintStatusLabelBn,
} from "@/lib/reviews";
import { formatDateBn } from "@/lib/format";
import { EmptyState, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "আমার অভিযোগ",
  robots: { index: false, follow: false },
};

export default async function ComplaintsPage() {
  const user = await currentUser();
  if (!user) return null;

  const items = await getComplaintsForUser(user.id);

  if (!items.length) {
    return (
      <EmptyState
        icon="🛟"
        title="কোনো অভিযোগ নেই"
        body="কোনো পণ্যে সমস্যা হলে অর্ডার থেকে “সমস্যা জানান” চাপুন — আমরা ২৪ ঘণ্টায় উত্তর দিই।"
        action={
          <Link href="/account/orders" className="btn-primary">
            আমার অর্ডার
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[19px] font-bold text-sand-50">আমার অভিযোগ</h2>
          <p className="text-[12px] text-sand-100/50">
            মোট {items.length}টি টিকিট · স্ট্যাটাস ও উত্তর এখানে দেখুন
          </p>
        </div>
        <Link href="/account/orders" className="btn-ghost btn-sm">
          অর্ডার তালিকা
        </Link>
      </header>

      <ul className="space-y-2.5">
        {items.map((item) => {
          const label = complaintStatusLabelBn(item.status);
          return (
            <li key={item.id}>
              <Link
                href={`/account/complaints/${item.id}`}
                className="card block p-3.5 transition hover:border-leaf-400/30 hover:bg-white/[0.045]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[12px] font-bold text-leaf-200">
                      #{item.ticket_no}
                    </p>
                    <p className="mt-0.5 truncate text-[13.5px] font-semibold text-sand-50">
                      {item.products?.name_bn ?? "পণ্য"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-sand-100/45">
                      {problemTypeLabelBn(item.problem_type)}
                      {item.sellers?.name_bn ? ` · ${item.sellers.name_bn}` : ""}
                      {" · "}
                      {formatDateBn(item.created_at)}
                    </p>
                  </div>
                  <Badge tone={label.tone}>{label.bn}</Badge>
                </div>

                <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-sand-100/55">
                  {item.description}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="text-[11px] leading-5 text-sand-100/35">
        সমাধান না হলে টিকিটের ভেতরে উত্তর দিন — অ্যাডমিন ও সেলার উভয়েই দেখতে পাবেন।
      </p>
    </div>
  );
}
