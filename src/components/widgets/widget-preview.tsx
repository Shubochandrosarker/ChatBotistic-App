'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TochatWidget } from '@/lib/tochat/client';

interface WidgetPreviewProps {
  widget: Partial<TochatWidget>;
  className?: string;
}

/**
 * A CSS-only mock of how the widget will look embedded on a real page
 * — not a sandboxed render of the actual load.js (that needs the
 * widget saved live on Tochat.be and this sandbox has no network path
 * to services.tochat.be to test that). Gives instant visual feedback
 * while editing without depending on the network at all.
 */
export function WidgetPreview({ widget, className }: WidgetPreviewProps) {
  const [expanded, setExpanded] = useState(!!widget.isopen);

  // Follow the "auto-open" toggle when it changes, but still let the
  // person previewing click to check the other state.
  useEffect(() => {
    setExpanded(!!widget.isopen);
  }, [widget.isopen]);

  const color = /^#[0-9a-fA-F]{3,8}$/.test(widget.color ?? '') ? widget.color! : '#27d974';
  const onRight = widget.rightpos !== false;
  const name = widget.name?.trim() || 'Your widget';
  const greeting = widget.widgetMessage?.trim() || 'Hi! How can we help?';
  const buttonLabel = widget.buttonMessage?.trim() || 'Send';

  return (
    <div
      className={cn(
        'relative flex h-full min-h-72 flex-col overflow-hidden rounded-xl border border-border bg-[repeating-linear-gradient(45deg,theme(colors.muted/40),theme(colors.muted/40)_10px,transparent_10px,transparent_20px)]',
        className,
      )}
    >
      {/* Fake browser chrome so this reads as "a page", not a blank box. */}
      <div className="flex items-center gap-1.5 border-b border-border bg-card px-3 py-2">
        <span className="size-2 rounded-full bg-red-400/70" />
        <span className="size-2 rounded-full bg-amber-400/70" />
        <span className="size-2 rounded-full bg-emerald-400/70" />
        <span className="ml-2 truncate rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          yoursite.com
        </span>
      </div>

      <div className="relative flex-1">
        {/* Chat panel */}
        {expanded && (
          <div
            className={cn(
              'absolute bottom-16 flex w-64 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg',
              onRight ? 'right-3' : 'left-3',
            )}
          >
            <div
              className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              <span className="truncate">{widget.legend?.trim() || name}</span>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label="Close preview"
                className="rounded p-0.5 hover:bg-white/15"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="space-y-2 bg-muted/30 p-3">
              <div className="max-w-[85%] rounded-lg rounded-tl-none bg-card px-2.5 py-1.5 text-xs text-foreground shadow-sm">
                {greeting}
              </div>
            </div>
            <div className="flex items-center gap-1.5 border-t border-border p-2">
              <div className="flex-1 rounded-full bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground">
                Type a message…
              </div>
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: color }}
                title={buttonLabel}
              >
                <Send className="size-3.5" />
              </span>
            </div>
          </div>
        )}

        {/* Launcher bubble */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse preview' : 'Expand preview'}
          className={cn(
            'absolute bottom-3 flex size-12 items-center justify-center overflow-hidden rounded-full text-white shadow-lg transition-transform hover:scale-105',
            onRight ? 'right-3' : 'left-3',
          )}
          style={{ backgroundColor: color }}
        >
          {widget.iconUrl ? (
            // Preview-only, arbitrary user-supplied URL — a plain <img> is
            // intentional here (next/image would require remotePatterns
            // config for domains we can't predict).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={widget.iconUrl}
              alt=""
              className="size-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <MessageCircle className="size-5" />
          )}
        </button>
      </div>
    </div>
  );
}
