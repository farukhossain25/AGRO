import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b0d0c",
          900: "#111312",
          850: "#151816",
          800: "#1a1e1c",
          700: "#242a27",
          600: "#333b37",
        },
        leaf: {
          50: "#eefaf3",
          100: "#d6f3e3",
          200: "#b7ead2",
          300: "#8eddb9",
          400: "#5ac797",
          500: "#33ab7b",
          600: "#1f7a4d",
          700: "#186140",
          800: "#124a32",
          900: "#0d3625",
        },
        sand: { 100: "#f7f4ec", 200: "#efe8d8", 300: "#e2d6bd" },
      },
      fontFamily: {
        bn: ["var(--font-hind)", "var(--font-noto-bn)", "Hind Siliguri", "Noto Sans Bengali", "system-ui", "sans-serif"],
        display: ["var(--font-hind)", "var(--font-noto-bn)", "Hind Siliguri", "Noto Sans Bengali", "system-ui", "sans-serif"],
      },
      borderRadius: { "4xl": "2rem", "5xl": "2.75rem" },
      boxShadow: {
        soft: "0 10px 40px -12px rgba(0,0,0,.55)",
        glow: "0 0 0 1px rgba(183,234,210,.14), 0 18px 50px -20px rgba(31,122,77,.55)",
        card: "0 1px 0 0 rgba(255,255,255,.04) inset, 0 20px 40px -28px rgba(0,0,0,.9)",
      },
      backgroundImage: {
        "leaf-radial":
          "radial-gradient(60% 60% at 50% 0%, rgba(31,122,77,.35) 0%, rgba(17,19,18,0) 70%)",
        "mint-line": "linear-gradient(90deg, transparent, rgba(183,234,210,.5), transparent)",
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
