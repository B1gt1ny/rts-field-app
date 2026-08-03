import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211c",
        forest: "#174f3a",
        lime: "#d7f04a",
        sand: "#f4f2eb",
      },
      boxShadow: { card: "0 1px 2px rgba(23,33,28,.06), 0 8px 24px rgba(23,33,28,.05)" },
    },
  },
  plugins: [],
} satisfies Config;
