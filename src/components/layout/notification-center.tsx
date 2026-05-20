"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  Radio,
  Zap,
  MessageSquare,
  CheckCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const SEEN_KEY = "wpistic-notifs-seen";

type NotificationTone = "danger" | "info";

interface Notification {
  id: string;
  tone: NotificationTone;
  icon: LucideIcon;
  title: string;
  detail: string;
  href: string;
  at: string;
}

/**
 * Loads everything that warrants the user's attention: failed
 * broadcasts, failed or partial automation runs, and conversations
 * with unread inbound messages. All queries are RLS-scoped to the org.
 */
async function loadNotifications(): Promise<Notification[]> {
  const db = createClient();
  const items: Notification[] = [];

  const [broadcasts, logs, conversations] = await Promise.all([
    db
      .from("broadcasts")
      .select("id,name,created_at,failed_count")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(5),
    db
      .from("automation_logs")
      .select("id,trigger_event,error_message,created_at,status")
      .in("status", ["failed", "partial"])
      .order("created_at", { ascending: false })
      .limit(5),
    db
      .from("conversations")
      .select("id,unread_count,last_message_at,contact:contacts(name,phone)")
      .gt("unread_count", 0)
      .order("last_message_at", { ascending: false })
      .limit(5),
  ]);

  for (const b of broadcasts.data ?? []) {
    items.push({
      id: `broadcast:${b.id}`,
      tone: "danger",
      icon: Radio,
      title: "Broadcast failed",
      detail: b.name,
      href: `/broadcasts/${b.id}`,
      at: b.created_at,
    });
  }

  for (const l of logs.data ?? []) {
    items.push({
      id: `automation:${l.id}`,
      tone: "danger",
      icon: Zap,
      title:
        l.status === "partial"
          ? "Automation ran with errors"
          : "Automation run failed",
      detail: l.error_message || `Trigger: ${l.trigger_event}`,
      href: `/automations`,
      at: l.created_at,
    });
  }

  for (const c of conversations.data ?? []) {
    const contact = Array.isArray(c.contact) ? c.contact[0] : c.contact;
    const who = contact?.name || contact?.phone || "A contact";
    items.push({
      id: `conversation:${c.id}`,
      tone: "info",
      icon: MessageSquare,
      title: `${c.unread_count} unread message${c.unread_count === 1 ? "" : "s"}`,
      detail: `from ${who}`,
      href: `/inbox?c=${c.id}`,
      at: c.last_message_at || new Date(0).toISOString(),
    });
  }

  return items.sort((a, b) => b.at.localeCompare(a.at));
}

export function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [unseen, setUnseen] = useState(0);

  const refresh = useCallback(() => {
    void loadNotifications()
      .then((next) => {
        setItems(next);
        const seen = window.localStorage.getItem(SEEN_KEY) ?? "";
        setUnseen(next.filter((n) => n.at > seen).length);
      })
      .catch((err) => {
        console.error("[notifications] load failed:", err);
        setItems([]);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Mark everything seen when the panel opens.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      refresh();
      if (items && items.length > 0) {
        window.localStorage.setItem(SEEN_KEY, items[0].at);
      } else {
        window.localStorage.setItem(SEEN_KEY, new Date().toISOString());
      }
      setUnseen(0);
    }
  }

  function handleSelect(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        aria-label={
          unseen > 0 ? `Notifications, ${unseen} new` : "Notifications"
        }
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-none data-popup-open:bg-muted"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unseen > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-heading text-sm font-semibold text-foreground">
            Notifications
          </p>
          {items && items.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {items.length} item{items.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="max-h-[22rem] overflow-y-auto">
          {items === null ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCheck className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-foreground">All caught up</p>
              <p className="text-xs text-muted-foreground">
                No failures or unread messages right now.
              </p>
            </div>
          ) : (
            <ul className="stagger-children divide-y divide-border">
              {items.map((n) => {
                const Icon = n.icon;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(n.href)}
                      className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          n.tone === "danger"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-primary/10 text-primary",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">
                          {n.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {n.detail}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground/70">
                          {relativeTime(n.at)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return "";
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "";
  }
}
