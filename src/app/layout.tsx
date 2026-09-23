import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Customer Location Verification",
  description: "Verify a customer's address against their on-site GPS position.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
