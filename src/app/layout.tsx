import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "FLOW Client Portal | Your products, in one flow",
  description: "A secure FLOW Agency workspace for products, projects, approvals, files, services and billing.",
  applicationName: "FLOW Client Portal",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
