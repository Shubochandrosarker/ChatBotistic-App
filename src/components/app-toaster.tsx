"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/components/theme-provider";

/** Toaster that follows the app's resolved theme. */
export function AppToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme}
      position="top-right"
      toastOptions={{
        className:
          "!bg-popover !text-popover-foreground !border !border-border",
      }}
    />
  );
}
