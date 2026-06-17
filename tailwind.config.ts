import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./services/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ops: {
          bg: "#f4f6fb",
          ink: "#172033",
          muted: "#667085",
          line: "#d9dee8",
          panel: "#ffffff",
          accent: "#2563eb"
        }
      }
    }
  },
  plugins: []
};
export default config;
