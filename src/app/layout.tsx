import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finwin — Smart Finance Monitor",
  description: "Track your spending, stay on budget, and get AI-powered insights.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-body antialiased">
        {children}
      </body>
    </html>
  );
}
