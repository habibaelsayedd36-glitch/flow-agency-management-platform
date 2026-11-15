import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "FLOW Client Portal | Your products, in one flow",
  description: "A secure FLOW Agency workspace for products, projects, approvals, files, services and billing.",
  applicationName: "FLOW Client Portal",
  manifest: "/manifest.webmanifest",
  icons: { icon: "https://www.flow-agency-eg.com/assets/logo/flow-lockup-green.png", apple: "https://www.flow-agency-eg.com/assets/logo/flow-lockup-green.png" },
  themeColor: "#143c28",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "FLOW" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
