"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Search,
  LayoutDashboard,
  MessageSquare,
  Users,
  GitBranch,
  Radio,
  Zap,
  Sparkles,
  BookOpen,
  Settings,
  Plus,
  Sun,
  Moon,
  CornerDownLeft,
  Loader2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/components/theme-provider";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: LucideIcon;
  group: string;
  perform: () => void;
}

/** Mirrors the sidebar nav so the palette stays a single source of truth. */
const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/pipelines", label: "Pipelines", icon: GitBranch },
  { href: "/broadcasts", label: "Broadcasts", icon: Radio },
  { href: "/automations", label: "Automations", icon: Zap },
  { href: "/leads", label: "Leads", icon: Sparkles },
  { href: "/knowledge-base", label: "Knowledge Base", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

const GROUP_ORDER = [
  "Navigation",
  "Actions",
  "Contacts",
  "Conversations",
  "Deals",
];

/**
 * Live search across contacts, conversations, and deals. RLS scopes
 * every query to the signed-in org, so no extra tenant filter is
 * needed here. Patterns are sanitised for PostgREST's `or()` grammar.
 */
async function searchRemote(
  query: string,
  go: (href: string) => void,
): Promise<CommandItem[]> {
  const db = createClient();
  const safe = query.replace(/[%,()]/g, " ").trim();
  if (!safe) return [];
  const term = `%${safe}%`;
  const out: CommandItem[] = [];

  const [contacts, conversations, deals] = await Promise.all([
    db
      .from("contacts")
      .select("id,name,phone,email,company")
      .or(
        `name.ilike.${term},phone.ilike.${term},email.ilike.${term},company.ilike.${term}`,
      )
      .limit(5),
    db
      .from("conversations")
      .select("id,last_message_text")
      .ilike("last_message_text", term)
      .limit(4),
    db
      .from("deals")
      .select("id,title,value,currency")
      .ilike("title", term)
      .limit(4),
  ]);

  for (const c of contacts.data ?? []) {
    out.push({
      id: `contact:${c.id}`,
      label: c.name || c.phone,
      sublabel: c.name ? c.phone : (c.company ?? c.email ?? "Contact"),
      icon: Users,
      group: "Contacts",
      perform: () => go(`/contacts?q=${encodeURIComponent(c.phone)}`),
    });
  }

  for (const v of conversations.data ?? []) {
    out.push({
      id: `conversation:${v.id}`,
      label: v.last_message_text?.trim() || "Conversation",
      sublabel: "Open in inbox",
      icon: MessageSquare,
      group: "Conversations",
      perform: () => go(`/inbox?c=${v.id}`),
    });
  }

  for (const d of deals.data ?? []) {
    const value =
      typeof d.value === "number"
        ? new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: d.currency || "USD",
            maximumFractionDigits: 0,
          }).format(d.value)
        : undefined;
    out.push({
      id: `deal:${d.id}`,
      label: d.title,
      sublabel: value ? `${value} · View on board` : "View on board",
      icon: GitBranch,
      group: "Deals",
      perform: () => go("/pipelines"),
    });
  }

  return out;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useTheme();

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [remote, setRemote] = useState<CommandItem[]>([]);
  const [searching, setSearching] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const reqRef = useRef(0);

  // The parent remounts this component on every open (via `key`), so
  // there's no stale state to reset — just focus the input on mount.
  useEffect(() => {
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, []);

  const run = useCallback(
    (fn: () => void) => {
      onOpenChange(false);
      fn();
    },
    [onOpenChange],
  );

  const go = useCallback(
    (href: string) => run(() => router.push(href)),
    [run, router],
  );

  const staticItems = useMemo<CommandItem[]>(() => {
    const nav: CommandItem[] = NAV.map((n) => ({
      id: `nav:${n.href}`,
      label: n.label,
      sublabel: "Go to page",
      icon: n.icon,
      group: "Navigation",
      perform: () => go(n.href),
    }));

    const actions: CommandItem[] = [
      {
        id: "action:broadcast",
        label: "New broadcast",
        sublabel: "Compose and send",
        icon: Plus,
        group: "Actions",
        perform: () => go("/broadcasts/new"),
      },
      {
        id: "action:automation",
        label: "New automation",
        sublabel: "Build a flow",
        icon: Plus,
        group: "Actions",
        perform: () => go("/automations/new"),
      },
      {
        id: "action:whatsapp",
        label: "Connect WhatsApp",
        sublabel: "Open settings",
        icon: Settings,
        group: "Actions",
        perform: () => go("/settings?tab=whatsapp"),
      },
      {
        id: "action:theme",
        label:
          resolvedTheme === "dark"
            ? "Switch to light theme"
            : "Switch to dark theme",
        sublabel: "Appearance",
        icon: resolvedTheme === "dark" ? Sun : Moon,
        group: "Actions",
        perform: () => run(toggleTheme),
      },
    ];

    return [...nav, ...actions];
  }, [go, run, toggleTheme, resolvedTheme]);

  const filteredStatic = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staticItems;
    return staticItems.filter((i) => i.label.toLowerCase().includes(q));
  }, [query, staticItems]);

  // Debounced live search. A monotonic request id discards stale
  // responses if the user keeps typing.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    // `searching` / `remote` are reset in the input's onChange so this
    // effect body stays free of synchronous setState.
    const id = ++reqRef.current;
    const timer = setTimeout(() => {
      void searchRemote(q, go)
        .then((items) => {
          if (id === reqRef.current) setRemote(items);
        })
        .catch((err) => {
          console.error("[command-palette] search failed:", err);
          if (id === reqRef.current) setRemote([]);
        })
        .finally(() => {
          if (id === reqRef.current) setSearching(false);
        });
    }, 220);
    return () => clearTimeout(timer);
  }, [query, go]);

  const items = useMemo(
    () => [...filteredStatic, ...remote],
    [filteredStatic, remote],
  );

  // Clamp on read — results shrink as the query narrows, so the stored
  // index can briefly point past the end. Deriving avoids a setState.
  const selected = items.length > 0 ? Math.min(active, items.length - 1) : 0;

  // Scroll the highlighted row into view on keyboard navigation.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const grouped = useMemo(() => {
    const byGroup = new Map<string, { item: CommandItem; index: number }[]>();
    items.forEach((item, index) => {
      const list = byGroup.get(item.group) ?? [];
      list.push({ item, index });
      byGroup.set(item.group, list);
    });
    return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({
      heading: g,
      rows: byGroup.get(g)!,
    }));
  }, [items]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[selected]?.perform();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>

        {/* Search input */}
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          {searching ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              const value = e.target.value;
              const longEnough = value.trim().length >= 2;
              setQuery(value);
              setActive(0);
              setSearching(longEnough);
              if (!longEnough) setRemote([]);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search contacts, conversations, deals, actions…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search"
          />
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {query.trim()
                ? "No results found."
                : "Type to search across your workspace."}
            </p>
          ) : (
            grouped.map((group) => (
              <div key={group.heading} className="mb-1 last:mb-0">
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.heading}
                </p>
                {group.rows.map(({ item, index }) => {
                  const Icon = item.icon;
                  const isActive = index === selected;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-index={index}
                      onMouseMove={() => setActive(index)}
                      onClick={() => item.perform()}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                          isActive
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {item.label}
                        </span>
                        {item.sublabel && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.sublabel}
                          </span>
                        )}
                      </span>
                      {isActive && (
                        <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint bar */}
        <div className="flex items-center gap-4 border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-card px-1 py-0.5 font-sans">
              ↑
            </kbd>
            <kbd className="rounded border border-border bg-card px-1 py-0.5 font-sans">
              ↓
            </kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-card px-1 py-0.5 font-sans">
              ↵
            </kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-card px-1 py-0.5 font-sans">
              esc
            </kbd>
            close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
