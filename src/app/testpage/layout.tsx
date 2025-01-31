import type { Metadata } from "next";
import "./iframe.css";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Pipedrive Integration",
  description: "Custom Pipedrive integration iframe",
};

export default function PipedriveFrameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
