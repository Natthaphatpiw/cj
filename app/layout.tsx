import type { Metadata } from "next";
import { Prompt, Sarabun } from "next/font/google";
import "./globals.css";

const sarabun = Sarabun({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body"
});

const prompt = Prompt({
  subsets: ["latin", "thai"],
  weight: ["500", "600", "700"],
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "ChordJai - AI Mental Health on LINE OA",
  description:
    "Official ChordJai landing page for AI-powered mental health support on LINE OA with safe follow-up experience."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${sarabun.variable} ${prompt.variable}`}>{children}</body>
    </html>
  );
}
