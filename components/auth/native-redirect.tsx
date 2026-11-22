"use client";

import { useEffect, useState } from "react";

/* ==========================================================================
   components/auth/native-redirect.tsx
   --------------------------------------------------------------------------
   Fires a custom-scheme deep link (biswasagro://…) once on mount and keeps a
   manual button as the fallback.

   Why the delay: iOS and Android both refuse a scheme launch that is not
   triggered by a user gesture in many cases, and a launch fired during the
   initial parse is frequently swallowed. 350 ms is enough for the WebView to
   settle and short enough that the user does not notice.

   The `to` value is validated by the server component before it reaches here,
   but it is re-checked — this component must never be a generic redirector.
   ========================================================================== */

export function NativeRedirect({ to }: { to: string }) {
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!to.startsWith("biswasagro://")) return;

    const timer = setTimeout(() => {
      setAttempted(true);
      // Navigating the top frame to a custom scheme either hands off to the app
      // or silently no-ops. Either way there is nothing to await.
      window.location.href = to;
    }, 350);

    return () => clearTimeout(timer);
  }, [to]);

  return (
    <a
      href={to}
      className="btn-primary mt-5 inline-flex w-full justify-center"
      // A real anchor, so the click also works if the automatic attempt failed.
      aria-describedby="native-hint"
    >
      {attempted ? "আবার চেষ্টা করুন" : "অ্যাপে ফিরুন"}
      <span id="native-hint" className="sr-only">
        বিশ্বাস এগ্রো অ্যাপ খুলবে
      </span>
    </a>
  );
}
