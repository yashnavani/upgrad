"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

import { useNotificationFeed } from "@/components/providers/NotificationFeedProvider";

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
 * Maintains a WebSocket to the API real-time bus (JWT in query string).
 * Incoming NOTIFICATION payloads are appended to the notification feed.
 */
export function useRealtime(): void {
  const { data: session, status } = useSession();
  const { addNotification } = useNotificationFeed();
  const socketRef = useRef<WebSocket | null>(null);
  const cleanupRef = useRef(false);

  useEffect(() => {
    cleanupRef.current = false;

    if (status !== "authenticated" || !session?.accessToken) {
      return undefined;
    }

    const token = session.accessToken;
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const wsUrl = `${apiOriginToRealtimeWsUrl(apiUrl)}?token=${encodeURIComponent(token)}`;

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

    return () => {
      cleanupRef.current = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [status, session?.accessToken, addNotification]);
}
