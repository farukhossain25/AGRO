import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-x flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <span className="text-6xl" aria-hidden>🌾</span>
      <h1 className="mt-6 text-3xl font-bold sm:text-4xl">পাতাটি খুঁজে পাওয়া যায়নি</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-sand-100/55">
        আপনি যে পৃষ্ঠাটি খুঁজছেন সেটি সরানো হয়েছে বা ঠিকানাটি ভুল হতে পারে। নিচের লিংক থেকে
        তাজা পণ্য দেখে নিন।
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary">হোমে ফিরুন</Link>
        <Link href="/products" className="btn-ghost">পণ্য দেখুন</Link>
      </div>
    </div>
  );
}
