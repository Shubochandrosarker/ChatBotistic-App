"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTotalUnread } from "@/hooks/use-total-unread";
import {
  LayoutDashboard,
  MessageSquare,
  MessageSquareText,
  UserRound,
  Users,
  GitBranch,
  Radio,
  Zap,
  BookOpen,
  Sparkles,
  Settings,
  LogOut,
  User,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
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

// Grouped rather than one flat run of ten links: the sections mirror how
// the product actually splits — the live conversation surface, the
// outbound campaign tools, and everything that configures the chatbot
// itself. Ten undifferentiated rows forced users to read the whole list
// every time; three short ones are scannable at a glance.
const navSections: {
  heading: string;
  items: { href: string; label: string; icon: typeof LayoutDashboard }[];
}[] = [
  {
    heading: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    heading: "Conversations",
    items: [
      { href: "/inbox", label: "Inbox", icon: MessageSquare },
      { href: "/contacts", label: "Contacts", icon: Users },
      { href: "/pipelines", label: "Pipelines", icon: GitBranch },
    ],
  },
  {
    heading: "Campaigns",
    items: [
      { href: "/broadcasts", label: "Broadcasts", icon: Radio },
      { href: "/automations", label: "Automations", icon: Zap },
    ],
  },
  {
    heading: "Chatbot",
    items: [
      { href: "/widgets", label: "Widgets", icon: MessageSquareText },
      { href: "/agents", label: "Agents", icon: UserRound },
      { href: "/leads", label: "Leads", icon: Sparkles },
      { href: "/knowledge-base", label: "Knowledge Base", icon: BookOpen },
    ],
  },
];

const bottomNavItems = [
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  /** Controlled on mobile by the Header's hamburger button. Ignored on lg+. */
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const totalUnread = useTotalUnread();

  // Close the drawer when route changes — users opened it to navigate,
  // so once they pick a destination the drawer should get out of the way.
  useEffect(() => {
    onClose?.();
    // Only pathname drives this — onClose identity doesn't need to re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock body scroll and allow Escape to close while the drawer is open on
  // mobile. No-ops on desktop because the sidebar isn't positioned there.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  function renderNavLink(item: { href: string; label: string; icon: typeof LayoutDashboard }) {
    const isActive =
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href));
    const showUnreadDot =
      item.href === "/inbox" && totalUnread > 0 && !isActive;

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={isActive ? "page" : undefined}
          className={cn(
            "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors lg:py-2.5",
            isActive
              ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
              : "font-medium text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          )}
        >
          {/* Active accent bar */}
          <span
            className={cn(
              "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-opacity",
              isActive ? "opacity-100" : "opacity-0",
            )}
          />
          <item.icon
            className={cn(
              "h-[18px] w-[18px] shrink-0 transition-colors",
              isActive ? "text-primary" : "text-muted-foreground/80 group-hover:text-sidebar-foreground",
            )}
          />
          <span className="flex-1">{item.label}</span>
          {showUnreadDot && (
            <span
              aria-label={`${totalUnread} unread conversation${totalUnread === 1 ? "" : "s"}`}
              className="relative flex h-2 w-2"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
          )}
        </Link>
      </li>
    );
  }

  return (
    <>
      {/* Backdrop — mobile only, only when open. */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-foreground/40 backdrop-blur-sm transition-opacity lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar",
          "transition-transform duration-200 ease-out will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:z-0 lg:w-64 lg:translate-x-0 lg:transition-none",
        )}
        aria-label="Primary"
      >
        {/* Logo row */}
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 px-5">
          <Link href="/dashboard" aria-label="Chatbotistic — go to dashboard">
            <BrandLogo />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Main navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {navSections.map((section) => (
            <div key={section.heading} className="pb-1">
              <p className="px-3 pb-1.5 pt-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.heading}
              </p>
              <ul className="flex flex-col gap-1">
                {section.items.map(renderNavLink)}
              </ul>
            </div>
          ))}

          <div className="my-3 border-t border-sidebar-border" />

          <ul className="flex flex-col gap-1">
            {bottomNavItems.map(renderNavLink)}
          </ul>
        </nav>

        {/* User section */}
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-sidebar-accent focus:bg-sidebar-accent focus:outline-none data-popup-open:bg-sidebar-accent">
              <Avatar className="size-9 shrink-0">
                {profile?.avatar_url ? (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={profile.full_name ?? "Avatar"}
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                  {profile?.full_name?.charAt(0)?.toUpperCase() ??
                    profile?.email?.charAt(0)?.toUpperCase() ??
                    "U"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">
                  {profile?.full_name ?? "User"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {profile?.email ?? ""}
                </p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              sideOffset={6}
              className="min-w-56"
            >
              <DropdownMenuItem
                render={
                  <Link href="/settings?tab=profile" onClick={onClose} />
                }
              >
                <User className="size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link href="/settings?tab=whatsapp" onClick={onClose} />
                }
              >
                <Settings className="size-4" />
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
      </aside>
    </>
  );
}
