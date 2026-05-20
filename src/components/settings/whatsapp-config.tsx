'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Zap,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import type { WhatsAppConfig as WhatsAppConfigType } from '@/types';

const MASKED_TOKEN = '••••••••••••••••';

type ConnectionStatus = 'connected' | 'disconnected' | 'unknown';
type ResetReason = 'token_corrupted' | 'provider_error' | null;
type Provider = 'meta' | 'twilio' | 'jasmin';

export function WhatsAppConfig() {
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [config, setConfig] = useState<WhatsAppConfigType | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [resetReason, setResetReason] = useState<ResetReason>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const [provider, setProvider] = useState<Provider>('meta');

  // Meta credentials
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');

  // Twilio credentials
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioWhatsappNumber, setTwilioWhatsappNumber] = useState('');
  const [twilioMessagingServiceSid, setTwilioMessagingServiceSid] = useState('');

  // Self-hosted SMS gateway (Jasmin) credentials
  const [jasminBaseUrl, setJasminBaseUrl] = useState('');
  const [jasminUsername, setJasminUsername] = useState('');
  const [jasminPassword, setJasminPassword] = useState('');
  const [jasminDefaultSender, setJasminDefaultSender] = useState('');

  // SMS compliance + A2P/TCR registration (SMS gateway provider)
  const [smsQuietStart, setSmsQuietStart] = useState('');
  const [smsQuietEnd, setSmsQuietEnd] = useState('');
  const [smsTimezone, setSmsTimezone] = useState('America/New_York');
  const [a2pBrandId, setA2pBrandId] = useState('');
  const [a2pCampaignId, setA2pCampaignId] = useState('');
  const [a2pStatus, setA2pStatus] = useState('unregistered');
  const [smsWidgetKey, setSmsWidgetKey] = useState('');
  const [savingCompliance, setSavingCompliance] = useState(false);

  // True once the user has typed into the masked secret field, meaning a
  // fresh secret is available to send (the API needs it to re-verify).
  const [tokenEdited, setTokenEdited] = useState(false);

  const webhookPath =
    provider === 'twilio'
      ? '/api/whatsapp/twilio-webhook'
      : provider === 'jasmin'
        ? '/api/sms/webhook'
        : '/api/whatsapp/webhook';
  const webhookUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${webhookPath}` : '';

  const fetchConfig = useCallback(
    async (userId: string) => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('whatsapp_config')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          console.error('Failed to load config row:', error);
        }

        if (data) {
          setConfig(data);
          setProvider(data.provider === 'twilio' ? 'twilio' : 'meta');
          setPhoneNumberId(data.phone_number_id || '');
          setWabaId(data.waba_id || '');
          setAccessToken(data.access_token ? MASKED_TOKEN : '');
          setVerifyToken('');
          setTwilioAccountSid(data.twilio_account_sid || '');
          setTwilioAuthToken(data.twilio_auth_token ? MASKED_TOKEN : '');
          setTwilioWhatsappNumber(data.twilio_whatsapp_number || '');
          setTwilioMessagingServiceSid(data.twilio_messaging_service_sid || '');
          setJasminBaseUrl(data.jasmin_base_url || '');
          setJasminUsername(data.jasmin_username || '');
          setJasminPassword(data.jasmin_password ? MASKED_TOKEN : '');
          setJasminDefaultSender(data.jasmin_default_sender || '');
          setSmsQuietStart(
            data.sms_quiet_hours_start != null
              ? String(data.sms_quiet_hours_start)
              : ''
          );
          setSmsQuietEnd(
            data.sms_quiet_hours_end != null
              ? String(data.sms_quiet_hours_end)
              : ''
          );
          setSmsTimezone(data.sms_timezone || 'America/New_York');
          setA2pBrandId(data.a2p_brand_id || '');
          setA2pCampaignId(data.a2p_campaign_id || '');
          setA2pStatus(data.a2p_status || 'unregistered');
          setSmsWidgetKey(data.sms_widget_key || '');
          setTokenEdited(false);
        } else {
          setConfig(null);
          setPhoneNumberId('');
          setWabaId('');
          setAccessToken('');
          setVerifyToken('');
          setTwilioAccountSid('');
          setTwilioAuthToken('');
          setTwilioWhatsappNumber('');
          setTwilioMessagingServiceSid('');
          setJasminBaseUrl('');
          setJasminUsername('');
          setJasminPassword('');
          setJasminDefaultSender('');
          setSmsQuietStart('');
          setSmsQuietEnd('');
          setSmsTimezone('America/New_York');
          setA2pBrandId('');
          setA2pCampaignId('');
          setA2pStatus('unregistered');
          setSmsWidgetKey('');
          setTokenEdited(false);
        }

        if (data) {
          try {
            const res = await fetch('/api/whatsapp/config', { method: 'GET' });
            const payload = await res.json();

            if (payload.connected) {
              setConnectionStatus('connected');
              setResetReason(null);
              setStatusMessage('');
            } else {
              setConnectionStatus('disconnected');
              setResetReason(
                payload.needs_reset
                  ? 'token_corrupted'
                  : payload.reason === 'provider_error'
                    ? 'provider_error'
                    : null
              );
              setStatusMessage(payload.message || '');
            }
          } catch (err) {
            console.error('Health check failed:', err);
            setConnectionStatus('disconnected');
          }
        } else {
          setConnectionStatus('disconnected');
          setResetReason(null);
          setStatusMessage('');
        }
      } catch (err) {
        console.error('fetchConfig error:', err);
        toast.error('Failed to load WhatsApp configuration');
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetchConfig(user.id);
  }, [authLoading, user, fetchConfig]);

  async function handleSave() {
    let payload: Record<string, unknown>;

    if (provider === 'twilio') {
      if (!twilioAccountSid.trim()) {
        toast.error('Twilio Account SID is required');
        return;
      }
      if (!twilioWhatsappNumber.trim() && !twilioMessagingServiceSid.trim()) {
        toast.error('Provide a WhatsApp number or a Messaging Service SID');
        return;
      }
      if (twilioAuthToken === MASKED_TOKEN || !twilioAuthToken.trim()) {
        toast.error('Please re-enter the Twilio Auth Token to save changes');
        return;
      }
      payload = {
        provider: 'twilio',
        twilio_account_sid: twilioAccountSid.trim(),
        twilio_auth_token: twilioAuthToken.trim(),
        twilio_whatsapp_number: twilioWhatsappNumber.trim() || null,
        twilio_messaging_service_sid: twilioMessagingServiceSid.trim() || null,
      };
    } else if (provider === 'jasmin') {
      if (!jasminBaseUrl.trim()) {
        toast.error('Gateway URL is required');
        return;
      }
      if (!jasminUsername.trim()) {
        toast.error('Gateway username is required');
        return;
      }
      if (jasminPassword === MASKED_TOKEN || !jasminPassword.trim()) {
        toast.error('Please re-enter the gateway password to save changes');
        return;
      }
      payload = {
        provider: 'jasmin',
        jasmin_base_url: jasminBaseUrl.trim(),
        jasmin_username: jasminUsername.trim(),
        jasmin_password: jasminPassword.trim(),
        jasmin_default_sender: jasminDefaultSender.trim() || null,
      };
    } else {
      if (!phoneNumberId.trim()) {
        toast.error('Phone Number ID is required');
        return;
      }
      if (accessToken === MASKED_TOKEN || !accessToken.trim()) {
        toast.error('Please re-enter the Access Token to save changes');
        return;
      }
      payload = {
        provider: 'meta',
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim() || null,
        access_token: accessToken.trim(),
        verify_token: verifyToken.trim() || null,
      };
    }

    try {
      setSaving(true);

      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to save configuration');
        setSaving(false);
        return;
      }

      toast.success(
        data.phone_info?.verified_name
          ? `Connected to ${data.phone_info.verified_name}`
          : 'Configuration saved successfully'
      );

      if (user) await fetchConfig(user.id);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    try {
      setTesting(true);
      const res = await fetch('/api/whatsapp/config', { method: 'GET' });
      const payload = await res.json();

      if (payload.connected) {
        setConnectionStatus('connected');
        setResetReason(null);
        setStatusMessage('');
        toast.success(
          payload.phone_info?.verified_name
            ? `Connected to ${payload.phone_info.verified_name}`
            : 'API connection successful'
        );
      } else {
        setConnectionStatus('disconnected');
        setResetReason(
          payload.needs_reset
            ? 'token_corrupted'
            : payload.reason === 'provider_error'
              ? 'provider_error'
              : null
        );
        setStatusMessage(payload.message || '');
        toast.error(payload.message || 'API connection failed');
      }
    } catch (err) {
      console.error('Test connection error:', err);
      setConnectionStatus('disconnected');
      toast.error('Connection test failed. Check network and try again.');
    } finally {
      setTesting(false);
    }
  }

  async function handleReset() {
    if (
      !confirm(
        'This will delete the current WhatsApp config so you can re-enter it. Continue?'
      )
    ) {
      return;
    }

    try {
      setResetting(true);
      const res = await fetch('/api/whatsapp/config', { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to reset configuration');
        return;
      }

      toast.success('Configuration cleared. You can now re-enter your credentials.');
      setConfig(null);
      setPhoneNumberId('');
      setWabaId('');
      setAccessToken('');
      setVerifyToken('');
      setTwilioAccountSid('');
      setTwilioAuthToken('');
      setTwilioWhatsappNumber('');
      setTwilioMessagingServiceSid('');
      setJasminBaseUrl('');
      setJasminUsername('');
      setJasminPassword('');
      setJasminDefaultSender('');
      setTokenEdited(false);
      setConnectionStatus('disconnected');
      setResetReason(null);
      setStatusMessage('');
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('Failed to reset configuration');
    } finally {
      setResetting(false);
    }
  }

  function handleCopyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard');
  }

  async function handleSaveCompliance() {
    const parseHour = (s: string): number | null | typeof NaN => {
      if (s.trim() === '') return null;
      const n = Number(s);
      return Number.isInteger(n) && n >= 0 && n <= 23 ? n : NaN;
    };
    const start = parseHour(smsQuietStart);
    const end = parseHour(smsQuietEnd);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      toast.error('Quiet hours must be whole numbers from 0 to 23');
      return;
    }
    if ((start === null) !== (end === null)) {
      toast.error('Set both quiet-hour fields, or leave both empty');
      return;
    }

    try {
      setSavingCompliance(true);
      const res = await fetch('/api/whatsapp/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sms_quiet_hours_start: start,
          sms_quiet_hours_end: end,
          sms_timezone: smsTimezone.trim() || 'America/New_York',
          a2p_brand_id: a2pBrandId.trim(),
          a2p_campaign_id: a2pCampaignId.trim(),
          a2p_status: a2pStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to save compliance settings');
        return;
      }
      toast.success('Compliance settings saved');
      if (user) await fetchConfig(user.id);
    } catch (err) {
      console.error('Save compliance error:', err);
      toast.error('Failed to save compliance settings');
    } finally {
      setSavingCompliance(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const showResetBanner = resetReason === 'token_corrupted';

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] mt-4">
      {/* Main config form */}
      <div className="space-y-6">
        {/* Corrupted-token reset banner */}
        {showResetBanner && (
          <Alert className="bg-amber-950/40 border-amber-600/40">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <AlertTitle className="text-amber-200 mb-1">
                  Stored token can&apos;t be decrypted
                </AlertTitle>
                <AlertDescription className="text-amber-100/80 text-sm">
                  {statusMessage}
                </AlertDescription>
                <Button
                  onClick={handleReset}
                  disabled={resetting}
                  size="sm"
                  className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {resetting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="size-4" />
                      Reset Configuration
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Alert>
        )}

        {/* Connection Status */}
        <Alert className="bg-card border-border">
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' ? (
              <CheckCircle2 className="size-4 text-primary" />
            ) : (
              <XCircle className="size-4 text-red-500" />
            )}
            <AlertTitle className="text-foreground mb-0">
              {connectionStatus === 'connected' ? 'Connected' : 'Not Connected'}
            </AlertTitle>
          </div>
          <AlertDescription className="text-muted-foreground">
            {connectionStatus === 'connected'
              ? 'Your WhatsApp Business API is connected and ready to send/receive messages.'
              : statusMessage ||
                'Choose a provider and enter your credentials below to connect your WhatsApp Business account.'}
          </AlertDescription>
        </Alert>

        {/* Provider selector */}
        <Card className="bg-card border-border ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-foreground">Messaging Provider</CardTitle>
            <CardDescription className="text-muted-foreground">
              Send and receive WhatsApp messages through the Meta Cloud API or
              through Twilio. Pick whichever account you have access to.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(['meta', 'twilio', 'jasmin'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProvider(p)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    provider === p
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-muted hover:bg-muted/70'
                  }`}
                >
                  <span className="block text-sm font-medium text-foreground">
                    {p === 'meta'
                      ? 'Meta Cloud API'
                      : p === 'twilio'
                        ? 'Twilio'
                        : 'SMS Gateway'}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {p === 'meta'
                      ? 'Direct WhatsApp Business Platform'
                      : p === 'twilio'
                        ? 'WhatsApp via Twilio senders'
                        : 'Self-hosted Jasmin SMS gateway'}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* API Credentials */}
        <Card className="bg-card border-border ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-foreground">API Credentials</CardTitle>
            <CardDescription className="text-muted-foreground">
              {provider === 'twilio'
                ? 'Enter your Twilio account credentials and WhatsApp sender.'
                : provider === 'jasmin'
                  ? 'Enter the connection details for your self-hosted Jasmin SMS gateway.'
                  : 'Enter your Meta WhatsApp Business API credentials.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {provider === 'twilio' ? (
              <>
                <div className="space-y-2">
                  <Label className="text-foreground">Account SID</Label>
                  <Input
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={twilioAccountSid}
                    onChange={(e) => setTwilioAccountSid(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Auth Token</Label>
                  <div className="relative">
                    <Input
                      type={showToken ? 'text' : 'password'}
                      placeholder="Enter your Twilio auth token"
                      value={twilioAuthToken}
                      onChange={(e) => {
                        setTwilioAuthToken(e.target.value);
                        setTokenEdited(true);
                      }}
                      onFocus={() => {
                        if (twilioAuthToken === MASKED_TOKEN) {
                          setTwilioAuthToken('');
                          setTokenEdited(true);
                        }
                      }}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showToken ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                  {config && !tokenEdited && (
                    <p className="text-xs text-muted-foreground">
                      Token is hidden for security. Re-enter it to update
                      configuration.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">
                    WhatsApp Sender Number
                  </Label>
                  <Input
                    placeholder="e.g. +14155238886"
                    value={twilioWhatsappNumber}
                    onChange={(e) => setTwilioWhatsappNumber(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your Twilio WhatsApp-enabled number in E.164 format.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">
                    Messaging Service SID{' '}
                    <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={twilioMessagingServiceSid}
                    onChange={(e) =>
                      setTwilioMessagingServiceSid(e.target.value)
                    }
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    If set, messages are sent through this Messaging Service
                    instead of the bare sender number.
                  </p>
                </div>
              </>
            ) : provider === 'jasmin' ? (
              <>
                <div className="space-y-2">
                  <Label className="text-foreground">Gateway URL</Label>
                  <Input
                    placeholder="https://sms.yourdomain.com"
                    value={jasminBaseUrl}
                    onChange={(e) => setJasminBaseUrl(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    Public base URL of your Jasmin gateway&apos;s HTTP API.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Gateway Username</Label>
                  <Input
                    placeholder="Jasmin HTTP user"
                    value={jasminUsername}
                    onChange={(e) => setJasminUsername(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Gateway Password</Label>
                  <div className="relative">
                    <Input
                      type={showToken ? 'text' : 'password'}
                      placeholder="Enter the gateway password"
                      value={jasminPassword}
                      onChange={(e) => {
                        setJasminPassword(e.target.value);
                        setTokenEdited(true);
                      }}
                      onFocus={() => {
                        if (jasminPassword === MASKED_TOKEN) {
                          setJasminPassword('');
                          setTokenEdited(true);
                        }
                      }}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showToken ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                  {config && !tokenEdited && (
                    <p className="text-xs text-muted-foreground">
                      Password is hidden for security. Re-enter it to update
                      configuration.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Default Sender ID</Label>
                  <Input
                    placeholder="e.g. +14155550100 or a short code"
                    value={jasminDefaultSender}
                    onChange={(e) => setJasminDefaultSender(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    The sender number or alphanumeric ID outbound SMS is sent
                    from. Inbound replies are matched to this account by it.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-foreground">Phone Number ID</Label>
                  <Input
                    placeholder="e.g. 100234567890123"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">
                    WhatsApp Business Account ID
                  </Label>
                  <Input
                    placeholder="e.g. 100234567890456"
                    value={wabaId}
                    onChange={(e) => setWabaId(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">
                    Permanent Access Token
                  </Label>
                  <div className="relative">
                    <Input
                      type={showToken ? 'text' : 'password'}
                      placeholder="Enter your access token"
                      value={accessToken}
                      onChange={(e) => {
                        setAccessToken(e.target.value);
                        setTokenEdited(true);
                      }}
                      onFocus={() => {
                        if (accessToken === MASKED_TOKEN) {
                          setAccessToken('');
                          setTokenEdited(true);
                        }
                      }}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showToken ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                  {config && !tokenEdited && (
                    <p className="text-xs text-muted-foreground">
                      Token is hidden for security. Re-enter it to update
                      configuration.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">
                    Webhook Verify Token
                  </Label>
                  <Input
                    placeholder="Create a custom verify token"
                    value={verifyToken}
                    onChange={(e) => setVerifyToken(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    A custom string you create. Must match the token you set in
                    Meta webhook settings.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Webhook URL */}
        <Card className="bg-card border-border ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-foreground">
              Webhook Configuration
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {provider === 'twilio'
                ? 'Set this URL as the inbound webhook on your Twilio WhatsApp sender.'
                : provider === 'jasmin'
                  ? 'Point your Jasmin gateway at this URL for inbound SMS and delivery receipts.'
                  : 'Use this URL as your webhook callback in the Meta App Dashboard.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label className="text-foreground">Webhook Callback URL</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={webhookUrl}
                  className="bg-muted border-border text-foreground font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyWebhookUrl}
                  className="shrink-0 border-border text-foreground hover:text-foreground hover:bg-muted"
                >
                  <Copy className="size-4" />
                </Button>
              </div>
              {provider === 'twilio' && (
                <p className="text-xs text-muted-foreground">
                  In the Twilio Console, set this as the &quot;When a message
                  comes in&quot; URL (HTTP POST) for your WhatsApp sender. The
                  same URL also accepts delivery-status callbacks.
                </p>
              )}
              {provider === 'jasmin' && (
                <p className="text-xs text-muted-foreground">
                  Configure your Jasmin MO (inbound) HTTP connector to POST
                  here, and append <code>?token=</code> with your{' '}
                  <code>SMS_WEBHOOK_SECRET</code>. Delivery receipts are wired
                  to this URL automatically on each send.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SMS Compliance & Registration — SMS gateway provider only */}
        {provider === 'jasmin' && (
          <Card className="bg-card border-border ring-0 ring-transparent">
            <CardHeader>
              <CardTitle className="text-foreground">
                SMS Compliance &amp; Registration
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Quiet hours and A2P/TCR registration state. Outbound SMS is
                blocked during quiet hours and to contacts without recorded
                consent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!config && (
                <p className="text-xs text-muted-foreground">
                  Save your gateway connection above before configuring
                  compliance settings.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-foreground">Quiet Hours Start</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    placeholder="e.g. 21"
                    value={smsQuietStart}
                    onChange={(e) => setSmsQuietStart(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Quiet Hours End</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    placeholder="e.g. 8"
                    value={smsQuietEnd}
                    onChange={(e) => setSmsQuietEnd(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Timezone</Label>
                  <Input
                    placeholder="America/New_York"
                    value={smsTimezone}
                    onChange={(e) => setSmsTimezone(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Hours are 0–23 in the timezone above. Leave both blank to
                disable the quiet-hours check.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-foreground">A2P Brand ID</Label>
                  <Input
                    placeholder="TCR brand ID"
                    value={a2pBrandId}
                    onChange={(e) => setA2pBrandId(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">A2P Campaign ID</Label>
                  <Input
                    placeholder="TCR campaign ID"
                    value={a2pCampaignId}
                    onChange={(e) => setA2pCampaignId(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Registration Status</Label>
                <select
                  value={a2pStatus}
                  onChange={(e) => setA2pStatus(e.target.value)}
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
                >
                  <option value="unregistered">Unregistered</option>
                  <option value="pending">Pending</option>
                  <option value="registered">Registered</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {smsWidgetKey && (
                <div className="space-y-2">
                  <Label className="text-foreground">
                    Consent Opt-In Form
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={
                        typeof window !== 'undefined'
                          ? `${window.location.origin}/sms-optin/${smsWidgetKey}`
                          : ''
                      }
                      className="bg-muted border-border text-foreground font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/sms-optin/${smsWidgetKey}`
                        );
                        toast.success('Opt-in form URL copied');
                      }}
                      className="shrink-0 border-border text-foreground hover:text-foreground hover:bg-muted"
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this hosted form so customers can opt in to SMS.
                    Submissions are recorded as web-form consent — the express
                    consent the send gate requires.
                  </p>
                </div>
              )}

              <Button
                onClick={handleSaveCompliance}
                disabled={savingCompliance || !config}
                className="bg-primary hover:bg-primary text-primary-foreground"
              >
                {savingCompliance ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Compliance Settings'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary text-primary-foreground"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || !config}
            className="border-border text-foreground hover:text-foreground hover:bg-muted"
          >
            {testing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Zap className="size-4" />
                Test API Connection
              </>
            )}
          </Button>
          {config && (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={resetting}
              className="border-red-900 text-red-400 hover:text-red-300 hover:bg-red-950/40"
            >
              {resetting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="size-4" />
                  Reset Configuration
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Setup Instructions Sidebar */}
      <div>
        <Card className="bg-card border-border ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-foreground text-base">
              Setup Instructions
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {provider === 'twilio'
                ? 'Connect WhatsApp through your Twilio account.'
                : provider === 'jasmin'
                  ? 'Connect your self-hosted Jasmin SMS gateway.'
                  : 'Follow these steps to connect your WhatsApp Business API.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {provider === 'jasmin' ? (
              <Accordion>
                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-foreground">
                        1
                      </span>
                      Stand up a Jasmin gateway
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>
                        Deploy{' '}
                        <span className="text-primary">Jasmin SMS Gateway</span>{' '}
                        on a server you control
                      </li>
                      <li>
                        Expose its HTTP API behind HTTPS (e.g. a reverse proxy)
                      </li>
                      <li>
                        Create an HTTP user and set its credentials below
                      </li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-foreground">
                        2
                      </span>
                      Connect an SMPP route
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>
                        Add an SMPP connector for your carrier or aggregator
                      </li>
                      <li>Configure MT routes so outbound SMS has a path</li>
                      <li>
                        Register your A2P campaign with the carrier before
                        sending production traffic
                      </li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-foreground">
                        3
                      </span>
                      Route inbound messages here
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>
                        Add an MO route with an HTTP connector pointing at the{' '}
                        <strong className="text-foreground">
                          Webhook Callback URL
                        </strong>{' '}
                        above
                      </li>
                      <li>
                        Append <code>?token=</code> with your{' '}
                        <code>SMS_WEBHOOK_SECRET</code>
                      </li>
                      <li>Send a test SMS to confirm the round trip</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ) : provider === 'twilio' ? (
              <Accordion>
                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-foreground">
                        1
                      </span>
                      Get your account credentials
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>
                        Sign in to{' '}
                        <span className="text-primary">console.twilio.com</span>
                      </li>
                      <li>
                        Copy your{' '}
                        <strong className="text-foreground">Account SID</strong>{' '}
                        and{' '}
                        <strong className="text-foreground">Auth Token</strong>{' '}
                        from the dashboard
                      </li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-foreground">
                        2
                      </span>
                      Set up a WhatsApp sender
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Go to Messaging &gt; Senders &gt; WhatsApp senders</li>
                      <li>
                        Register a number or use the Twilio Sandbox for testing
                      </li>
                      <li>
                        Copy the sender number into the{' '}
                        <strong className="text-foreground">
                          WhatsApp Sender Number
                        </strong>{' '}
                        field
                      </li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-foreground">
                        3
                      </span>
                      Point the webhook here
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Open your WhatsApp sender&apos;s configuration</li>
                      <li>
                        Set &quot;When a message comes in&quot; to the{' '}
                        <strong className="text-foreground">
                          Webhook Callback URL
                        </strong>{' '}
                        above, method HTTP POST
                      </li>
                      <li>Save and send a test message to verify</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ) : (
              <Accordion>
                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-foreground">
                        1
                      </span>
                      Create a Meta App
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>
                        Go to{' '}
                        <span className="text-primary">
                          developers.facebook.com
                        </span>
                      </li>
                      <li>Click &quot;My Apps&quot; and then &quot;Create App&quot;</li>
                      <li>Select &quot;Business&quot; as the app type</li>
                      <li>Fill in app details and create</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-foreground">
                        2
                      </span>
                      Add WhatsApp Product
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>In your app dashboard, click &quot;Add Product&quot;</li>
                      <li>Find &quot;WhatsApp&quot; and click &quot;Set Up&quot;</li>
                      <li>Follow the setup wizard to link your business</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-foreground">
                        3
                      </span>
                      Get API Credentials
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Go to WhatsApp &gt; API Setup</li>
                      <li>
                        Copy your{' '}
                        <strong className="text-foreground">
                          Phone Number ID
                        </strong>
                      </li>
                      <li>
                        Copy your{' '}
                        <strong className="text-foreground">
                          WhatsApp Business Account ID
                        </strong>
                      </li>
                      <li>
                        Generate a{' '}
                        <strong className="text-foreground">
                          Permanent Access Token
                        </strong>{' '}
                        from Business Settings &gt; System Users
                      </li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-border">
                  <AccordionTrigger className="text-foreground hover:text-foreground hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-foreground">
                        4
                      </span>
                      Configure Webhooks
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Go to WhatsApp &gt; Configuration</li>
                      <li>Click &quot;Edit&quot; on the Webhook section</li>
                      <li>
                        Paste the{' '}
                        <strong className="text-foreground">
                          Webhook Callback URL
                        </strong>{' '}
                        from above
                      </li>
                      <li>
                        Enter the same{' '}
                        <strong className="text-foreground">Verify Token</strong>{' '}
                        you set here
                      </li>
                      <li>Subscribe to &quot;messages&quot; webhook field</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            <div className="mt-4 pt-4 border-t border-border">
              <a
                href={
                  provider === 'twilio'
                    ? 'https://www.twilio.com/docs/whatsapp'
                    : provider === 'jasmin'
                      ? 'https://docs.jasminsms.com/'
                      : 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started'
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary transition-colors"
              >
                <ExternalLink className="size-3.5" />
                {provider === 'twilio'
                  ? 'Twilio WhatsApp Documentation'
                  : provider === 'jasmin'
                    ? 'Jasmin SMS Gateway Documentation'
                    : 'Meta WhatsApp API Documentation'}
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
