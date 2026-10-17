import type { Metadata } from "next";
import { Host_Grotesk, Orbitron } from "next/font/google";
import "./globals.css";

// The TRSYP 3.0 pair, as on the admin portal's venue screens:
// Orbitron for headings and names, Host Grotesk for everything else.
const body = Host_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const display = Orbitron({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Polygame · TRSYP 3.0",
  description: "Live match screen for the Polygame challenge.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
