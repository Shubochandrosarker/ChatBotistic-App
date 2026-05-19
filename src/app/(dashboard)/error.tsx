"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 text-center ring-1 ring-foreground/[0.06] shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-heading text-lg font-semibold text-foreground">
          Something went wrong
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This page hit an unexpected error. You can retry — if it keeps
          happening, refresh or come back shortly.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground/70">
            Reference: {error.digest}
          </p>
        )}
        <Button onClick={reset} className="mt-5">
          <RotateCw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    </div>
  );
}
