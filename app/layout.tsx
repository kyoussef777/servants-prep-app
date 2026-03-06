import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/navbar";
import { ProfilePhotoReminder } from "@/components/profile-photo-reminder";
import { Toaster } from "@/components/ui/sonner";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { PushNotificationPrompt } from "@/components/notifications/push-prompt";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "Servants Preparation Program",
  description: "Coptic Church Servants 2-Year Preparation Program Management",
  manifest: "/manifest.json",
  icons: {
    icon: '/sp-logo.avif',
    apple: '/sp-logo.avif',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Servants Prep",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e40af",
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
          <NotificationProvider />
          <Navbar />
          <ProfilePhotoReminder />
          {children}
          <PushNotificationPrompt />
          <Toaster />
          <Analytics />
          <SpeedInsights />
        </Providers>
      </body>
    </html>
  );
}
