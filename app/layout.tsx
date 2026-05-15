import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Haus AI · Operations Hub",
  description: "Intern operationsplattform för Haus AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
