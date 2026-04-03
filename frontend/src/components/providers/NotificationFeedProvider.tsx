"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

export type FeedNotificationType = "success" | "warning" | "info";

export type FeedNotificationItem = {
  id: number;
  type: FeedNotificationType;
  title: string;
  body?: string;
  time: string;
  read: boolean;
};

type NotificationFeedContextValue = {
  notifications: FeedNotificationItem[];
  addNotification: (item: {
    type: FeedNotificationType;
    title: string;
    body?: string;
  }) => void;
  markAllRead: () => void;
};

const NotificationFeedContext = createContext<
  NotificationFeedContextValue | undefined
>(undefined);

export function useNotificationFeed() {
  const ctx = useContext(NotificationFeedContext);
  if (!ctx) {
    throw new Error(
      "useNotificationFeed must be used within NotificationFeedProvider"
    );
  }
  return ctx;
}

export function NotificationFeedProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<FeedNotificationItem[]>([]);

  const addNotification = useCallback(
    (item: { type: FeedNotificationType; title: string; body?: string }) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const time = new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date());
      setNotifications((prev) =>
        [{ id, ...item, time, read: false }, ...prev].slice(0, 50)
      );
    },
    []
  );

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  return (
    <NotificationFeedContext.Provider
      value={{ notifications, addNotification, markAllRead }}
    >
      {children}
    </NotificationFeedContext.Provider>
  );
}
