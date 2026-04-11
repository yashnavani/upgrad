import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { AuthSessionProvider } from "@/components/providers/AuthSessionProvider";
import { NotificationFeedProvider } from "@/components/providers/NotificationFeedProvider";
import { RealtimeConnection } from "@/components/providers/RealtimeConnection";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans-loaded",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Luminous | Enterprise SaaS",
  description:
    "Luminous glass interface — manage agents, policies, and operations with light & dark modes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
          <html
            lang="en"
            className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="ambient-bg enterprise-canvas flex min-h-screen flex-col bg-background text-foreground antialiased">
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
