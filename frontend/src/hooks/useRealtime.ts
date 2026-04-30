"use client";

import { useEffect, useRef } from "react";

import { useNotificationFeed } from "@/components/providers/NotificationFeedProvider";
import { apiClient } from "@/lib/api-client";
import type { MeDto } from "@/lib/dashboard-types";

function apiOriginToRealtimeWsUrl(apiUrl: string): string {
  const trimmed = apiUrl.replace(/\/$/, "");
  const origin = trimmed.endsWith("/api/v1")
    ? trimmed.slice(0, -"/api/v1".length)
    : trimmed.replace(/\/api\/v1\/?$/, "");
  const wsOrigin = origin.startsWith("https://")
    ? `wss://${origin.slice("https://".length)}`
    : origin.startsWith("http://")
      ? `ws://${origin.slice("http://".length)}`
      : `ws://${origin}`;
  return `${wsOrigin.replace(/\/$/, "")}/api/v1/realtime/ws`;
}

function mapPriority(
  priority: string | undefined
): "success" | "warning" | "info" {
  if (priority === "success") return "success";
  if (priority === "warning") return "warning";
  return "info";
}

/**
 * WebSocket to real-time bus (?user_id=…). Resolves id from NEXT_PUBLIC_SYSTEM_USER_ID or GET /users/me.
 */
export function useRealtime(): void {
  const { addNotification } = useNotificationFeed();
  const socketRef = useRef<WebSocket | null>(null);
  const cleanupRef = useRef(false);

  useEffect(() => {
    cleanupRef.current = false;

    let cancelled = false;

    const run = async () => {
      const fromEnv = (process.env.NEXT_PUBLIC_SYSTEM_USER_ID || "").trim();
      let userId = fromEnv;
      if (!userId) {
        try {
          const me = await apiClient<MeDto>("/users/me");
          userId = me.id;
        } catch {
          return;
        }
      }
      if (cancelled || !userId) return;

      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const baseWs = apiOriginToRealtimeWsUrl(apiUrl);
      const wsUrl = `${baseWs}?user_id=${encodeURIComponent(userId)}`;

      const connect = () => {
        if (cleanupRef.current) return;

        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data as string) as {
              type?: string;
              priority?: string;
              title?: string;
              message?: string;
            };
            if (data.type === "NOTIFICATION" && data.title) {
              addNotification({
                type: mapPriority(data.priority),
                title: data.title,
                body: data.message,
              });
            }
          } catch {
            /* ignore malformed frames */
          }
        };

        socket.onclose = () => {
          socketRef.current = null;
          if (!cleanupRef.current) {
            window.setTimeout(connect, 5000);
          }
        };

        socket.onerror = () => {
          socket.close();
        };
      };

      connect();
    };

    void run();

    return () => {
      cancelled = true;
      cleanupRef.current = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [addNotification]);
}
