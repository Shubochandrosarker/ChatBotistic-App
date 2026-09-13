'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Link2,
  Unplug,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AccountStatus {
  user_client: string;
  email: string | null;
  api_base: string | null;
  connected_at: string | null;
  verified_at: string | null;
}

/**
 * Connect this org's OWN white-label (tochat.be) account. Once
 * connected, every widget/agent/FAQ/booking query runs inside that
 * account — the org only ever sees its own data. Without a connected
 * account the dashboard runs on the platform's shared account, scoped
 * by the org's tenancy tag shown below.
 */
export function ChatbotisticAccount() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AccountStatus | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [leadsApiKey, setLeadsApiKey] = useState('');
  const [savingLeadsKey, setSavingLeadsKey] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/tochat/config');
      const data = await res.json();
      if (res.ok) setStatus(data.status as AccountStatus);
    } catch {
      toast.error('Could not load the Chatbotistic account status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);
    try {
      const res = await fetch('/api/tochat/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Could not connect the account');
        return;
      }
      setStatus(data.status as AccountStatus);
      setPassword('');
      toast.success('Chatbotistic account connected', {
        description: 'Your widgets, agents and analytics now run inside your own account.',
      });
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    if (!window.confirm('Disconnect your Chatbotistic account? Widget Studio falls back to the shared platform account.')) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await fetch('/api/tochat/config', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Could not disconnect');
        return;
      }
      setStatus(data.status as AccountStatus);
      toast.success('Account disconnected');
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setDisconnecting(false);
    }
  }

  async function saveLeadsKey(e: React.FormEvent) {
    e.preventDefault();
    setSavingLeadsKey(true);
    try {
      const res = await fetch('/api/tochat/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadsApiKey: leadsApiKey.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Could not save the leads key');
        return;
      }
      setLeadsApiKey('');
      toast.success(
        leadsApiKey.trim() ? 'Leads API key saved — the Leads page now shows only your leads' : 'Leads API key cleared',
      );
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setSavingLeadsKey(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }

  const connected = !!status?.email;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {connected ? (
              <CheckCircle2 className="size-5 text-green-600" />
            ) : (
              <XCircle className="size-5 text-muted-foreground" />
            )}
            White-label account
          </CardTitle>
          <CardDescription>
            Connect your own Chatbotistic white-label account so this dashboard only ever
            shows your widgets, agents and analytics — isolated at the API level, not by
            filters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connected ? (
            <>
              <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-1.5">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Account</span>
                  <span className="font-medium">{status?.email}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">API origin</span>
                  <span className="font-medium">{status?.api_base ?? 'https://services.tochat.be'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Connected</span>
                  <span className="font-medium">
                    {status?.connected_at
                      ? new Date(status.connected_at).toLocaleString()
                      : '—'}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0 mt-0.5" />
                Credentials are encrypted at rest (AES-256-GCM) and never sent to the
                browser. Disconnecting keeps your tenancy tag ({status?.user_client})
                intact.
              </div>
              <Button variant="outline" onClick={disconnect} disabled={disconnecting}>
                {disconnecting ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />}
                Disconnect
              </Button>
            </>
          ) : (
            <>
              <Alert>
                <AlertTitle>Not connected</AlertTitle>
                <AlertDescription>
                  Widget Studio currently runs on the platform&apos;s shared account, scoped
                  to your tenancy tag <code className="text-xs">{status?.user_client}</code>.
                  Connect your own account for full API-level isolation.
                </AlertDescription>
              </Alert>
              <form onSubmit={connect} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="cbt-email">Account email</Label>
                  <Input
                    id="cbt-email"
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="you@yourbusiness.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cbt-password">Password</Label>
                  <Input
                    id="cbt-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Your account connects securely to the Chatbotistic backend at services.tochat.be. The API origin is fixed to the approved backend and cannot be changed from this form.
                </p>
                <Button type="submit" disabled={connecting}>
                  {connecting ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                  Verify &amp; connect
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5" />
            Leads API key (optional)
          </CardTitle>
          <CardDescription>
            Your personal leads key from the white-label dashboard (API / integrations).
            When set, the Leads page pulls only your widgets&apos; captured leads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveLeadsKey} className="flex flex-wrap items-end gap-3 max-w-md">
            <div className="space-y-2 grow min-w-56">
              <Label htmlFor="cbt-leads-key">API key</Label>
              <Input
                id="cbt-leads-key"
                type="password"
                placeholder="paste to replace · leave empty and save to clear"
                value={leadsApiKey}
                onChange={(e) => setLeadsApiKey(e.target.value)}
              />
            </div>
            <Button type="submit" variant="outline" disabled={savingLeadsKey}>
              {savingLeadsKey && <Loader2 className="size-4 animate-spin" />}
              Save key
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
