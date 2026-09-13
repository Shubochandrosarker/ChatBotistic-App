'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, X, ArrowLeft, FileSearch, Globe2, Link2, FileText, Sparkles } from 'lucide-react';
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
import type { TochatFaqGroup, TochatOperator } from '@/lib/tochat/client';

interface FaqManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: TochatOperator | null;
}

interface FaqRow {
  question: string;
  answer: string;
}

function emptyRow(): FaqRow {
  return { question: '', answer: '' };
}

/**
 * Manage the FAQ groups attached to one agent — a simple two-pane
 * master/detail inside a single dialog rather than stacking multiple
 * dialogs, since a FAQ group is only ever edited in the context of
 * its agent.
 */
export function FaqManagerDialog({ open, onOpenChange, agent }: FaqManagerDialogProps) {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [groups, setGroups] = useState<TochatFaqGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TochatFaqGroup | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState<FaqRow[]>([emptyRow()]);
  const [sourceMode, setSourceMode] = useState<'manual' | 'sitemap' | 'urls' | 'text'>('manual');
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [urlsText, setUrlsText] = useState('');
  const [customText, setCustomText] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanMeta, setScanMeta] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!agent?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tochat/faq-groups?operatorId=${agent.id}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load FAQs');
      } else if (data.configured === false) {
        setError('Tochat.be is not connected.');
      } else {
        setGroups(data.faqGroups ?? []);
      }
    } catch {
      setError('Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, [agent?.id]);

  useEffect(() => {
    if (!open) return;
    setView('list');
    load();
  }, [open, load]);

  function startCreate() {
    setEditingId(null);
    setTitle('');
    setRows([emptyRow()]);
    setSourceMode('manual');
    setSitemapUrl('');
    setUrlsText('');
    setCustomText('');
    setScanMeta(null);
    setView('edit');
  }

  function startEdit(group: TochatFaqGroup) {
    setEditingId(group.id ?? null);
    setTitle(group.title ?? '');
    setRows(group.faqs?.length ? group.faqs.map((f) => ({ ...f })) : [emptyRow()]);
    setSourceMode('manual');
    setScanMeta(null);
    setView('edit');
  }

  async function handleScan() {
    if (!agent?.id || sourceMode === 'manual') return;
    setScanning(true);
    setScanMeta(null);
    try {
      const res = await fetch('/api/tochat/faq-groups/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorId: agent.id,
          mode: sourceMode,
          sitemapUrl: sourceMode === 'sitemap' ? sitemapUrl : undefined,
          urls: sourceMode === 'urls' ? urlsText.split(/[\n,]/).map((url) => url.trim()).filter(Boolean) : undefined,
          text: sourceMode === 'text' ? customText : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Could not generate FAQs');
        return;
      }
      setRows(data.faqs?.length ? data.faqs : [emptyRow()]);
      setTitle((current) => current.trim() || data.titleSuggestion || 'Website FAQs');
      setScanMeta(`${data.faqs?.length ?? 0} FAQs generated${data.sources?.length ? ` from ${data.sources.length} source${data.sources.length === 1 ? '' : 's'}` : ''}. Review them before saving.`);
      toast.success('FAQs generated');
    } catch {
      toast.error('Could not reach the FAQ scanner');
    } finally {
      setScanning(false);
    }
  }

  function updateRow(index: number, patch: Partial<FaqRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRow(index: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSave() {
    if (!agent?.id) return;
    if (!title.trim()) {
      toast.error('Give this FAQ group a title');
      return;
    }
    const faqs = rows
      .map((r) => ({ question: r.question.trim(), answer: r.answer.trim() }))
      .filter((r) => r.question && r.answer);
    if (faqs.length === 0) {
      toast.error('Add at least one question with an answer');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        editingId ? `/api/tochat/faq-groups/${editingId}` : '/api/tochat/faq-groups',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            editingId ? { title: title.trim(), faqs } : { title: title.trim(), faqs, operatorId: agent.id },
          ),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save FAQ group');
        return;
      }
      if (data.configured === false) {
        toast.error('Tochat.be is not connected.');
        return;
      }
      toast.success(editingId ? 'FAQ group updated' : 'FAQ group created');
      setView('list');
      load();
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(group: TochatFaqGroup) {
    if (!group.id) return;
    setDeletingId(group.id);
    try {
      const res = await fetch(`/api/tochat/faq-groups/${group.id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error ?? 'Failed to delete FAQ group');
        return;
      }
      if (body?.configured === false) {
        toast.error('Tochat.be is not connected.');
        return;
      }
      toast.success('FAQ group deleted');
      setPendingDelete(null);
      load();
    } finally {
      setDeletingId(null);
    }
  }

  if (!agent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            {view === 'edit' && (
              <button
                type="button"
                onClick={() => setView('list')}
                aria-label="Back to FAQ groups"
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            {view === 'list' ? `FAQs — ${agent.name}` : editingId ? 'Edit FAQ group' : 'New FAQ group'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {view === 'list'
              ? 'Frequently asked questions this agent answers automatically before handing off to WhatsApp.'
              : 'Create them manually or generate editable answers from trusted website content.'}
          </DialogDescription>
        </DialogHeader>

        {view === 'list' ? (
          <div className="space-y-3">
            <Button
              type="button"
              onClick={startCreate}
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary"
            >
              <Plus className="size-4" />
              New FAQ group
            </Button>

            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : groups.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No FAQ groups yet for this agent.
              </p>
            ) : (
              <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
                {groups.map((group) => (
                  <li
                    key={group.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{group.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.faqs?.length ?? 0} question{group.faqs?.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => startEdit(group)}
                        aria-label="Edit FAQ group"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setPendingDelete(group)}
                        disabled={deletingId === group.id}
                        className="text-destructive hover:text-destructive"
                        aria-label="Delete FAQ group"
                      >
                        {deletingId === group.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="faq-title" className="text-foreground">
                Group title
              </Label>
              <Input
                id="faq-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Frequently asked questions"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-start gap-2">
                <FileSearch className="mt-0.5 size-4 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">FAQ source</p>
                  <p className="text-xs text-muted-foreground">Generate a draft from your public content, then edit and save it to this agent.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-background/70 p-1 sm:grid-cols-4">
                {([
                  ['manual', 'Manual', FileText],
                  ['sitemap', 'Sitemap', Globe2],
                  ['urls', 'Website URLs', Link2],
                  ['text', 'Custom text', FileText],
                ] as const).map(([mode, label, Icon]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => { setSourceMode(mode); setScanMeta(null); }}
                    className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors ${sourceMode === mode ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {sourceMode === 'sitemap' && (
                <div className="space-y-2">
                  <Label htmlFor="faq-sitemap" className="text-xs text-muted-foreground">Sitemap URL</Label>
                  <Input id="faq-sitemap" value={sitemapUrl} onChange={(e) => setSitemapUrl(e.target.value)} placeholder="https://example.com/sitemap.xml" className="bg-background border-border text-foreground placeholder:text-muted-foreground" />
                </div>
              )}
              {sourceMode === 'urls' && (
                <div className="space-y-2">
                  <Label htmlFor="faq-urls" className="text-xs text-muted-foreground">Website URLs (one per line)</Label>
                  <Textarea id="faq-urls" value={urlsText} onChange={(e) => setUrlsText(e.target.value)} placeholder={'https://example.com/pricing\nhttps://example.com/support'} rows={3} className="bg-background border-border text-foreground placeholder:text-muted-foreground" />
                </div>
              )}
              {sourceMode === 'text' && (
                <div className="space-y-2">
                  <Label htmlFor="faq-custom-text" className="text-xs text-muted-foreground">Custom business information</Label>
                  <Textarea id="faq-custom-text" value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="Paste approved product, support, pricing, or policy information here." rows={5} className="bg-background border-border text-foreground placeholder:text-muted-foreground" />
                </div>
              )}
              {sourceMode !== 'manual' && (
                <Button type="button" size="sm" onClick={handleScan} disabled={scanning} className="bg-primary text-primary-foreground hover:bg-primary">
                  {scanning ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {scanning ? 'Scanning…' : 'Scan & generate FAQs'}
                </Button>
              )}
              {scanMeta && <p className="text-xs text-primary">{scanMeta}</p>}
            </div>

            <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
              {rows.map((row, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Question {i + 1}</Label>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        aria-label="Remove question"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <Input
                    value={row.question}
                    onChange={(e) => updateRow(i, { question: e.target.value })}
                    placeholder="Is there a real person that can help?"
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                  <Textarea
                    value={row.answer}
                    onChange={(e) => updateRow(i, { answer: e.target.value })}
                    placeholder="Yes, a real person is available to help you"
                    rows={2}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRows((prev) => [...prev, emptyRow()])}
                className="border-border text-foreground hover:bg-muted"
              >
                <Plus className="size-3.5" />
                Add question
              </Button>
            </div>
          </div>
        )}

        {view === 'edit' && (
          <DialogFooter className="bg-card border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setView('list')}
              className="border-border text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary text-primary-foreground"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>

      <Dialog open={!!pendingDelete} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete FAQ group</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This permanently removes{' '}
              <span className="text-foreground">{pendingDelete?.title}</span> from Tochat.be.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-card border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingDelete(null)}
              className="border-border text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => pendingDelete && handleDelete(pendingDelete)}
              disabled={!!deletingId}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingId && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
