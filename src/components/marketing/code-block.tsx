"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  /** Short label shown in the block header, e.g. "cURL" or "Response". */
  label?: string;
  className?: string;
}

/** Dark-tinted code block with a copy button — reads well in both themes. */
export function CodeBlock({ code, label, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — quietly no-op.
    }
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-[oklch(0.185_0.018_168)] text-[13px] leading-relaxed dark:bg-[oklch(0.14_0.014_168)]",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-2">
        <span className="text-xs font-medium tracking-wide text-white/50 uppercase">
          {label ?? "Example"}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy code"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-success" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[oklch(0.9_0.008_162)]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
