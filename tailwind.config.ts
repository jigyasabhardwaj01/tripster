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
    },
  },
  plugins: [],
};

export default config;
