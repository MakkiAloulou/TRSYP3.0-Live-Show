import type { Metadata } from "next";
import { Chakra_Petch, Russo_One, Share_Tech_Mono } from "next/font/google";
import "./globals.css";

const body = Chakra_Petch({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const display = Russo_One({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const mono = Share_Tech_Mono({
  variable: "--font-digits",
  subsets: ["latin"],
  weight: "400",
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
    <html lang="en" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
