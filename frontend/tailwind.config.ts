import type { Config } from "tailwindcss";

/** Maps a semantic name onto its `--c-*` channel-triplet primitive in globals.css,
 *  giving Tailwind full alpha support (`bg-ink/60` etc.) that a plain `var(--x)`
 *  string can't provide in Tailwind v3. */
const ch = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        page: ch("page"),
        surface: {
          DEFAULT: ch("surface"),
          2: ch("surface-2"),
        },
        line: {
          DEFAULT: ch("border"),
          mid: ch("border-mid"),
        },
        ink: {
          DEFAULT: ch("ink"),
          dim: ch("ink-dim"),
          faint: ch("ink-faint"),
        },
        accent: {
          DEFAULT: ch("accent"),
          ink: ch("accent-ink"),
        },
        success: ch("success"),
        warn: ch("warn"),
        danger: ch("danger"),
        scrim: ch("scrim"),
        hero: {
          DEFAULT: "var(--hero-bg)",
          ink: "var(--hero-text)",
        },
      },

      borderRadius: {
        field: "10px",  // inputs, search boxes, small controls
        card: "16px",   // the app card radius — one value, everywhere
        panel: "24px",  // dashboard tables, modals, big containers
        hero: "32px",   // marketing CTA / showcase slabs only
      },

      boxShadow: {
        card: "0 8px 32px rgb(var(--c-ink) / 0.06)",
        "card-hi": "0 16px 44px rgb(var(--c-ink) / 0.10)",
        pop: "0 24px 60px rgb(var(--c-ink) / 0.18)",
        cta: "0 10px 30px rgb(var(--c-ink) / 0.18)",
        hero: "0 24px 70px rgb(var(--c-ink) / 0.18)",
        focus: "0 0 0 3px var(--focus-ring)",
      },

      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },

      fontSize: {
        "display-xs": ["1.25rem", { lineHeight: "1.35", letterSpacing: "-0.01em" }],
        "display-sm": ["1.625rem", { lineHeight: "1.25", letterSpacing: "-0.015em" }],
        "display-md": ["2.125rem", { lineHeight: "1.18", letterSpacing: "-0.02em" }],
        "display-lg": ["3rem", { lineHeight: "1.10", letterSpacing: "-0.025em" }],
        "display-xl": ["3.75rem", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
        eyebrow: ["0.6875rem", { lineHeight: "1.2", letterSpacing: "0.09em" }],
      },

      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
        soft: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      transitionDuration: {
        250: "250ms",
        400: "400ms",
      },

      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        bounceDot: {
          "0%, 80%, 100%": { transform: "translateY(0)", opacity: ".4" },
          "40%": { transform: "translateY(-5px)", opacity: "1" },
        },
        wave: {
          "0%, 100%": { transform: "scaleY(.3)", opacity: ".5" },
          "50%": { transform: "scaleY(1)", opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: ".5" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fadeUp .35s cubic-bezier(0.22,1,0.36,1) both",
        blink: "blink 1s step-end infinite",
        "bounce-dot": "bounceDot 1.2s ease-in-out infinite",
        wave: "wave .9s ease-in-out infinite",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
