'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SmsOptInPage() {
  const params = useParams<{ key: string }>();
  const widgetKey = params?.key ?? '';

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!phone.trim()) {
      setError('Enter your mobile number.');
      return;
    }
    if (!ageConfirmed) {
      setError('You must confirm your age to subscribe.');
      return;
    }
    if (!consent) {
      setError('You must agree to receive messages to subscribe.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/sms/consent/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widget_key: widgetKey,
          phone: phone.trim(),
          name: name.trim() || undefined,
          age_confirmed: ageConfirmed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not complete your opt-in.');
        return;
      }
      setDone(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="size-10 text-primary" />
            <h1 className="text-xl font-semibold text-foreground">
              You&apos;re subscribed
            </h1>
            <p className="text-sm text-muted-foreground">
              Thanks — you&apos;ll start receiving text updates. Reply STOP at
              any time to unsubscribe.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Sign up for text updates
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Get news and offers by SMS.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Mobile Number</Label>
              <Input
                type="tel"
                inputMode="tel"
                placeholder="+1 415 555 0100"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Include your country code.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">
                Name <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <label className="flex items-start gap-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span>I confirm I am at least 18 years old.</span>
            </label>

            <label className="flex items-start gap-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span>
                I agree to receive recurring automated marketing text messages
                at the number provided. Consent is not a condition of any
                purchase. Message &amp; data rates may apply. Reply STOP to
                unsubscribe, HELP for help.
              </span>
            </label>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-primary-foreground hover:bg-primary"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Subscribing…
                </>
              ) : (
                'Subscribe'
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
