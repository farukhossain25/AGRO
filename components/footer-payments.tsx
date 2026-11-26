"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Banknote, Landmark, ShieldCheck, Wallet, X } from "lucide-react";
import { useLocale } from "@/lib/locale";

/* ==========================================================================
   <FooterPayments /> — the payment row at the bottom of the footer
   --------------------------------------------------------------------------
   Design reference: biswas-agro-footer-v4.html (the owner's mock-up).

   WHAT IT DOES
     • Every tile is the SAME size — 64 × 36 px on desktop/tablet, equal-width
       cells on a phone — with the admin's logo centred via object-fit:contain
       and 6 × 8 px padding. A method without a logo gets its NAME as text
       inside the same tile, so the row never has a hole in it.
     • Desktop/tablet: the first 4 tiles, phone: the first 3. If more methods
       exist, a "+N আরও" button opens them all. If only ONE would be hidden,
       everything is shown instead — a "+1" button that reveals a single tile
       is a worse trade than one extra tile on the row.
     • The button opens a dialog: anchored popover above the row on desktop,
       bottom sheet with a backdrop on a phone. It lists ALL methods in a
       3-column grid (logo + name) and closes on ✕, Esc, outside click,
       backdrop click — returning focus to the button it came from.
     • Admin-driven: the list comes from `payment_methods` (active +
       show_on_checkout, ordered by sort_order) on the server, so adding,
       removing, hiding or reordering a method shows up on the next page load
       with no redeploy.

   WHY IT LOOKS THE WAY IT DOES (the app's own theme, not the mock-up's CSS)
     The mock-up is a flat light page. This footer is a neumorphic panel on a
     grey-blue surface, so the tiles keep the mock's geometry (64 × 36, 10 px
     radius, contained logo) but take the app's raised surface and its soft
     ring instead of a hard border — a white tile on a light panel would read
     as a hole, not a tile.

   LAYOUT STABILITY
     The tile is a fixed box whose inner area is reserved, so a slow or broken
     logo cannot collapse the row or shift the legal links beside it.

   A11Y
     aria-haspopup="dialog" + aria-expanded + aria-controls on the button,
     role="dialog" + aria-label on the panel, focus into the panel on open,
     focus back on close, Escape and Tab containment, and every animation is
     disabled under prefers-reduced-motion.
   ========================================================================== */

export type FooterPaymentMethod = {
  code: string;
  name_bn: string;
  name_en: string | null;
  kind: string;
  logo_url: string | null;
};

const KIND_ICON = {
  cod: Banknote,
  bank: Landmark,
  gateway: ShieldCheck,
  mfs: Wallet,
} as const;

/** The tile box. One definition, used by the row and by the dialog grid, so
 *  the same method can never be two different sizes in two places. */
const TILE =
  "relative grid h-9 w-16 shrink-0 place-items-center overflow-hidden rounded-[10px] " +
  "bg-white px-2 py-1.5 shadow-neu-xs ring-1 ring-black/[0.06]";

function MethodTile({
  method,
  name,
  className = "",
}: {
  method: FooterPaymentMethod;
  name: string;
  /** `!w-full` when the dialog hands the tile its column width. */
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);

  /* Server-rendered <img> tags start loading before hydration; a slow 404 can
     already be over by the time React's onError exists. On mount, an image
     that is "complete" with no pixels has failed. */
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  const showLogo = Boolean(method.logo_url) && !failed;
  const Icon = KIND_ICON[method.kind as keyof typeof KIND_ICON] ?? Wallet;

  return (
    <span className={`${TILE} ${className}`} title={name}>
      {/* The name always sits UNDER the logo. A logo that is slow, blocked or
          dead therefore shows the method's name until (or instead of) itself —
          the tile is never an empty white box, and nothing reflows when the
          image finally paints. */}
      <span className="flex min-w-0 items-center justify-center gap-1 text-[9px] font-bold uppercase leading-[1.05] tracking-tight text-[#1d2a23]">
        <Icon className="h-3 w-3 shrink-0 text-[#1f7a4d]" aria-hidden />
        <span className="line-clamp-2 break-words">{name}</span>
      </span>

      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element -- any admin-pasted host; <img> never throws
        <img
          ref={img}
          src={method.logo_url ?? ""}
          alt=""
          width={48}
          height={24}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          /* Covers the name once it arrives; absolute, so it can never change
             the tile's size. Contained with the mock-up's 6/8px breathing room. */
          className="absolute inset-0 h-full w-full bg-white object-contain p-1.5"
        />
      ) : null}
    </span>
  );
}

