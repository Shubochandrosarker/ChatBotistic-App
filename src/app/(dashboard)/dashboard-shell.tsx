"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CommandPalette } from "@/components/command/command-palette";
import { AppShellSkeleton } from "@/components/skeletons";
import { SupportBubble } from "@/components/support/support-bubble";

// Auth-gated dashboard shell. Extracted from the layout so the layout
// itself can stay a server component and export metadata (noindex) —
// client components can't export Next's metadata object.

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Sidebar drawer state — only used on mobile. On lg+ the sidebar is
  // always visible and this stays at `false` (ignored by the component).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Global command palette (⌘K / Ctrl+K). `commandKey` bumps on every
  // open so the palette remounts fresh — no stale query to reset.
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandKey, setCommandKey] = useState(0);

  const openCommand = useCallback(() => {
    setCommandKey((k) => k + 1);
    setCommandOpen(true);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Belt-and-braces: make sure this user owns a workspace org. Covers
  // accounts created before migration 021 and any auth path that skipped
  // provisioning — without an org every dashboard API call 404s. Silent,
  // fire-and-forget; a no-op when the org already exists.
  const [orgEnsured, setOrgEnsured] = useState(false);
  useEffect(() => {
    if (!loading && user && !orgEnsured) {
      setOrgEnsured(true);
      void fetch("/api/auth/ensure-org", { method: "POST" }).catch(() => {});
    }
  }, [user, loading, orgEnsured]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((prev) => {
          if (!prev) setCommandKey((k) => k + 1);
          return !prev;
        });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Branded splash — a skeleton of the real layout so the first paint
  // matches the final app with no spinner-to-app jump.
  if (loading) {
    return <AppShellSkeleton />;
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Keyboard-only skip link — first tab stop jumps past the chrome. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to main content
      </a>
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenSearch={openCommand}
        />
        {/* Thinner horizontal padding on mobile so cards have room to breathe. */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto p-4 outline-none sm:p-6"
        >
          {children}
        </main>
      </div>
      <CommandPalette
        key={commandKey}
        open={commandOpen}
        onOpenChange={setCommandOpen}
      />
      {/* Rendered inside the auth gate, so it only ever appears to a
          signed-in user — the assistant is account help, not a public
          sales widget. */}
      <SupportBubble />
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </AuthProvider>
  );
}
