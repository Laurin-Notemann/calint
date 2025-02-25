import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "pipedrive-dropwdown-border": "var(--pipedrive-dropwdown-border)",
        "pipedrive-hover-on-dropdown": "var(--pipedrive-hover-on-dropdown)",
        "pipedrive-hover-on-background": "var(--pipedrive-hover-on-background)",
        "pipedrive-hover-on-foreground": "var(--pipedrive-hover-on-foreground)",
        "pipedrive-primary-text": "var(--pipedrive-primary-text)",
        "pipedrive-text-button": "var(--pipedrive-text-button)",
        "pipedrive-green": "var(--pipedrive-green)",
        "pipedrive-green-hover": "var(--pipedrive-green-hover)",
        "pipedrive-red": "var(--pipedrive-red)",
        "pipedrive-red-hover": "var(--pipedrive-red-hover)",
      },
    },
  },
  plugins: [],
} satisfies Config;
