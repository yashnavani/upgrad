import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

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
    "Luminous — manage agents, policies, and operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased">
        <NotificationFeedProvider>
          <RealtimeConnection />
          {children}
        </NotificationFeedProvider>
      </body>
    </html>
  );
}
