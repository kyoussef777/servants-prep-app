import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/navbar";
import { ProfilePhotoReminder } from "@/components/profile-photo-reminder";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Servants Preparation Program",
  description: "Coptic Church Servants 2-Year Preparation Program Management",
  icons: {
    icon: '/sp-logo.avif',
    apple: '/sp-logo.avif',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        <Providers>
          <Navbar />
          <ProfilePhotoReminder />
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
