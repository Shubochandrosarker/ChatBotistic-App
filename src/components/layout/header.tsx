"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, Menu, Search, Settings as SettingsIcon, User } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/inbox": "Inbox",
  "/contacts": "Contacts",
  "/pipelines": "Pipelines",
  "/broadcasts": "Broadcasts",
  "/automations": "Automations",
  "/knowledge-base": "Knowledge Base",
  "/leads": "Leads",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const match = Object.entries(pageTitles).find(([path]) =>
    pathname.startsWith(path),
  );
  return match ? match[1] : "Dashboard";
}

interface HeaderProps {
  /** Wired to the shell's drawer state. Used only on mobile. */
  onOpenSidebar?: () => void;
  /** Opens the global command palette. */
  onOpenSearch?: () => void;
}

export function Header({ onOpenSidebar, onOpenSearch }: HeaderProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const title = getPageTitle(pathname);

  // Show the platform-correct shortcut hint (⌘K on macOS, Ctrl K else).
  // `navigator` is client-only, so this resolves as a post-mount sync.
  const [shortcut, setShortcut] = useState("Ctrl K");
  useEffect(() => {
    const isMac = /Mac|iP(hone|ad|od)/.test(navigator.platform);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShortcut(isMac ? "⌘ K" : "Ctrl K");
  }, []);

  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    "U";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {/* Hamburger — mobile only. */}
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open menu"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold tracking-tight text-foreground sm:text-lg">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Global search — opens the command palette (⌘K). */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:hidden"
        >
          <Search className="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          onClick={onOpenSearch}
          className="hidden h-9 w-56 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex lg:w-64"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium tracking-wide">
            {shortcut}
          </kbd>
        </button>

        <ThemeToggle />

        <div className="hidden h-6 w-px bg-border sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-muted focus:bg-muted focus:outline-none data-popup-open:bg-muted sm:gap-2.5 sm:pr-3"
            aria-label="Open account menu"
          >
            <Avatar className="size-8">
              {profile?.avatar_url ? (
                <AvatarImage
                  src={profile.avatar_url}
                  alt={profile.full_name ?? "Avatar"}
                />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {initial}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-semibold text-foreground sm:inline">
              {profile?.full_name ?? "User"}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="min-w-56">
            <div className="px-2 py-1.5">
              <p className="truncate text-sm font-semibold text-foreground">
                {profile?.full_name ?? "User"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {profile?.email ?? ""}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={<Link href="/settings?tab=profile" />}
            >
              <User className="size-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<Link href="/settings?tab=whatsapp" />}
            >
              <SettingsIcon className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
