import type { Config } from "tailwindcss";

/**
 * JapanLogue · Neumorphism design tokens
 * ------------------------------------------------------------------
 * The neutral + brand scales are driven by CSS custom properties declared in
 * app/globals.css. Every utility that references them (including opacity
 * modifiers, gradients, rings and divide colours) re-themes automatically, so
 * the whole storefront, account area and admin panel share one source of truth.
 *
 * Static "neu" colours exist for places that must stay fixed regardless of
 * theme (accent gradients, image overlays, print surfaces).
 */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* ── Neutral scale ──────────────────────────────────────────────
           In the light neumorphic theme:
             ink-950  darkest neutral (text on light chips / image scrims)
             ink-900  page background          #E3E8F0
             ink-850  card surface            #E7ECF4
             ink-800  sunken / inset surface  #DDE3ED
             ink-700  soft shadow / border    #C7CEDA
             ink-600  muted border            #98A3B3
             ink      primary text            #303943
           ──────────────────────────────────────────────────────────── */
        ink: {
          DEFAULT: v("ink"),
          950: v("ink-950"),
          900: v("ink-900"),
          850: v("ink-850"),
          800: v("ink-800"),
          700: v("ink-700"),
          600: v("ink-600"),
        },
        /* sand-100 is the primary text colour used all over the storefront. */
        sand: {
          DEFAULT: v("sand"),
          50: v("sand-50"),
          100: v("sand-100"),
          200: v("sand-200"),
          300: v("sand-300"),
        },
        leaf: {
          DEFAULT: v("leaf"),
          50: v("leaf-50"),
          100: v("leaf-100"),
          200: v("leaf-200"),
          300: v("leaf-300"),
          400: v("leaf-400"),
          500: v("leaf-500"),
          600: v("leaf-600"),
          700: v("leaf-700"),
          800: v("leaf-800"),
          900: v("leaf-900"),
        },
        /* brand alias — `text-mint` / `border-mint/40` follow the leaf scale */
        mint: {
          DEFAULT: v("leaf-300"),
          50: v("leaf-50"),
          100: v("leaf-100"),
          200: v("leaf-200"),
          300: v("leaf-300"),
          400: v("leaf-400"),
        },
        /* ── Fixed neumorphism palette (JapanLogue reference) ──────────── */
        neu: {
          bg: "#E3E8F0",
          surface: "#E7ECF4",
          raised: "#EEF2F8",
          sunken: "#D9DFE9",
          line: "#C7CEDA",
          highlight: "#FFFFFF",
          ink: "#303943",
          muted: "#566270",
          faint: "#5A6572",
          accent: "#2F8F66",
          "accent-strong": "#23724F",
          "accent-soft": "#DCEFE5",
        },
        /* Status colours that are only ever used as *text* are variable-driven so
           their opacity variants re-theme too. amber-500/600 stay Tailwind's
           defaults because they are also used as badge backgrounds. */
        red: {
          100: v("red-100"),
          200: v("red-200"),
          300: v("red-300"),
          400: v("red-400"),
        },
        amber: {
          100: v("amber-100"),
          200: v("amber-200"),
          300: v("amber-300"),
        },
        sky: {
          300: v("sky-300"),
        },
        emerald: {
          300: v("emerald-300"),
          400: v("emerald-400"),
        },
        sandlt: "#f6f1e7",
        sanddk: "#e6dcc9",
        terra: "#c4633f",
        terradk: "#a64f30",
        terraxd: "#8a4127",
        inkmut: "#6b6253",
        cobalt: {
          50: "#eff4ff",
          100: "#dbe6ff",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
        },
        paper: "#f8fafc",
        /* fixed near-black used for photo scrims; never follows the theme */
        scrim: "#1E242C",
        slatey: "#475569",
      },
      fontFamily: {
        /* The project self-hosts "Hind Siliguri" (app/fonts.css) and does not
           use next/font, so `--font-hind` / `--font-noto-bn` are never defined.
           A bare `var(--x)` without a fallback makes the whole declaration
           invalid-at-computed-value-time, which silently drops the entire
           stack and leaves the page in the browser default font. Each var()
           therefore carries the family it stands for as its fallback. */
        sans: [
          "Inter",
          'var(--font-hind, "Hind Siliguri")',
          'var(--font-noto-bn, "Noto Sans Bengali")',
          '"Hind Siliguri"',
          '"Noto Sans Bengali"',
          "system-ui",
          "sans-serif",
        ],
        bn: [
          'var(--font-hind, "Hind Siliguri")',
          'var(--font-noto-bn, "Noto Sans Bengali")',
          '"Hind Siliguri"',
          '"Noto Sans Bengali"',
          "system-ui",
          "sans-serif",
        ],
        display: [
          'var(--font-hind, "Hind Siliguri")',
          'var(--font-noto-bn, "Noto Sans Bengali")',
          '"Hind Siliguri"',
          '"Noto Sans Bengali"',
          "system-ui",
          "sans-serif",
        ],
      },
      /* two half-steps the UI uses for icon tiles and tight badges */
      spacing: {
        "4.5": "1.125rem",
        "13": "3.25rem",
      },
      /* opacity modifiers referenced by tint utilities (bg-amber-500/8, …) */
      opacity: {
        "8": "0.08",
        "12": "0.12",
        "98": "0.98",
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.75rem",
        "6xl": "3.25rem",
      },
      boxShadow: {
        /* ── Neumorphism ──────────────────────────────────────────────── */
        neu: "10px 10px 24px rgba(163,177,198,.52), -10px -10px 24px rgba(255,255,255,.95)",
        "neu-sm": "6px 6px 14px rgba(163,177,198,.48), -6px -6px 14px rgba(255,255,255,.92)",
        "neu-lg": "18px 18px 42px rgba(163,177,198,.55), -18px -18px 42px rgba(255,255,255,.98)",
        "neu-xs": "3px 3px 8px rgba(163,177,198,.42), -3px -3px 8px rgba(255,255,255,.9)",
        "neu-inset": "inset 6px 6px 12px rgba(163,177,198,.48), inset -6px -6px 12px rgba(255,255,255,.95)",
        "neu-inset-sm": "inset 3px 3px 7px rgba(163,177,198,.42), inset -3px -3px 7px rgba(255,255,255,.95)",
        "neu-inset-xs": "inset 2px 2px 5px rgba(163,177,198,.38), inset -2px -2px 5px rgba(255,255,255,.9)",
        "neu-accent": "8px 8px 20px rgba(35,114,79,.26), -8px -8px 20px rgba(255,255,255,.9)",
        "neu-accent-sm": "5px 5px 14px rgba(35,114,79,.24), -5px -5px 14px rgba(255,255,255,.9)",
        /* ── Legacy names kept working ───────────────────────────────── */
        soft: "0 18px 40px -20px rgba(112,123,137,.4)",
        glow: "0 0 0 1px rgba(47,143,102,.14), 12px 12px 28px -10px rgba(35,114,79,.28)",
        card: "10px 10px 24px rgba(163,177,198,.5), -10px -10px 24px rgba(255,255,255,.95), inset 0 1px 0 rgba(255,255,255,.9)",
        prem: "0 2px 4px rgba(48,57,67,.04), 0 14px 34px -14px rgba(48,57,67,.2)",
        premsoft: "0 2px 4px rgba(48,57,67,.04), 0 8px 22px -12px rgba(48,57,67,.16)",
        prembutn: "0 10px 22px -8px rgba(196,99,63,.45)",
        cardhi: "0 2px 4px rgba(48,57,67,.05), 0 28px 50px -22px rgba(112,123,137,.35)",
        navsh: "0 1px 0 rgba(48,57,67,.05)",
        pill: "0 8px 20px -8px rgba(47,143,102,.4)",
        lcard: "0 2px 4px rgba(48,57,67,.04), 0 14px 32px -16px rgba(112,123,137,.28)",
      },
      backgroundImage: {
        "leaf-radial": "radial-gradient(60% 60% at 50% 0%, rgba(47,143,102,.16), rgba(227,232,240,0) 70%)",
        "mint-line": "linear-gradient(90deg, transparent, rgba(47,143,102,.35), transparent)",
        "dot-grain": "radial-gradient(circle, rgba(48,57,67,.035) 1px, transparent 1px)",
        "neu-surface": "linear-gradient(145deg, #EEF2F8 0%, #E3E8F0 100%)",
        "neu-surface-sm": "linear-gradient(145deg, #EDF1F7 0%, #E4E9F1 100%)",
        "neu-accent": "linear-gradient(145deg, #3AA277 0%, #247A55 100%)",
        "neu-page":
          "radial-gradient(60% 45% at 50% -10%, rgba(255,255,255,.9), rgba(227,232,240,0) 65%), radial-gradient(45% 35% at 100% 0%, rgba(199,206,218,.4), rgba(227,232,240,0) 60%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        marquee: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        pop: {
          "0%": { transform: "scale(.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up .55s cubic-bezier(.22,1,.36,1) both",
        "fade-in": "fade-in .4s ease both",
        marquee: "marquee 32s linear infinite",
        float: "float 5s ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
        pop: "pop .2s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
