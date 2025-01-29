import type { Metadata } from "next";
import './iframe.css'; 

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
      <body>{children}</body>
    </html>
  );
}
