import type { Metadata } from "next";
import "./iframe.css";

export const metadata: Metadata = {
  title: "Pipedrive Integration",
  description: "Side Panel integration iframe",
};

export default function PipedriveFrameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
