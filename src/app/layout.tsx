import type { Metadata } from "next";
import { SupabaseSync } from "@/components/auth/SupabaseSync";
import "./globals.css";

export const metadata: Metadata = {
  title: "getaccent.io",
  description: "English pronunciation coaching for Korean speakers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SupabaseSync />
        {children}
      </body>
    </html>
  );
}
