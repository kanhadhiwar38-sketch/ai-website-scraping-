import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0b0d10",
        surface: "#14171c",
        border: "#242830",
        primary: "#5b8cff",
      },
    },
  },
  plugins: [],
};

export default config;
