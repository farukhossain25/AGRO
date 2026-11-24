"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "প্রিন্ট করুন", className = "btn-primary btn-sm" }: { label?: string; className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      <Printer className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
