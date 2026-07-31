"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  BookOpen,
  Plus,
  Trash2,
  Loader2,
  FileText,
  AlertTriangle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/dashboard/empty-state"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface KbDocument {
  document_id: string
  title: string
  source: string | null
  chunk_count: number
  created_at: string
}

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<KbDocument[] | null>(null)
  const [configured, setConfigured] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<KbDocument | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    try {
      const res = await fetch("/api/ai/knowledge-base")
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? "Failed to load")
      setConfigured(body.configured !== false)
      setDocuments((body.documents ?? []) as KbDocument[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load knowledge base")
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    const res = await fetch(
      `/api/ai/knowledge-base?document_id=${encodeURIComponent(pendingDelete.document_id)}`,
      { method: "DELETE" },
    )
    setDeleting(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body?.error ?? "Failed to delete")
      return
    }
    toast.success("Document removed")
    setPendingDelete(null)
    load()
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-400">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  if (documents === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Knowledge Base</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Content the AI Reply step uses to answer customers. Add FAQs,
            product info, or policies — the chatbot retrieves the most
            relevant pieces for each question.
          </p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="bg-primary text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Add Document
        </Button>
      </div>

      {!configured && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
          <div className="text-sm">
            {/* These used to be amber-200/-100, which on the pale amber
                fill was all but unreadable in light mode. The warning
                token clears AA against the card in both themes. */}
            <p className="font-medium text-foreground">
              Cloudflare Workers AI is not configured
            </p>
            <p className="mt-1 text-muted-foreground">
              Set{" "}
              <code className="font-mono text-foreground">
                CLOUDFLARE_ACCOUNT_ID
              </code>{" "}
              and{" "}
              <code className="font-mono text-foreground">
                CLOUDFLARE_API_TOKEN
              </code>{" "}
              in your environment. Until then, documents cannot be embedded
              and the AI Reply step will skip sending.
            </p>
            <a
              href="https://github.com/shubochandrosarker/chatbotistic-app/blob/main/docs/cloudflare-workers-ai.md"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
            >
              Setup guide →
            </a>
          </div>
        </div>
      )}

      {documents.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No documents yet"
          hint="Add your first document so the AI chatbot has something to answer from."
        />
      ) : (
        <ul className="space-y-3">
          {documents.map((doc) => (
            <li
              key={doc.document_id}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <FileText className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">
                  {doc.title}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {doc.chunk_count} chunk{doc.chunk_count === 1 ? "" : "s"}
                  </span>
                  {doc.source && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="truncate">{doc.source}</span>
                    </>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete document"
                onClick={() => setPendingDelete(doc)}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AddDocumentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={load}
      />

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove document</DialogTitle>
            <DialogDescription>
              This permanently removes{" "}
              <span className="text-foreground">{pendingDelete?.title}</span> and all
              of its chunks from the knowledge base.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AddDocumentDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onAdded: () => void
}) {
  const [title, setTitle] = useState("")
  const [source, setSource] = useState("")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)

  function reset() {
    setTitle("")
    setSource("")
    setContent("")
  }

  async function submit() {
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required")
      return
    }
    setSaving(true)
    const res = await fetch("/api/ai/knowledge-base", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, source, content }),
    })
    const body = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      toast.error(body?.error ?? "Failed to add document")
      return
    }
    toast.success(`Document added (${body.chunk_count} chunks embedded)`)
    reset()
    onOpenChange(false)
    onAdded()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add document</DialogTitle>
          <DialogDescription>
            Paste any text — an FAQ, a policy, product details. It is split
            into chunks and embedded with Cloudflare Workers AI for retrieval.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Shipping & returns policy"
              className="bg-muted text-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Source (optional)
            </label>
            <Input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="https://example.com/faq"
              className="bg-muted text-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Content
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste the document text here…"
              className="min-h-48 bg-muted text-foreground"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="bg-primary text-primary-foreground"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
