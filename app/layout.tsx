import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "SemanticLens | Image Retrieval",
  description: "NLP-powered image and annotation retrieval for CLEF iaprtc12."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}