"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { discountPercent, money, toBn } from "@/lib/format";

/* ==========================================================================
   RingShowcase — the products as a cylinder you spin
   --------------------------------------------------------------------------
   The reference for this block was a 3D "circular carousel" of photographs.
   A shop cannot ship that: a photo you can only look at is decoration, and a
   cylinder that never stops moving is a wall you cannot click through. What
   this keeps from the reference is the *feel* — a real cylinder (perspective,
   depth, inner shade, drag-with-momentum) — and what it adds is a product:
   image, name, unit, price, discount badge, and an add-to-cart that only the
   front card offers, so there is never a "which button did I press?" moment.

   WHY NOT A LIBRARY
     The reference API (`preset`, `tilt`, `curve`, `parallax`, `depthFade`…)
     is a 40-parameter image carousel. We need 8 of those behaviours and zero
     of the rest, on a page with a 132 kB first-load budget. This file is the
     whole thing: no dependency, no layout shift, and the animation loop owns
     the transforms directly (no React render per frame, so a spin is 60 fps
     on a mid-range Android).

   HOW THE CYLINDER IS BUILT
     Cards sit absolutely at the centre of the stage; each one is rotated
     about the stage's Y axis and then pushed outward by the radius:
        rotateY(angle + i·step) translateZ(radius)
     `perspective` lives on the stage, so every card shares one vanishing
     point. Radius is derived from the chord between neighbours — the cards
     therefore touch at the corners for any count, no magic numbers.
     Cards that face away are hidden (`visibility`), so no mirrored text.
     Per-card shade/opacity is written in the same loop: that is the "depth
     fade" — the front is bright, the sides fall into shadow.

   INPUT
     drag (pointer events, also finger), arrows, the filter chips, and
     autoplay that stops on hover/drag/focus and after any interaction.
     `prefers-reduced-motion` disables autoplay entirely and the easing
     becomes an instant snap. Everything is reachable by keyboard: Tab walks
     the cards and focusing one brings it to the front.
   ========================================================================== */

export type RingProduct = {
  id: string;
  slug: string;
  name_bn: string;
  name_en: string | null;
  price: number;
  compare_price: number | null;
  unit: string;
  unit_en: string | null;
  image: string | null;
  stock: number;
  category_id: string | null;
  badge_bn: string | null;
  rating: number;
};

export type RingCategory = {
  id: string;
  slug: string;
  name_bn: string;
  name_en: string | null;
  icon: string | null;
};

const GAP = 20; // px between neighbouring cards on the cylinder
/* One full lap, in seconds. The owner tunes this in /foisal/homepage
   ("সেকেন্ডে এক পাক") and the component converts it to degrees per ms. */
const DEFAULT_SECONDS_PER_TURN = 14;
/* A single trackpad flick fires dozens of wheel events; latching keeps it to
   one "step" per gesture instead of spinning the ring three cards. */
const WHEEL_LATCH_MS = 120;
/* The lens is NOT a constant: a closed ring of n cards needs a radius that
   grows with n, and a constant lens would blow the front card up as the owner
   raises the count (12 cards on the wheel once rendered a 420px monster).
   So the perspective is derived from the radius to hold the front card at a
   steady 1.32× — depth stays believable, size stays predictable. */
const FRONT_SCALE = 1.32;
const LENS_MIN = 900;
const LENS_MAX = 2600;

const mod = (n: number, m: number) => ((n % m) + m) % m;

