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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TochatOperator, TochatWidget } from '@/lib/tochat/client';
import { resourceIdFromIri } from '@/lib/tochat/client';

interface AgentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: TochatOperator | null;
  /** The org's widgets, for the "attach to widget" picker. */
  widgets: TochatWidget[];
  onSaved: () => void;
}

/**
 * Create/edit dialog for a WhatsApp operator (agent). Every agent
 * attaches to exactly one widget — talks to /api/tochat/operators
 * (create) and /api/tochat/operators/{id} (update), which resolve and
 * verify that widget belongs to the caller's org server-side.
 */
export function AgentForm({ open, onOpenChange, agent, widgets, onSaved }: AgentFormProps) {
  const isEdit = !!agent?.id;

  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [post, setPost] = useState('');
  const [message, setMessage] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [chatform, setChatform] = useState(false);
  const [activateDirectlyChat, setActivateDirectlyChat] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNumber(agent?.number ?? '');
    setName(agent?.name ?? '');
    setBusinessId(
      (agent?.business ? resourceIdFromIri(agent.business) : null) ?? widgets[0]?.id ?? '',
    );
    setPost(agent?.post ?? '');
    setMessage(agent?.message ?? '');
    setIconUrl(agent?.iconUrl ?? '');
    setChatform(agent?.chatform ?? false);
    setActivateDirectlyChat(agent?.activateDirectlyChat ?? true);
  }, [open, agent, widgets]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Agent name is required');
      return;
    }
    if (!number.trim()) {
      toast.error('WhatsApp number is required');
      return;
    }
    if (!businessId) {
      toast.error('Select a widget to attach this agent to');
      return;
    }

    // null (not undefined) for cleared fields — undefined is dropped
    // by JSON.stringify, so an omitted key can't be told apart from
    // "leave this alone" and clearing the field wouldn't actually
    // clear it on Tochat.
    const payload = {
      number: number.trim(),
      name: name.trim(),
      business: businessId,
      post: post.trim() || null,
      message: message.trim() || null,
      iconUrl: iconUrl.trim() || null,
      chatform,
      activateDirectlyChat,
    };

    setSaving(true);
    try {
      const res = await fetch(
        isEdit ? `/api/tochat/operators/${agent!.id}` : '/api/tochat/operators',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save agent');
        return;
      }
      if (data.configured === false) {
        toast.error('Tochat.be is not connected — set TOCHAT_API_EMAIL / TOCHAT_API_PASSWORD.');
        return;
      }

      toast.success(isEdit ? 'Agent updated' : 'Agent created');
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
      <DialogContent className="bg-card border-border text-foreground sm:max-w-md max-h-[min(92dvh,880px)] w-[calc(100%-1rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEdit ? 'Edit Agent' : 'New Agent'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isEdit
              ? 'Update this WhatsApp agent on Tochat.be.'
              : 'Add a WhatsApp number as an agent on one of your widgets.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="af-name" className="text-foreground">
                Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="af-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sales team"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="af-number" className="text-foreground">
                WhatsApp number <span className="text-red-400">*</span>
              </Label>
              <Input
                id="af-number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="34627524218"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">
              Widget <span className="text-red-400">*</span>
            </Label>
            {widgets.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Create a widget first — agents attach to a widget.
              </p>
            ) : (
              <Select value={businessId} onValueChange={(val) => setBusinessId(val ?? '')}>
                <SelectTrigger className="w-full bg-muted border-border text-foreground">
                  <SelectValue placeholder="Select a widget" />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border">
                  {widgets.map((w) => (
                    <SelectItem
                      key={w.id}
                      value={w.id ?? ''}
                      className="text-foreground focus:bg-accent focus:text-foreground"
                    >
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="af-post" className="text-foreground">
                Job title
              </Label>
              <Input
                id="af-post"
                value={post}
                onChange={(e) => setPost(e.target.value)}
                placeholder="Sales"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="af-icon" className="text-foreground">
                Icon URL
              </Label>
              <Input
                id="af-icon"
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                placeholder="https://…/agent.png"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="af-message" className="text-foreground">
              Greeting message
            </Label>
            <Textarea
              id="af-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Book here your appointment"
              rows={2}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
            <div>
              <Label htmlFor="af-chatform" className="text-foreground">
                Collect a form first
              </Label>
              <p className="text-xs text-muted-foreground">
                Ask visitors for their details before opening WhatsApp.
              </p>
            </div>
            <Switch
              id="af-chatform"
              checked={chatform}
              onCheckedChange={(v) => setChatform(!!v)}
              aria-label="Collect a form first"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
            <div>
              <Label htmlFor="af-direct" className="text-foreground">
                Open chat directly
              </Label>
              <p className="text-xs text-muted-foreground">
                Skip the agent picker when this is the only/preferred agent.
              </p>
            </div>
            <Switch
              id="af-direct"
              checked={activateDirectlyChat}
              onCheckedChange={(v) => setActivateDirectlyChat(!!v)}
              aria-label="Open chat directly"
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
              disabled={saving || widgets.length === 0}
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
