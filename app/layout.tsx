import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/inter/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Levelgrid Enterprises Financial Records",
  description: "Daily sales, expenses and balances for Levelgrid Enterprises.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
