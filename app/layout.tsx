import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/navbar";
import { CommandPalette } from "@/components/command-palette";
import { ViewAsMode } from "@/components/view-as-mode";
import { ProfilePhotoReminder } from "@/components/profile-photo-reminder";
import { Toaster } from "@/components/ui/sonner";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { PushNotificationPrompt } from "@/components/notifications/push-prompt";
import { SiteFooter } from "@/components/site-footer";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { NavigationTransition } from "@/components/navigation-transition";

export const metadata: Metadata = {
  title: "St. Mark Ministry Portal",
  description: "Shared portal for St. Mark Servants Prep and Sunday School ministries",
  manifest: "/manifest.json",
  icons: {
    icon: '/sp-logo.avif',
    apple: '/sp-logo.avif',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "St. Mark Portal",
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
        className={`${GeistSans.variable} ${GeistMono.variable} flex min-h-screen flex-col antialiased`}
        suppressHydrationWarning
      >
        <Providers>
          <NavigationTransition />
          {/* App chrome; `contents` preserves the flex layout while print:hidden keeps it off printouts. */}
          <div className="contents print:hidden">
            <NotificationProvider />
            <ViewAsMode />
            <Navbar />
            <CommandPalette />
            <ProfilePhotoReminder />
          </div>
          <div id="app-content" className="flex-1">{children}</div>
          <div className="contents print:hidden">
            <SiteFooter />
            <PushNotificationPrompt />
            <Toaster />
          </div>
          <Analytics />
          <SpeedInsights />
        </Providers>
      </body>
    </html>
  );
}
