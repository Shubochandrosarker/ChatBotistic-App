'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import type { TochatWidget } from '@/lib/tochat/client';

interface WidgetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widget?: TochatWidget | null;
  onSaved: () => void;
}

const DEFAULT_COLOR = '#27d974';

/**
 * Create/edit dialog for the Widget Studio v1 field set. Talks to
 * /api/tochat/widgets (create) and /api/tochat/widgets/{id} (update) —
 * the Tochat.be master credentials never reach the browser.
 */
export function WidgetForm({ open, onOpenChange, widget, onSaved }: WidgetFormProps) {
  const isEdit = !!widget?.id;

  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [rightpos, setRightpos] = useState(true);
  const [isopen, setIsopen] = useState(false);
  const [widgetMessage, setWidgetMessage] = useState('');
  const [buttonMessage, setButtonMessage] = useState('');
  const [offlineMessage, setOfflineMessage] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(widget?.name ?? '');
    setActive(widget?.active ?? true);
    setColor(widget?.color ?? DEFAULT_COLOR);
    setRightpos(widget?.rightpos ?? true);
    setIsopen(widget?.isopen ?? false);
    setWidgetMessage(widget?.widgetMessage ?? '');
    setButtonMessage(widget?.buttonMessage ?? '');
    setOfflineMessage(widget?.offlineMessage ?? '');
    setIconUrl(widget?.iconUrl ?? '');
  }, [open, widget]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Widget name is required');
      return;
    }

    const payload = {
      name: name.trim(),
      active,
      color,
      rightpos,
      isopen,
      widgetMessage: widgetMessage.trim() || undefined,
      buttonMessage: buttonMessage.trim() || undefined,
      offlineMessage: offlineMessage.trim() || undefined,
      iconUrl: iconUrl.trim() || undefined,
    };

    setSaving(true);
    try {
      const res = await fetch(
        isEdit ? `/api/tochat/widgets/${widget!.id}` : '/api/tochat/widgets',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save widget');
        return;
      }
      if (data.configured === false) {
        toast.error('Tochat.be is not connected — set TOCHAT_API_EMAIL / TOCHAT_API_PASSWORD.');
        return;
      }

      toast.success(isEdit ? 'Widget updated' : 'Widget created');
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEdit ? 'Edit Widget' : 'New Widget'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isEdit
              ? 'Update this WhatsApp widget on Tochat.be.'
              : 'Create a new WhatsApp chat widget on Tochat.be.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor="wf-name" className="text-foreground">
              Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="wf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sales widget"
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="wf-color" className="text-foreground">
                Brand color
              </Label>
              <div className="flex items-center gap-2">
                <input
                  id="wf-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-border bg-muted p-0.5"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="bg-muted border-border text-foreground"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wf-icon" className="text-foreground">
                Icon URL
              </Label>
              <Input
                id="wf-icon"
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                placeholder="https://…/icon.png"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wf-widget-message" className="text-foreground">
              Greeting message
            </Label>
            <Textarea
              id="wf-widget-message"
              value={widgetMessage}
              onChange={(e) => setWidgetMessage(e.target.value)}
              placeholder="Hi! How can we help?"
              rows={2}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="wf-button-message" className="text-foreground">
                Button label
              </Label>
              <Input
                id="wf-button-message"
                value={buttonMessage}
                onChange={(e) => setButtonMessage(e.target.value)}
                placeholder="Send"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-2">
              <Label htmlFor="wf-rightpos" className="text-foreground">
                Right side
              </Label>
              <Switch
                id="wf-rightpos"
                checked={rightpos}
                onCheckedChange={(v) => setRightpos(!!v)}
                aria-label="Position on the right"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wf-offline-message" className="text-foreground">
              Offline message
            </Label>
            <Textarea
              id="wf-offline-message"
              value={offlineMessage}
              onChange={(e) => setOfflineMessage(e.target.value)}
              placeholder="We're not online right now — leave your number and we'll get back to you."
              rows={2}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
            <div>
              <Label htmlFor="wf-isopen" className="text-foreground">
                Auto-open on load
              </Label>
              <p className="text-xs text-muted-foreground">
                Expands the chat window automatically for new visitors.
              </p>
            </div>
            <Switch
              id="wf-isopen"
              checked={isopen}
              onCheckedChange={(v) => setIsopen(!!v)}
              aria-label="Auto-open on load"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
            <Label htmlFor="wf-active" className="text-foreground">
              Active
            </Label>
            <Switch
              id="wf-active"
              checked={active}
              onCheckedChange={(v) => setActive(!!v)}
              aria-label="Active"
            />
          </div>

          <DialogFooter className="bg-card border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary hover:bg-primary text-primary-foreground"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
