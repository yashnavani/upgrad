import type { Metadata } from "next";

import { AuthSessionProvider } from "@/components/providers/AuthSessionProvider";
import { NotificationFeedProvider } from "@/components/providers/NotificationFeedProvider";
import { RealtimeConnection } from "@/components/providers/RealtimeConnection";

import "./globals.css";

export const metadata: Metadata = {
  title: "Master Foundation",
  description: "AI-Native Enterprise Architecture",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="ambient-bg flex min-h-screen flex-col bg-background text-foreground antialiased">
        <AuthSessionProvider>
          <NotificationFeedProvider>
            <RealtimeConnection />
            {children}
          </NotificationFeedProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
