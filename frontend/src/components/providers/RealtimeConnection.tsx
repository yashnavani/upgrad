"use client";

import { useRealtime } from "@/hooks/useRealtime";

/** Mount once under NotificationFeedProvider. */
export function RealtimeConnection() {
  useRealtime();
  return null;
}
