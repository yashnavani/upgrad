"use client";

import { useRealtime } from "@/hooks/useRealtime";

/** Mount once under SessionProvider + NotificationFeedProvider. */
export function RealtimeConnection() {
  useRealtime();
  return null;
}