export function FooterPayments({ methods }: { methods: FooterPaymentMethod[] }) {
  const { t, isBn } = useLocale();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* A phone shows 3 tiles, everything else 4. useSyncExternalStore keeps this
     honest in both directions: the server snapshot is `false` (so the markup
     the server sends always matches its first client paint) and every real
     breakpoint change — rotate, resize, split-screen — re-renders the row
     instead of leaving it stuck at whatever the viewport was on load. */
  const phone = useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(max-width: 640px)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(max-width: 640px)").matches,
    () => false
  );

  const label = useCallback(
    (m: FooterPaymentMethod) => (isBn ? m.name_bn : (m.name_en || m.name_bn)),
    [isBn]
  );

  const { shown, hidden } = useMemo(() => {
    const limit = phone ? 3 : 4;
    /* One leftover tile is not worth a dialog: show it on the row instead. */
    if (methods.length <= limit + 1) return { shown: methods, hidden: [] as FooterPaymentMethod[] };
    return { shown: methods.slice(0, limit), hidden: methods.slice(limit) };
  }, [methods, phone]);

  const close = useCallback(() => {
    setOpen(false);
    /* Return focus to where it came from — the button, always. */
    window.setTimeout(() => buttonRef.current?.focus(), 0);
  }, []);

  /* Escape closes; Tab stays inside the dialog (it has exactly one focusable
     control, the ✕, plus the tiles which are not focusable — trapping still
     matters for keyboards that tab out of the panel into the page behind). */
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    /* Outside click: the row itself is excluded so the click that closes the
       dialog cannot bounce back and reopen it. */
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      close();
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    /* The page behind must not scroll while the bottom SHEET is open. The
       desktop popover is small and anchored, so freezing the page under it
       would be a surprise (and would make Esc feel like a page jump). */
    const isPhone = window.matchMedia("(max-width: 640px)").matches;
    const prev = document.body.style.overflow;
    if (isPhone) document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      if (isPhone) document.body.style.overflow = prev;
    };
  }, [open, close]);

  if (methods.length === 0) return null;

  const moreLabel = t(`+${hidden.length} আরও`, `+${hidden.length} more`);

  return (
    <div className="flex w-full flex-col gap-2.5 lg:w-auto lg:flex-row lg:items-center lg:gap-3">
      <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-neu-faint">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-neu-accent-strong" aria-hidden />
        {t("নিরাপদ পেমেন্ট", "Secure payment")}
      </p>

      <div className="relative flex w-full items-center gap-2 lg:w-auto">
        <ul
          className="flex min-w-0 flex-1 items-center gap-2 lg:flex-none"
          aria-label={t("গ্রহণযোগ্য পেমেন্ট মাধ্যম", "Accepted payment methods")}
        >
          {shown.map((m) => (
            <li key={m.code} className="min-w-0 flex-1 sm:flex-none">
              <MethodTile
                method={m}
                name={label(m)}
                className="!w-full sm:!w-16"
              />
            </li>
          ))}
        </ul>

        {hidden.length > 0 ? (
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={panelId}
            className="grid h-9 w-16 shrink-0 place-items-center rounded-[10px] border border-dashed border-neu-accent/50 bg-neu-accent-soft text-[11px] font-bold text-neu-accent-strong transition hover:border-solid hover:bg-neu-accent hover:text-white sm:w-auto sm:px-2.5 motion-reduce:transition-none"
          >
            {moreLabel}
          </button>
        ) : null}

        {open ? (
          <>
            {/* The dimming backdrop belongs to the phone sheet only. On desktop
                the popover floats over the page with no scrim — a scrim there
                would dim the very footer the person is looking at, and the
                outside-click handler already closes it. */}
            {phone ? (
              <div
                className="fixed inset-0 z-[70] bg-neu-ink/45 backdrop-blur-[2px] animate-fade-in motion-reduce:animate-none"
                aria-hidden
                onClick={close}
              />
            ) : null}

            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              /* Only the phone sheet is modal (scrim + frozen page). The
                 desktop popover leaves the page usable, so it must not claim
                 modal semantics to a screen reader. */
              aria-modal={phone ? true : undefined}
              aria-label={t("সব পেমেন্ট মাধ্যম", "All payment methods")}
              /* Phone: bottom sheet. Desktop: popover anchored above the row. */
              className="fixed inset-x-0 bottom-0 z-[71] max-h-[70vh] origin-bottom overflow-y-auto rounded-t-[22px] border-t border-white/80 bg-neu-surface p-4 shadow-neu-lg animate-fade-up motion-reduce:animate-none sm:absolute sm:inset-x-auto sm:bottom-[calc(100%+10px)] sm:right-0 sm:max-h-[min(50vh,320px)] sm:w-[min(380px,calc(100vw-32px))] sm:origin-bottom-right sm:rounded-[18px] sm:border sm:p-3.5 sm:animate-pop"
              style={{ paddingBottom: "max(1.15rem, env(safe-area-inset-bottom))" }}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[12.5px] font-semibold text-neu-ink">
                  {t(`সব পেমেন্ট মাধ্যম (${methods.length})`, `All payment methods (${methods.length})`)}
                </p>
                <button
                  type="button"
                  data-autofocus
                  onClick={close}
                  aria-label={t("বন্ধ করুন", "Close")}
                  className="neu-icon-btn h-8 w-8 shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ul className="grid grid-cols-3 gap-x-2.5 gap-y-3">
                {methods.map((m) => (
                  <li key={m.code} className="grid min-w-0 content-start justify-items-center gap-1.5">
                    <MethodTile method={m} name={label(m)} className="!w-full" />
                    {/* The caption is for methods whose tile shows a LOGO —
                        a logo-less tile already spells the name out, and
                        printing it twice in one cell reads like a glitch. */}
                    {m.logo_url ? (
                      <span className="line-clamp-2 w-full text-center text-[10.5px] leading-tight text-neu-muted">
                        {label(m)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
