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

        pipedrive: {
          dropdown: {
            'menu-background': "var(--pipedrive-dropdown-menu-background)",
            'item-hover': "var(--pipedrive-dropdown-item-hover)",
            'button-hover': "var(--pipedrive-dropdown-button-hover)",
            'button-border': "var(--pipedrive-dropdown-button-border)",
          },
          button: {
            'green': "var(--pipedrive-button-green)",
            'green-hover': "var(--pipedrive-button-green-hover)",
            'red': "var(--pipedrive-button-red)",
            'red-hover': "var(--pipedrive-button-red-hover)",
            'text': "var(--pipedrive-button-text)",
          },
          general: {
            'primary-text': "var(--pipedrive-general-primary-text)",
          },
          hover: {
            'on-background': "var(--pipedrive-hover-on-background)",
            'on-foreground': "var(--pipedrive-hover-on-foreground)",
          }
        }
      },
    },
  },
  plugins: [],
} satisfies Config;
