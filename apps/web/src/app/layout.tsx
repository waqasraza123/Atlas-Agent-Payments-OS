import type { ReactNode } from "react";
import type { Metadata } from "next";
import { atlasProduct } from "@atlas/config";
import "./globals.css";

export const metadata: Metadata = {
  title: atlasProduct.name,
  description: atlasProduct.summary
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