export function RingShowcase({
  products,
  categories,
  headingBn,
  spin = true,
  secondsPerTurn = DEFAULT_SECONDS_PER_TURN,
}: {
  products: RingProduct[];
  categories: RingCategory[];
  headingBn: string;
  /** Continuous slow rotation ("চাকা নিজে ঘোরে"). Off = only moves on input. */
  spin?: boolean;
  /** Seconds for one full lap when free-spinning. Admin-set, clamped 6–120. */
  secondsPerTurn?: number;
}) {
  const { t, isBn } = useLocale();
  const cart = useCart();
  const toast = useToast();

  const [catId, setCatId] = useState("all");
  const [active, setActive] = useState(0);

  /* Mirror of `hovered` for event handlers, which run outside the render that
     produced the state and must not read a stale closure over it. */

  const [reduce, setReduce] = useState(false);
  const [stageW, setStageW] = useState(0);


  const items = useMemo(
    () => (catId === "all" ? products : products.filter((p) => p.category_id === catId)),
    [products, catId]
  );

  /* How many products each category actually has in this list — a chip that
     filters down to nothing would be a dead end, so it is disabled. */
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      if (!p.category_id) continue;
      map.set(p.category_id, (map.get(p.category_id) ?? 0) + 1);
    }
    return map;
  }, [products]);

  /* Every category that has at least one product here, in the admin's order. */
  const chips = useMemo(
    () => categories.filter((c) => (counts.get(c.id) ?? 0) > 0),
    [categories, counts]
  );

  /* ---------------------------------------------------------------- layout */
  const box = useMemo(() => {
    const n = Math.max(items.length, 1);
    const width = stageW || 900;
    /* Two different ratios, not one clamp: on a phone the stage is ~350px and
       a card has to be nearly half of it to be legible; on desktop the same
       card should be a sixth of a 1200px stage, not a billboard. */
    const cardW = Math.round(
      width < 520
        ? Math.min(210, Math.max(148, width * 0.46))
        : Math.min(244, Math.max(190, width * 0.2))
    );
    const cardH = Math.round(cardW * 1.34);
    /* A closed ring: n cards × step = exactly 360°. Anything less leaves a
       hole at the back, which is what made the wheel look lopsided (the two
       neighbours of the front card were 37° and 66° away instead of ±37°).
       With a closed ring the chord between neighbours is (cardW + GAP), so the
       radius follows from the step. */
    const step = 360 / n;
    const radius = Math.round((cardW + GAP) / (2 * Math.sin((step * Math.PI) / 360)));
    const lens = Math.round(
      Math.min(LENS_MAX, Math.max(LENS_MIN, (radius * FRONT_SCALE) / (FRONT_SCALE - 1)))
    );
    const scale = lens / (lens - radius);
    /* NOTE: no height here on purpose. The stage's height is a CSS constant
       (see the markup) so the section occupies the same space before and after
       the first measurement — otherwise every hydration re-sized the stage and
       pushed everything below it down (a real CLS hit). The cards may grow
       inside the stage; the page never moves. */
    return { cardW, cardH, step, radius, lens, frontW: Math.round(cardW * scale) };
  }, [items.length, stageW]);

  const angle = useRef(0); // current rotation, degrees
  const target = useRef(0); // where it is heading
  const index = useRef(0); // unbounded step counter → a spin never rewinds
  const cards = useRef<(HTMLElement | null)[]>([]);
  const shades = useRef<(HTMLDivElement | null)[]>([]);
  /* Free-spin velocity in degrees per millisecond, derived from the admin's
     seconds-per-turn. Kept in a ref so the rAF loop never re-subscribes when
     the owner changes the number. */
  const freeSpeed = useRef(360 / (Math.max(6, secondsPerTurn) * 1000));
  const freeSpin = useRef(spin);
  useEffect(() => {
    /* Written in an effect, never during render: React may render twice and
       throw a render away, and a ref assigned during render keeps the value
       from the discarded pass. */
    freeSpeed.current = 360 / (Math.max(6, secondsPerTurn) * 1000);
    freeSpin.current = spin;
  }, [secondsPerTurn, spin]);
  const spinAngle = useRef(0); // continuous free rotation, never snaps
  /* Set by go(): "ease to this exact card, then carry on spinning". The card
     grid is anchored on the card nearest the wheel at the moment of the
     gesture, so a step's destination is always index * step. */
  const snap = useRef<number | null>(null);
  /* Which card is physically nearest the front. In a ref because the rAF loop
     must read it without re-rendering; React is only told when the answer
     changes (≈ once per card), which updates aria/counter/add-to-cart. */
  const frontRef = useRef(0);
  const pausedRef = useRef(false);
  const drag = useRef<{ x: number; from: number } | null>(null);
  /* Resume the free spin from wherever the wheel currently is. */
  const resume = useCallback(() => {
    spinAngle.current = angle.current;
    target.current = angle.current;
    pausedRef.current = false;
  }, []);

  /* Whether a real drag started lives in a ref, not in state: pointerup can
     arrive in the same batch as the first pointermove, and a handler that
     reads `dragging` from state would then still see `false` and skip the
     whole step calculation (the wheel moved under the finger, then snapped
     back to where it was). */
  const dragActive = useRef(false);
  const moved = useRef(0);
  const suppressClick = useRef(false);
  const lastTouch = useRef(0);
  const tabHiddenRef = useRef(false);

  const boxRef = useRef(box);
  boxRef.current = box;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  /* One write pass over the cards. Called on mount, on resize, while the
     easing loop runs, and on every React render (a remount would otherwise
     drop the inline transform and flash the card at the centre). */
  const paint = useCallback(() => {
    const { step, radius } = boxRef.current;
    const list = itemsRef.current;
    for (let i = 0; i < list.length; i += 1) {
      const el = cards.current[i];
      if (!el) continue;
      const a = angle.current + i * step;
      const facing = Math.cos((a * Math.PI) / 180);
      /* The card nearest the front lifts a few pixels — the same trick a
         physical turntable gives you, and it separates the front product from
         the ones turning away without changing its size. */
      const lift = facing > 0.985 ? -5 : 0;
      el.style.transform = `rotateY(${a}deg) translateZ(${radius}px) translateY(${lift}px)`;
      /* Past ~72° a card is edge-on: a 20px sliver of mirrored text, which
         reads as a rendering glitch, not as depth. Hidden. */
      el.style.visibility = facing > 0.3 ? "visible" : "hidden";
      el.style.zIndex = String(100 + Math.round(facing * 100));
      el.style.opacity = String(0.5 + 0.5 * Math.max(0, facing));
      const shade = shades.current[i];
      if (shade) shade.style.opacity = String(Math.max(0, (1 - facing) * 0.62));
    }
  }, []);

  /* One frame. Pure with respect to React state: it reads refs, writes DOM
     styles and, at most once per card, calls setActive. It deliberately does
     NOT schedule itself — the driver effect in steps() owns requestAnimationFrame,
     which is what stops two loops from stacking (two rAF callbacks each
     asking for the next frame made the wheel run at exactly half speed). */
  const frame = useCallback(
    (dt: number): boolean => {
      /* "Enabled" and "moving right now" are different questions. The loop
         keeps running for as long as free spin is enabled, idling while the
         wheel is paused (hover/drag/hidden tab). It used to return false on
         the first paused frame, and every path that forgot to restart it left
         the wheel frozen — the class of bug that made the spin measure 1°/s
         in one run and 9°/s in the next. A rAF that returns early is free. */
      /* Both the ref (authoritative, updated by effects) and the prop are
         consulted: a stale ref after a HMR remount has frozen the wheel more
         than once during this build, and the prop is always whatever React
         last rendered. */
      /* A pending snap outranks the free spin: the visitor asked for a card,
         so the wheel eases onto that card's exact angle and then hands control
         back to the spin. Without this the spin's own drift pushed the wheel
         off the card grid on every gesture, so the counter and the picture
         disagreed by up to half a card. */
      if (snap.current !== null) {
        const dest = snap.current;
        const gap = dest - angle.current;
        if (Math.abs(gap) < 0.06 || reduce) {
          angle.current = dest;
          spinAngle.current = dest;
          target.current = dest;
          snap.current = null;
          paint();
        } else {
          angle.current += gap * Math.min(1, dt / 130);
          spinAngle.current = angle.current;
          paint();
        }
        const nSnap = itemsRef.current.length;
        if (nSnap) {
          const frontSnap = mod(Math.round(-angle.current / boxRef.current.step), nSnap);
          if (frontSnap !== frontRef.current) {
            frontRef.current = frontSnap;
            setActive(frontSnap);
          }
        }
        return true;
      }

      const enabled = (freeSpin.current || spin) && !reduce;
      /* Hovering the wheel pauses it; hovering *elsewhere on the page* must
         not — the wheel sits low on a phone and slightly below the fold on a
         laptop, and a pause that depended on where the pointer happened to be
         left the wheel frozen after every single interaction. */
      const spinning = enabled && !pausedRef.current && !tabHiddenRef.current;
      const diff = target.current - angle.current;

      if (enabled) {
        if (!spinning) return true; // paused: hold position, keep the loop
        /* Free spin: constant angular velocity. index/target are kept in step
           so the moment someone grabs the wheel the drag starts exactly where
           the animation left it, not at a stale angle. */
        spinAngle.current += freeSpeed.current * dt;
        angle.current = spinAngle.current;
        index.current = -angle.current / boxRef.current.step;
        target.current = angle.current;
        /* Paint every frame. Without this the DOM only caught up when a card
           change re-rendered React — the wheel appeared to step card-to-card
           and measured at half the configured speed. */
        paint();
      } else if (Math.abs(diff) < 0.06 || reduce) {
        /* Easing finished — or reduced motion, where the wheel only ever
           jumps to the card the visitor asked for. */
        angle.current = target.current;
        spinAngle.current = angle.current;
        paint();
        return false;
      } else {
        /* Time-based easing (not per-frame lerp): the wheel reaches the next
           card in a predictable ~350ms whatever the refresh rate, and the
           last few frames stop being an invisible 3px crawl. */
        const k = Math.min(1, dt / 120);
        angle.current += diff * k;
        spinAngle.current = angle.current;
        paint();
      }

      /* Tell React which card is at the front, but only when it changed: the
         counter, aria-current, the product link and the add-to-cart button all
         depend on it, and re-rendering 60×/s would defeat the whole point. */
      const n = itemsRef.current.length;
      if (n) {
        const front = mod(Math.round(-angle.current / boxRef.current.step), n);
        if (front !== frontRef.current) {
          frontRef.current = front;
          setActive(front);
        }
      }
      return true;
    },
    [paint, reduce, spin]
  );

  /* The loop. Runs while free-spin is on, or while an eased move is still in
     flight; stops itself the moment neither is true. Exactly one loop can be
     alive because this is the only place requestAnimationFrame is scheduled. */
  const frameRef = useRef<(dt: number) => boolean>(() => false);
  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  /* A plain self-scheduling loop for the whole life of the component.
     It is not started/stopped by effects at all — effects are the thing that
     kept losing the start (a re-render cancelled the rAF and the replacement
     effect saw nothing new to react to). One mount, one loop, and `frame()`
     decides what (if anything) to do each tick. `frame` itself reads only
     refs, so the loop never needs the latest closure. */
  useEffect(() => {
    let id = 0;
    let last = 0;
    const tick = (now: number) => {
      /* Clamp to ONE frame, not to 64 ms: after a pause (hover, drag, hidden
         tab) the first frame's `now - last` is the whole pause, and at 64 ms
         the wheel lurched 2° — which compounded into the multi-card jumps this
         wheel kept producing. 16.7 is a normal frame; anything larger is a
         stall and motion should simply continue from where it was. */
      const dt = last ? Math.min(17, now - last) : 16.7;
      last = now;
      frameRef.current(dt);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  /* Explicit nudge for the places that used to call `start()`: an arrow, a
     card tap, a drag release. Kept as a state bump because `go()` runs before
     some of the geometry is committed. */
  /* Explicit nudge for the places that used to call `start()`: an arrow, a
     card tap, a drag release. `target` is a ref, so a state bump is what tells
     the driver effect to look again. The loop itself stays single-owner. */
  const start = useCallback(() => {
    /* The loop runs for the life of the component; nothing to start. Kept as a
       named no-op-with-a-paint so every caller reads the same. */
    paint();
  }, [paint]);

  /* ------------------------------------------------------------- navigation */
  /* One card STEP is always a quarter turn of the animation *and* exactly one
     integer index. Everything below expresses "next" as "one step from the card
     currently in front", never as "the float angle + step" — that is where the
     earlier versions lost gestures.
   
     Two modes:
       free spin on  → the wheel is in continuous motion, so a step has to be
                       applied immediately (the easing branch is unreachable);
                       it moves the angle by exactly one step and re-bases the
                       spin on the new angle.
       free spin off → smooth ease to the neighbouring card. */
  const go = useCallback(
    (delta: number) => {
      const n = itemsRef.current.length;
      if (n < 2) return;
      const { step } = boxRef.current;
      /* Which card is nearest the front right now, expressed as an integer
         multiple of `step` that is also the angle the wheel is closest to. */
      const nearest = Math.round(-angle.current / step);
      const dest = (nearest - delta) * step;

      /* Park the spin on the current angle first. If the free spin is allowed
         to advance between this line and the next frame, the snap's starting
         point is already stale and the easing overshoots past the card — which
         looked like a random jump of two or three cards. */
      spinAngle.current = angle.current;
      target.current = angle.current;
      index.current = -(dest / step);
      setActive(mod(index.current, n));
      frontRef.current = mod(index.current, n);
      lastTouch.current = Date.now();
      if (reduce) {
        angle.current = dest;
        spinAngle.current = dest;
        target.current = dest;
        paint();
        return;
      }
      /* Always ease. Applying the new angle here (which earlier versions did
         while free-spinning) moved the wheel by a full step before the easing
         branch had even seen it, so one gesture skipped one or two cards. The
         tick is the only writer of `angle`; a gesture only sets the target. */
      snap.current = dest;
      start();
    },
    [paint, reduce, start]
  );

  useEffect(() => {
    goRef.current = go;
  }, [go]);

  const focusCard = useCallback(
    (i: number, from?: HTMLElement) => {
      const n = itemsRef.current.length;
      if (!n) return;
      /* While free-spinning, `index` is the card physically nearest the front
         and may be fractional's floor — round it so taps resolve to the card
         the visitor is actually looking at. */
      const cur = mod(Math.round(index.current), n);
      /* Shortest way round, so tapping the card on the left does not spin the
         whole cylinder the long way. */
      let delta = i - cur;
      index.current = cur;
      if (delta > n / 2) delta -= n;
      if (delta < -n / 2) delta += n;
      go(delta);
      /* A keyboard user who tabbed into a preview must end up on the card that
         is now at the front, not on a card that has just rotated away. */
      if (from) {
        requestAnimationFrame(() => {
          const target = cards.current[i]?.querySelector<HTMLElement>("a,button");
          target?.focus({ preventScroll: true });
        });
      }
    },
    [go]
  );

  /* --------------------------------------------------------------- effects */
  /* Stage width drives the card size: one measurement, then the cylinder is
     rebuilt from it. A ResizeObserver (not a window listener) so a sidebar
     opening on desktop also re-lays it out. */
  const stageEl = useRef<HTMLDivElement | null>(null);

  /* Scroll-to-spin, bound natively.
     React attaches `onWheel` as a PASSIVE listener on the root, so
     preventDefault() inside it is ignored and Chrome logs "Unable to prevent
     Default" — the wheel would turn *and* the page would scroll. Binding the
     element directly with { passive: false } is the only way to take the
     gesture on the element while leaving the rest of the page alone.
     Downward scroll is never touched: the page keeps scrolling as usual and
     only an upward gesture over the wheel spins it. */
  const goRef = useRef<(delta: number) => void>(() => {});
  useEffect(() => {
    const el = stageEl.current;
    if (!el) return;
    let latched = false;
    let releaseTimer = 0;
    const onWheel = (e: WheelEvent) => {
      /* Downward scroll is the page's own. Never preventDefault on it. */
      if (Math.abs(e.deltaY) < 2 || e.deltaY > 0) return;
      e.preventDefault();
      /* One step per gesture: a trackpad flick fires dozens of events, and a
         time-only latch let two of them through while the wheel was already
         turning, so one flick skipped a card. The latch clears shortly after
         the events stop. */
      if (latched) {
        window.clearTimeout(releaseTimer);
        releaseTimer = window.setTimeout(() => {
          latched = false;
        }, WHEEL_LATCH_MS);
        return;
      }
      latched = true;
      window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(() => {
        latched = false;
      }, WHEEL_LATCH_MS);
      /* One card per gesture. A mouse notch and a trackpad flick both mean
         "next, please" — asking for two cards on a long flick made the wheel
         skip and then look stuck on the next gesture. */
      goRef.current(1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.clearTimeout(releaseTimer);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  useEffect(() => {
    const el = stageEl.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setStageW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(query.matches);
    const onChange = () => setReduce(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  /* Keep the transform in sync with whatever React just committed. */
  useEffect(() => {
    paint();
  });

  /* A different category is a different cylinder: start it at the front. */
  useEffect(() => {
    angle.current = 0;
    target.current = 0;
    index.current = 0;
    setActive(0);
    paint();
  }, [catId, paint]);

  /* Pause while the visitor is reading: hover, a drag in progress, or focus
     inside the wheel. The pause is a ref (the loop reads it every frame) and
     the resume goes through `kick()` so the loop is restarted, not duplicated. */
  /* A background tab must not bank up rotation and then jump when it is
     looked at again: one state flag, watched by the driver effect. */
  useEffect(() => {
    const onVis = () => {
      tabHiddenRef.current = document.visibilityState === "hidden";
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /* First paint and every config change: make sure something is on screen
     even when free spin is off (the wheel must not start blank). */
  useEffect(() => {
    paint();
  }, [paint, items.length, secondsPerTurn, spin]);

  /* ---------------------------------------------------------------- events */
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    /* Freeze the spin for as long as a finger/mouse is down. The loop stops
       by itself on the next frame (nothing to animate), so the drag owns the
       angle outright — no second animation writing over it. */
    pausedRef.current = true;
    drag.current = { x: e.clientX, from: angle.current };
    dragActive.current = false;
    moved.current = 0;
    suppressClick.current = false;
    lastTouch.current = Date.now();
    /* Deliberately NOT capturing here: `setPointerCapture` on pointerdown
       retargets pointerup to the stage, and the subsequent click is then
       dispatched to the stage instead of the link/button under the finger —
       the add-to-cart button and the product link stop working. Capture only
       after the pointer has actually travelled far enough to be a drag. */
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    if (!dragActive.current) {
      if (Math.abs(dx) < 6) return; // a tap, not a drag
      dragActive.current = true;
      /* Arm the pause HERE, not in an effect on `dragging`: an effect re-runs
         after pointerup too (dragging: true → false) and re-paused the wheel
         the frame after it was resumed. */
      pausedRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    moved.current = Math.max(moved.current, Math.abs(dx));
    /* 0.42°/px: a 300px swipe now crosses ~2.6 cards. At 0.24 the wheel felt
       sluggish on a phone, where the thumb travels far less than a mouse. */
    angle.current = drag.current.from + dx * 0.42;
    target.current = angle.current;
    paint();
  }

  function endDrag(e?: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const wasDragging = dragActive.current;
    drag.current = null;
    dragActive.current = false;
    if (e && e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    /* A tap: the card's own link/button owns the event, the wheel stays put.
       The pause is released here rather than in the hover effect because on a
       touch screen `hovered` never changes: pointerdown paused the wheel and
       nothing else was ever going to un-pause it, so a single tap froze the
       wheel for good. On a desktop the cursor is usually still over the stage,
       so it stays paused until the pointer leaves — which is the intent. */
    if (!wasDragging) {
      suppressClick.current = false;
      resume();
      return;
    }
    index.current = Math.round(-angle.current / boxRef.current.step);
    target.current = -index.current * boxRef.current.step;
    setActive(mod(index.current, itemsRef.current.length));
    frontRef.current = mod(index.current, itemsRef.current.length);
    lastTouch.current = Date.now();
    resume();
    /* Resume from the position the drag ended on — `spinAngle` is the free
       spin's cursor and must not still hold the pre-drag angle, or the wheel
       jumps back the moment it starts turning again. */
    spinAngle.current = angle.current;
    /* A drag that moved more than a nail's width must not also navigate. */
    suppressClick.current = moved.current > 8;
    if (reduce) {
      angle.current = target.current;
      paint();
    } else {
      start();
    }
  }

  function onCardClick(e: React.MouseEvent, i: number) {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClick.current = false;
      return;
    }
    if (i !== active) {
      e.preventDefault();
      focusCard(i);
    }
  }

  function addToCart(p: RingProduct) {
    if (p.stock <= 0) return;
    cart.add(
      {
        id: p.id,
        kind: "product",
        slug: p.slug,
        nameBn: p.name_bn,
        nameEn: p.name_en ?? p.name_bn,
        price: p.price,
        unit: p.unit,
        image: p.image,
        stock: p.stock,
      },
      1
    );
    toast.success(t("কার্টে যোগ হয়েছে", "Added to cart"), t(p.name_bn, p.name_en ?? p.name_bn));
  }

  if (items.length < 2) return null;

  return (
    <section className="section relative overflow-hidden" aria-labelledby="ring-heading">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-leaf-radial" />
      <div className="container-x">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <span className="eyebrow mb-3">{t("ঘুরিয়ে দেখুন", "Spin to explore")}</span>
            <h2 id="ring-heading" className="h-section">
              {headingBn}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-neu-muted">
              {t(
                "চাকা নিজে ঘোরে — ধরলে থেমে যায়, ছাড়লে আবার ঘোরে। টেনে, স্ক্রল করে বা তীর চেপে ঘোরান; সামনের পণ্যটি সরাসরি কার্টে যোগ করুন।",
                "The wheel turns on its own — it pauses while you hold it and carries on when you let go. Drag, scroll or use the arrows; the product at the front goes straight to the cart."
              )}
            </p>
          </div>
          <Link href="/products" className="btn-ghost btn-sm shrink-0 self-start sm:self-auto">
            {t("সব পণ্য", "All products")}
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        {/* category chips — the ring only ever contains products that exist */}
        {chips.length > 1 ? (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setCatId("all")}
              aria-pressed={catId === "all"}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                catId === "all"
                  ? "bg-neu-accent text-white shadow-neu-sm"
                  : "bg-neu-raised text-neu-muted shadow-neu-xs hover:text-neu-ink"
              }`}
            >
              {t("সব", "All")}{" "}
              <span className="opacity-70">{toBn(products.length)}</span>
            </button>
            {chips.map((c) => {
              const on = catId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCatId(c.id)}
                  aria-pressed={on}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                    on
                      ? "bg-neu-accent text-white shadow-neu-sm"
                      : "bg-neu-raised text-neu-muted shadow-neu-xs hover:text-neu-ink"
                  }`}
                >
                  {c.icon ? <span aria-hidden>{c.icon}</span> : null}
                  {t(c.name_bn, c.name_en ?? c.name_bn)}
                  <span className="opacity-70">{toBn(counts.get(c.id) ?? 0)}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {/* ---------------------------------------------------------- stage */}
        <div className="relative">
          <div
            role="region"
            aria-roledescription={t("ক্যারোসেল", "carousel")}
            aria-label={headingBn}
            /* A browser's native image drag would start on mousedown over a
               card photo and swallow every pointermove — the wheel would feel
               dead exactly where a visitor naturally grabs it. */
            ref={stageEl}
            onDragStart={(e) => e.preventDefault()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => endDrag(e)}
            onPointerCancel={(e) => endDrag(e)}
            /* Keyboard: a card sliding away under a tabber is unusable, so
               focus pauses; leaving the wheel resumes. */
            onFocusCapture={() => {
              pausedRef.current = true;
            }}
            onBlurCapture={() => resume()}
            /* Touch: a finger resting on the wheel stops it, exactly like hover
               on a desktop. Pointerdown already cancels the loop; this covers
               the "finger down but not yet moving" case. */
            className="relative h-[372px] touch-pan-y select-none sm:h-[452px] cursor-grab active:cursor-grabbing"
            style={{ perspective: box.lens, perspectiveOrigin: "50% 42%" }}
          >
            {items.map((p, i) => {
              const isFront = i === active;
              const off = discountPercent(p.price, p.compare_price);
              return (
                <article
                  key={p.id}
                  ref={(el) => {
                    cards.current[i] = el;
                  }}
                  aria-current={isFront ? "true" : undefined}
                  /* Keyboard: tabbing into a card that is not at the front
                     spins it round, otherwise the visitor is typing into a
                     card they cannot see. The product link is skipped in the
                     tab order because only the front card is a real product
                     card — the rest are previews whose link/button just brings
                     them forward. */
                  onFocus={(e) => {
                    if (!isFront) focusCard(i, e.target as HTMLElement);
                  }}
                  className="absolute left-1/2 top-1/2 flex flex-col overflow-hidden rounded-[1.4rem] border border-white/85 bg-neu-surface shadow-neu-sm [backface-visibility:hidden] [will-change:transform]"
                  style={{
                    width: box.cardW,
                    height: box.cardH,
                    marginLeft: -box.cardW / 2,
                    marginTop: -box.cardH / 2,
                    transform: `rotateY(${i * box.step}deg) translateZ(${box.radius}px)` ,
                    opacity: i === 0 ? 1 : 0.6,
                  }}
                >
                  <div className="relative flex-1 overflow-hidden bg-neu-sunken">
                    {p.image ? (
                      <Image
                        src={p.image}
                        alt={t(p.name_bn, p.name_en ?? p.name_bn)}
                        fill
                        sizes="(max-width: 640px) 45vw, 220px"
                        draggable={false}
                        className="object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-3xl">🌿</div>
                    )}

                    {off > 0 ? (
                      <span className="absolute left-2 top-2 rounded-full bg-leaf-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                        {toBn(off)}% {t("ছাড়", "OFF")}
                      </span>
                    ) : p.badge_bn ? (
                      <span className="absolute left-2 top-2 rounded-full bg-ink-950/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                        {p.badge_bn}
                      </span>
                    ) : null}

                    {p.stock <= 0 ? (
                      <span className="absolute right-2 top-2 rounded-full bg-ink-950/85 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {t("স্টক শেষ", "Sold out")}
                      </span>
                    ) : null}

                    {/* The overlay is the only thing that changes between
                        front and side cards — the image node never remounts,
                        so a spin never refetches a picture. */}
                    {isFront ? (
                      <Link
                        href={`/products/${p.slug}`}
                        onClick={(e) => onCardClick(e, i)}
                        aria-label={`${t(p.name_bn, p.name_en ?? p.name_bn)} — ${t("বিস্তারিত", "details")}`}
                        className="absolute inset-0 z-10"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => onCardClick(e, i)}
                        tabIndex={-1}
                        aria-label={`${t(p.name_bn, p.name_en ?? p.name_bn)} — ${t("সামনে আনুন", "bring to front")}`}
                        className="absolute inset-0 z-10"
                      />
                    )}
                  </div>

                  <div className="flex flex-col gap-1 px-3 py-2.5">
                    <p className="line-clamp-1 text-[12.5px] font-semibold leading-tight text-neu-ink">
                      {t(p.name_bn, p.name_en ?? p.name_bn)}
                    </p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[13.5px] font-bold text-leaf-700">{money(p.price, isBn)}</span>
                      {p.compare_price && p.compare_price > p.price ? (
                        <span className="text-[10.5px] text-neu-faint line-through">
                          {money(p.compare_price, isBn)}
                        </span>
                      ) : null}
                      <span className="ml-auto text-[10px] text-neu-faint">
                        {t(p.unit, p.unit_en ?? p.unit)}
                      </span>
                    </div>

                    {isFront ? (
                      <button
                        type="button"
                        onClick={() => addToCart(p)}
                        disabled={p.stock <= 0}
                        className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl bg-neu-accent py-1.5 text-[11.5px] font-semibold text-white transition hover:bg-neu-accent-strong disabled:opacity-45"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                        </svg>
                        {t("কার্টে যোগ করুন", "Add to cart")}
                      </button>
                    ) : (
                      <div className="mt-1 flex h-[30px] items-center gap-1 text-[10.5px] text-neu-faint">
                        <span aria-hidden className="text-amber-500">
                          ★
                        </span>
                        <span>{toBn(p.rating.toFixed(1))}</span>
                        {p.badge_bn ? <span className="truncate">· {p.badge_bn}</span> : null}
                      </div>
                    )}
                  </div>

                  {/* depth shading — written by the animation loop */}
                  <div
                    ref={(el) => {
                      shades.current[i] = el;
                    }}
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-[1.4rem] bg-ink-950"
                    style={{ opacity: 0 }}
                  />
                </article>
              );
            })}

            {/* floor shadow — a wheel floating in a gradient reads as a bug;
                one soft ellipse under the front card grounds it. */}
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-[14%] left-1/2 h-10 w-[min(80%,560px)] -translate-x-1/2 rounded-[50%] bg-ink-950/15 blur-2xl"
            />

            {/* edge fades, so cards leave the frame instead of being cut */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-neu-bg to-transparent sm:w-16" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-neu-bg to-transparent sm:w-16" />
          </div>

          {items.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label={t("আগের পণ্য", "Previous product")}
                className="absolute left-0 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-neu-raised text-neu-ink shadow-neu-sm transition hover:text-neu-accent sm:-left-2"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label={t("পরের পণ্য", "Next product")}
                className="absolute right-0 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-neu-raised text-neu-ink shadow-neu-sm transition hover:text-neu-accent sm:-right-2"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          ) : null}
        </div>

        <div className="mt-1 flex items-center justify-center gap-3 text-[11.5px] text-neu-faint">
          <span className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1.5a1.5 1.5 0 0 1 3 0V12m0-1a1.5 1.5 0 0 1 3 0v1.5m0 .5a1.5 1.5 0 0 1 3 0V16a5 5 0 0 1-5 5h-2a6 6 0 0 1-6-6v-3a1.5 1.5 0 0 1 3 0" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t("নিজে ঘোরে · ধরলে থামে", "Auto-spins · hold to pause")}
          </span>
          <span aria-hidden>·</span>
          <span aria-live="polite">
            {toBn(active + 1)} / {toBn(items.length)}
          </span>
        </div>
      </div>
    </section>
  );
}
