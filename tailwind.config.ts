import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#142033",
        forest: "#2563eb",
        lime: "#c8dbff",
        sand: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        content: "rgb(var(--content) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
      },
      boxShadow: { sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)", card: "0 1px 2px rgba(10,20,35,.04), 0 8px 24px rgba(10,20,35,.04)" },
    },
  },
  plugins: [],
} satisfies Config;
