import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "অ্যাডমিন", template: "%s | অ্যাডমিন — বিশ্বাস এগ্রো" },
  robots: { index: false, follow: false },
};

/**
 * Chrome-free admin root so /admin/login can render full-screen.
 * The (protected) group adds the sidebar and the auth guard.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-ink-950">{children}</div>;
}
