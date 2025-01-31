import ReactQueryProvider from "@/components/ReactQueryProvider";
import "./globals.css";

export const metadata = {
  title: "Calint",
  description: "",
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
