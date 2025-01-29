import ReactQueryProvider from "@/components/ReactQueryProvider";
import "./globals.css";

export const metadata = {
  title: "Floating Window Demo App",
  description: "Demo app for Pipedrive floating window",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>{children}</ReactQueryProvider>
      </body>
    </html>
  );
}
