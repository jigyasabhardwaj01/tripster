import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAF7F2",
        ink: "#2B2A28",
        teal: {
          DEFAULT: "#155E63",
          50: "#e6eeee",
          100: "#cfe0e1",
          600: "#155E63",
          700: "#0f4a4e",
        },
        amber: {
          DEFAULT: "#E8823C",
          50: "#fdf1e7",
          100: "#fbe2cd",
          600: "#E8823C",
        },
        cardBorder: "#E4DED2",
        success: "#4C8C6B",
        attention: "#C0562F",
      },
      fontFamily: {
        headline: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-public-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        "page-fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "pulse-slow": "pulse-slow 2.8s ease-in-out infinite",
        "page-fade-in": "page-fade-in 250ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
