'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  XCircle,
  Loader2,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Unlink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface LicenseStatus {
  configured: boolean;
  license_key_mask?: string;
  status?: string;
  product?: string | null;
  plan?: string | null;
  expires_at?: string | null;
  last_checked_at?: string | null;
}

/**
 * Activate / validate / deactivate the workspace's Chatbotistic
 * license key against the WPistic license server
 * (api.wpistic.com — the same server the WordPress plugin uses).
 *
 * The raw key is sent once on activation and never stored or shown
 * again — only a masked form (`WPIST-****-****-3F7A`). Entitlements
 * (plan, widget/agent limits) sync onto the workspace automatically.
 */
export function LicenseCard() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<LicenseStatus | null>(null);

  const [key, setKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [validating, setValidating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/licensing/status');
      const data = (await res.json()) as LicenseStatus;
      if (res.ok) setStatus(data);
    } catch {
      toast.error('Could not load the license status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function activate(e: React.FormEvent) {
    e.preventDefault();
    setActivating(true);
    try {
      const res = await fetch('/api/licensing/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Activation failed');
        return;
      }
      toast.success(
        data.valid
          ? `License activated — plan: ${data.plan ?? 'unknown'}`
          : `License server responded: ${data.status ?? 'not valid'}`,
      );
      setKey('');
      await load();
    } catch {
      toast.error('Network error during activation');
    } finally {
      setActivating(false);
    }
  }

  async function revalidate() {
    setValidating(true);
    try {
      const res = await fetch('/api/licensing/activate', { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Validation failed');
        return;
      }
      if (data.valid) {
        toast.success(`License valid — ${data.status}`);
      } else {
        toast.warning(`License check: ${data.status ?? 'invalid'}`);
      }
      await load();
    } catch {
      toast.error('Network error during validation');
    } finally {
      setValidating(false);
    }
  }

  async function deactivate() {
    if (!window.confirm('Deactivate the license for this workspace?')) return;
    setDeactivating(true);
    try {
      const res = await fetch('/api/licensing/deactivate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Deactivation failed');
        return;
      }
      toast.success('License deactivated');
      await load();
    } catch {
      toast.error('Network error during deactivation');
    } finally {
      setDeactivating(false);
    }
  }

  const active = status?.configured && status.status === 'active';
  const expiry = status?.expires_at
    ? new Date(status.expires_at).toLocaleDateString()
    : null;

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
          <KeyRound className="size-5 text-primary" />
          License
        </CardTitle>
        <CardDescription>
          Activate your Chatbotistic license key (from WPistic) to unlock your
          plan&apos;s widget and agent limits.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading license status…
          </div>
        ) : active ? (
          <Alert className="border-emerald-500/20 bg-emerald-500/5">
            <ShieldCheck className="size-4 text-emerald-600" />
            <AlertTitle>License active</AlertTitle>
            <AlertDescription>
              {status?.license_key_mask && (
                <span className="font-mono">{status.license_key_mask}</span>
              )}
              {status?.plan ? ` · Plan: ${status.plan}` : ''}
              {status?.product ? ` · ${status.product}` : ''}
              {expiry ? ` · Expires ${expiry}` : ''}
            </AlertDescription>
          </Alert>
        ) : status?.configured ? (
          <Alert className="border-amber-500/20 bg-amber-500/5">
            <XCircle className="size-4 text-amber-600" />
            <AlertTitle>License {status.status}</AlertTitle>
            <AlertDescription>
              The license server reports this workspace&apos;s license as{' '}
              <span className="font-medium">{status.status}</span>. Re-check or
              activate a new key below.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <ShieldOff className="size-4" />
            <AlertTitle>No license activated</AlertTitle>
            <AlertDescription>
              This workspace runs on the Free plan. Activate a license key to
              unlock your purchased limits.
            </AlertDescription>
          </Alert>
        )}

        {status?.configured && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={revalidate}
              disabled={validating}
              className="border-border text-foreground hover:bg-muted"
            >
              {validating ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 size-4" />
              )}
              Re-check
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deactivate}
              disabled={deactivating}
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              {deactivating ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Unlink className="mr-2 size-4" />
              )}
              Deactivate
            </Button>
          </div>
        )}

        <form onSubmit={activate} className="space-y-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="license-key" className="text-foreground">
              License key
            </Label>
            <div className="flex gap-2">
              <Input
                id="license-key"
                type="text"
                placeholder="WPIST-XXXX-XXXX-XXXX"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                required
                minLength={12}
                maxLength={120}
                className="border-border bg-muted font-mono text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
              <Button
                type="submit"
                disabled={activating || key.trim().length < 12}
                className="bg-primary text-primary-foreground hover:bg-primary"
              >
                {activating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  'Activate'
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Verified against api.wpistic.com — the same license server as the
            WordPress plugin. The key is stored masked; we keep only an
            encrypted activation token for renewals.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
