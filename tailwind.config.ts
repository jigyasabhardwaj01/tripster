import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f9f6",
          100: "#d9efe6",
          500: "#0f9d78",
          600: "#0c7f61",
          700: "#0a664e",
        },
      },
    },
  },
  plugins: [],
};

export default config;
