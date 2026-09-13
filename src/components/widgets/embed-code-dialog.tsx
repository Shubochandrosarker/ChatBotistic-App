'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, Code2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { TochatWidget } from '@/lib/tochat/client';

interface EmbedCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widget: TochatWidget | null;
}

/**
 * Shows the branded loader. The app proxies the provider's public widget
 * JavaScript so customers never need to paste a provider-domain snippet.
 */
export function EmbedCodeDialog({ open, onOpenChange, widget }: EmbedCodeDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!widget?.id) return null;

  const snippet = `<script defer src="https://app.chatbotistic.com/install-widget/bundle.js?key=${encodeURIComponent(widget.id)}"></script>`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      toast.success('Embed code copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select and copy manually');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Code2 className="size-4.5 text-primary" />
            Embed &quot;{widget.name}&quot;
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Paste this one-line branded loader just before{' '}
            <code className="font-mono text-[13px]">&lt;/body&gt;</code> on
            any page you want the widget to appear on.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-3 pr-12 font-mono text-xs text-foreground">
              {snippet}
            </pre>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={handleCopy}
              className="absolute right-2 top-2 border-border bg-card"
              aria-label="Copy embed code"
            >
              {copied ? (
                <Check className="size-3.5 text-success" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">WordPress</p>
              <p className="mt-0.5">
                Install the Chatbotistic widget plugin and select this
                widget&apos;s id (
                <code className="font-mono text-[12px] text-foreground">
                  {widget.id}
                </code>
                ) as its widget key. The plugin uses the same branded loader.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">Google Tag Manager</p>
              <p className="mt-0.5">
                Create a Custom HTML tag with the snippet above, trigger it
                on All Pages, and publish.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">Any other site</p>
              <p className="mt-0.5">
                Paste the snippet directly into your HTML template, right
                before the closing{' '}
                <code className="font-mono text-[12px]">body</code> tag.
              </p>
            </div>
          </div>

          {!widget.active && (
            <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              This widget is currently paused — the script will load but
              the chat button won&apos;t appear until you activate it.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
