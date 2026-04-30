"use client";

import { AlertTriangle, Bell, CheckCircle2, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  type FeedNotificationItem,
  useNotificationFeed,
} from "@/components/providers/NotificationFeedProvider";
import { cn } from "@/lib/utils";

function NotificationIcon({ type }: { type: FeedNotificationItem["type"] }) {
  switch (type) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
}

export function NotificationCenter() {
  const { notifications, markAllRead } = useNotificationFeed();
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          "text-muted-foreground outline-none transition-colors",
          "hover:bg-muted hover:text-foreground",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-background bg-destructive" />
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        className="w-80 rounded-2xl border border-border bg-card p-0 shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllRead}
              className="h-auto p-0 text-xs text-primary hover:bg-transparent"
            >
              Mark all read
            </Button>
          )}
        </div>
        <div className="hide-scrollbar max-h-[300px] space-y-1 overflow-y-auto p-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-muted/50",
                n.read ? "opacity-70" : "bg-primary/5"
              )}
            >
              <div className="mt-0.5 rounded-lg border border-border bg-background p-1.5 shadow-sm">
                <NotificationIcon type={n.type} />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm leading-none font-medium text-foreground">
                  {n.title}
                </p>
                {n.body ? (
                  <p className="text-xs leading-snug text-muted-foreground">
                    {n.body}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">{n.time}</p>
              </div>
              {!n.read && (
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
              )}
            </div>
          ))}
          {notifications.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {"You're all caught up!"}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
