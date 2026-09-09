import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import SessionControls from "@/components/SessionControls";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAIA Intelligence",
  description: "MAIA Intelligence Core - Sprint 1 Foundation Layer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <SessionControls />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
