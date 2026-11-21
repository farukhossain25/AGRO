import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/api";
import { AccountNav } from "@/components/account-nav";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");

  return (
    <div className="container-x py-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold sm:text-3xl">আমার অ্যাকাউন্ট</h1>
          <p className="mt-1 text-[12.5px] text-sand-100/50">
            স্বাগতম, {user.name ?? user.phone ?? user.email}
            {user.role === "admin" ? (
              <span className="ml-2 rounded-full bg-leaf-600/20 px-2 py-0.5 text-[10px] font-bold text-leaf-200">অ্যাডমিন</span>
            ) : null}
          </p>
        </div>
        <Link href="/admin" className="hidden text-[12px] text-sand-100/40 hover:text-leaf-200 sm:block">
          {user.role === "admin" ? "অ্যাডমিন প্যানেল →" : ""}
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
