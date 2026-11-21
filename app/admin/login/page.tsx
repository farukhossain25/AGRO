"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock, Mail, ShieldAlert } from "lucide-react";
import { Logo } from "@/components/icon-logo";
import { Spinner } from "@/components/ui";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "লগইন ব্যর্থ");
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-950 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo size={44} href={null} />
        </div>

        <div className="card p-6">
          <div className="text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-leaf-600/15 text-leaf-300">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <h1 className="mt-3 text-lg font-bold">অ্যাডমিন প্যানেল</h1>
            <p className="mt-1 text-[12px] text-sand-100/45">শুধুমাত্র অনুমোদিত কর্মীদের জন্য</p>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3.5">
            <label className="block">
              <span className="label">ইমেইল</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input !pl-10"
                  placeholder="admin@bishwasagro.com"
                  autoComplete="username"
                />
              </div>
            </label>
            <label className="block">
              <span className="label">পাসওয়ার্ড</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30" />
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input !pl-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </label>

            {error ? (
              <p className="rounded-xl bg-red-500/10 px-3 py-2 text-[12px] text-red-200">{error}</p>
            ) : null}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Spinner /> : null}
              লগইন করুন
            </button>
          </form>

          <p className="mt-4 rounded-xl bg-white/[0.03] px-3 py-2 text-[10.5px] leading-relaxed text-sand-100/40">
            অ্যাকাউন্ট তৈরি বা পাসওয়ার্ড রিসেট করতে টার্মিনালে{" "}
            <span className="font-mono text-leaf-300">npm run db:admin</span> চালান — এটি{" "}
            <span className="font-mono">.env.local</span> থেকে{" "}
            <span className="font-mono">ADMIN_EMAIL</span> ও{" "}
            <span className="font-mono">ADMIN_PASSWORD</span> পড়ে।
          </p>
        </div>
      </div>
    </div>
  );
}
