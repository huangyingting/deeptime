import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const cormorant = localFont({
  src: "../../public/assets/cormorant-garamond.ttf",
  variable: "--font-cormorant",
  display: "swap",
  weight: "300 700",
});

export const metadata: Metadata = {
  title: "Earth Through Deep Time",
  description:
    "Explore 4.567 billion years of Earth history on an interactive globe, with paleogeography, climate, fossils, and the story of life.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='13' fill='%2302030a' stroke='%23d8b36a'/%3E%3Cpath d='M8 20q5-10 9-4t7-3' fill='none' stroke='%23d8b36a'/%3E%3C/svg%3E",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cormorant.variable}>
      <body>{children}</body>
    </html>
  );
}
