'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Code2,
  Loader2,
  MessageSquareText,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/dashboard/empty-state';
import { WidgetForm } from '@/components/widgets/widget-form';
import { EmbedCodeDialog } from '@/components/widgets/embed-code-dialog';
import type { TochatWidget } from '@/lib/tochat/client';

interface WidgetsResponse {
  configured: boolean;
  widgets?: TochatWidget[];
  embedBaseUrl?: string;
  error?: string;
}

export default function WidgetsPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [widgets, setWidgets] = useState<TochatWidget[]>([]);
  const [embedBaseUrl, setEmbedBaseUrl] = useState('https://services.tochat.be');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editWidget, setEditWidget] = useState<TochatWidget | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TochatWidget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [embedWidget, setEmbedWidget] = useState<TochatWidget | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tochat/widgets');
      const data: WidgetsResponse = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load widgets');
      } else {
        setConfigured(data.configured);
        setWidgets(data.widgets ?? []);
        if (data.embedBaseUrl) setEmbedBaseUrl(data.embedBaseUrl);
      }
    } catch {
      setError('Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(widget: TochatWidget, next: boolean) {
    setWidgets((prev) =>
      prev.map((w) => (w.id === widget.id ? { ...w, active: next } : w)),
    );
    const res = await fetch(`/api/tochat/widgets/${widget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...widget, active: next }),
    });
    if (!res.ok) {
      setWidgets((prev) =>
        prev.map((w) => (w.id === widget.id ? { ...w, active: !next } : w)),
      );
      const body = await res.json().catch(() => ({}));
      toast.error(body?.error ?? 'Failed to update widget');
      return;
    }
    toast.success(next ? 'Widget activated' : 'Widget paused');
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tochat/widgets/${pendingDelete.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error ?? 'Failed to delete widget');
        return;
      }
      toast.success('Widget deleted');
      setPendingDelete(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Widgets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your Tochat.be WhatsApp chat widgets.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditWidget(null);
            setFormOpen(true);
          }}
          disabled={configured === false}
          className="bg-primary text-primary-foreground hover:bg-primary"
        >
          <Plus className="h-4 w-4" />
          New Widget
        </Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2">
          <p className="text-sm text-red-400">{error}</p>
          <Button variant="outline" onClick={load}>
            Retry
          </Button>
        </div>
      ) : configured === false ? (
        <EmptyState
          icon={MessageSquareText}
          title="Tochat.be not connected"
          hint="Set TOCHAT_API_EMAIL and TOCHAT_API_PASSWORD in your environment, then restart the app to manage widgets here."
        />
      ) : widgets.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="No widgets yet"
          hint="Create a widget to embed a WhatsApp chat button on your site."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {widgets.map((widget) => (
            <WidgetCard
              key={widget.id}
              widget={widget}
              onToggle={(next) => toggleActive(widget, next)}
              onEdit={() => {
                setEditWidget(widget);
                setFormOpen(true);
              }}
              onDelete={() => setPendingDelete(widget)}
              onEmbed={() => setEmbedWidget(widget)}
            />
          ))}
        </ul>
      )}

      <WidgetForm
        open={formOpen}
        onOpenChange={setFormOpen}
        widget={editWidget}
        onSaved={load}
      />

      <EmbedCodeDialog
        open={!!embedWidget}
        onOpenChange={(v) => !v && setEmbedWidget(null)}
        widget={embedWidget}
        embedBaseUrl={embedBaseUrl}
      />

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
      >
        <DialogContent className="bg-card border-border text-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Widget</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This permanently removes{' '}
              <span className="text-foreground">{pendingDelete?.name}</span> from
              Tochat.be. Any site embedding it will stop showing the chat
              button. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-card border-border">
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              className="border-border text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WidgetCard({
  widget,
  onToggle,
  onEdit,
  onDelete,
  onEmbed,
}: {
  widget: TochatWidget;
  onToggle: (next: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onEmbed: () => void;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: widget.color || '#27d974' }}
          >
            <MessageSquareText className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {widget.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {widget.rightpos === false ? 'Left side' : 'Right side'}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" className="shrink-0" />
            }
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEmbed}>
              <Code2 className="size-4" />
              Get embed code
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {widget.widgetMessage && (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {widget.widgetMessage}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs font-medium text-muted-foreground">
          {widget.active ? 'Active' : 'Paused'}
        </span>
        <Switch
          checked={!!widget.active}
          onCheckedChange={(v) => onToggle(!!v)}
          aria-label={widget.active ? 'Pause widget' : 'Activate widget'}
        />
      </div>
    </li>
  );
}
