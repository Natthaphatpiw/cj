import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LINE OA Mental Health SaaS",
  description: "LINE OA mental-health orchestration backend with safety layers"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
