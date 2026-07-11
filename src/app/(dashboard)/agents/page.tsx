'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { AgentForm } from '@/components/agents/agent-form';
import { resourceIdFromIri, type TochatOperator, type TochatWidget } from '@/lib/tochat/client';

interface OperatorsResponse {
  configured: boolean;
  operators?: TochatOperator[];
  error?: string;
}
interface WidgetsResponse {
  configured: boolean;
  widgets?: TochatWidget[];
  error?: string;
}

export default function AgentsPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [agents, setAgents] = useState<TochatOperator[]>([]);
  const [widgets, setWidgets] = useState<TochatWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<TochatOperator | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TochatOperator | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [operatorsRes, widgetsRes] = await Promise.all([
        fetch('/api/tochat/operators'),
        fetch('/api/tochat/widgets'),
      ]);
      const operatorsData: OperatorsResponse = await operatorsRes.json();
      const widgetsData: WidgetsResponse = await widgetsRes.json();

      if (!operatorsRes.ok) {
        setError(operatorsData.error ?? 'Failed to load agents');
        return;
      }
      setConfigured(operatorsData.configured);
      setAgents(operatorsData.operators ?? []);
      setWidgets(widgetsRes.ok ? (widgetsData.widgets ?? []) : []);
    } catch {
      setError('Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmDelete() {
    if (!pendingDelete?.id) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tochat/operators/${pendingDelete.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error ?? 'Failed to delete agent');
        return;
      }
      toast.success('Agent deleted');
      setPendingDelete(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  const widgetNameFor = (agent: TochatOperator) => {
    const widgetId = agent.business ? resourceIdFromIri(agent.business) : null;
    return widgets.find((w) => w.id === widgetId)?.name ?? '—';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The WhatsApp numbers customers reach through your widgets.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditAgent(null);
            setFormOpen(true);
          }}
          disabled={configured === false || widgets.length === 0}
          className="bg-primary text-primary-foreground hover:bg-primary"
        >
          <Plus className="h-4 w-4" />
          New Agent
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
          icon={UserRound}
          title="Tochat.be not connected"
          hint="Set TOCHAT_API_EMAIL and TOCHAT_API_PASSWORD in your environment, then restart the app to manage agents here."
        />
      ) : widgets.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="Create a widget first"
          hint="Agents attach to a widget — head to Widgets to create one."
        />
      ) : agents.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No agents yet"
          hint="Add a WhatsApp number so customers have someone to chat with."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <li
              key={agent.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <UserRound className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {agent.name}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {agent.number}
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
                    <DropdownMenuItem
                      onClick={() => {
                        setEditAgent(agent);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setPendingDelete(agent)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {agent.post && (
                <span className="w-fit rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                  {agent.post}
                </span>
              )}

              <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span>Widget</span>
                <span className="font-medium text-foreground">{widgetNameFor(agent)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AgentForm
        open={formOpen}
        onOpenChange={setFormOpen}
        agent={editAgent}
        widgets={widgets}
        onSaved={load}
      />

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
      >
        <DialogContent className="bg-card border-border text-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Agent</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This permanently removes{' '}
              <span className="text-foreground">{pendingDelete?.name}</span> from
              Tochat.be. This cannot be undone.
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
