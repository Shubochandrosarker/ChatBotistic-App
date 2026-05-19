'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Step2SelectAudience } from '@/components/broadcasts/step2-select-audience';
import { useBroadcastSending } from '@/hooks/use-broadcast-sending';

const steps = [
  { label: 'Compose', key: 'compose' },
  { label: 'Audience', key: 'audience' },
  { label: 'Send', key: 'send' },
] as const;

/** GSM-7 single-segment length; longer bodies split into 153-char parts. */
function segmentCount(text: string): number {
  if (text.length === 0) return 0;
  return text.length <= 160 ? 1 : Math.ceil(text.length / 153);
}

export default function NewSmsBroadcastPage() {
  const router = useRouter();
  const { createAndSendBroadcast, isProcessing, progress } =
    useBroadcastSending();

  const [currentStep, setCurrentStep] = useState(0);
  const [name, setName] = useState('');
  const [messageText, setMessageText] = useState('');
  const [audience, setAudience] = useState<{
    type: 'all' | 'tags' | 'custom_field' | 'csv';
    tagIds?: string[];
    customField?: {
      fieldId: string;
      operator: 'is' | 'is_not' | 'contains';
      value: string;
    };
    csvContacts?: { phone: string; name?: string }[];
    excludeTagIds?: string[];
  }>({ type: 'all' });

  async function handleSend() {
    try {
      const broadcastId = await createAndSendBroadcast({
        name: name.trim() || 'SMS broadcast',
        mode: 'sms',
        messageText,
        audience: {
          type: audience.type,
          tagIds: audience.tagIds,
          customField: audience.customField,
          csvContacts: audience.csvContacts,
          excludeTagIds: audience.excludeTagIds,
        },
        variables: {},
      });
      router.push(`/broadcasts/${broadcastId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Broadcast failed';
      console.error('SMS broadcast failed:', err);
      toast.error(message);
    }
  }

  const segments = segmentCount(messageText);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">New SMS Broadcast</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a text message to your contacts. Only contacts with recorded
          SMS consent will receive it.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          return (
            <div key={step.key} className="flex flex-1 items-center">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all ${
                    isCompleted
                      ? 'bg-primary text-primary-foreground'
                      : isActive
                        ? 'border-2 border-primary bg-primary/10 text-primary'
                        : 'border border-border bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <span
                  className={`hidden text-sm font-medium sm:block ${
                    isActive
                      ? 'text-foreground'
                      : isCompleted
                        ? 'text-primary'
                        : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-3 h-px flex-1 ${
                    index < currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div
        className="relative min-h-[400px] transition-all duration-300"
        style={{
          opacity: isProcessing ? 0.6 : 1,
          pointerEvents: isProcessing ? 'none' : 'auto',
        }}
      >
        {/* Step 1 — Compose */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Compose Message
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep it concise — long messages are split into multiple
                billable segments.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Broadcast Name</Label>
              <Input
                placeholder="e.g. May range-day reminder"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Message</Label>
              <Textarea
                rows={6}
                placeholder="Type your SMS message…"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                {messageText.length} characters · {segments} segment
                {segments === 1 ? '' : 's'}. Include &quot;Reply STOP to
                unsubscribe&quot; on the first message of a campaign.
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <Button
                variant="outline"
                onClick={() => router.push('/broadcasts')}
                className="border-border text-foreground"
              >
                Back
              </Button>
              <Button
                onClick={() => setCurrentStep(1)}
                disabled={!messageText.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary disabled:opacity-50"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Audience */}
        {currentStep === 1 && (
          <Step2SelectAudience
            audience={audience}
            onUpdate={setAudience}
            onNext={() => setCurrentStep(2)}
            onBack={() => setCurrentStep(0)}
          />
        )}

        {/* Step 3 — Review & send */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Review &amp; Send
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Contacts without recorded SMS consent are skipped
                automatically.
              </p>
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4">
              <div>
                <span className="text-xs text-muted-foreground">Name</span>
                <p className="text-sm text-foreground">
                  {name.trim() || 'SMS broadcast'}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Message</span>
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {messageText}
                </p>
              </div>
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Sending… {progress}%
                </p>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                disabled={isProcessing}
                className="border-border text-foreground"
              >
                Back
              </Button>
              <Button
                onClick={handleSend}
                disabled={isProcessing}
                className="bg-primary text-primary-foreground hover:bg-primary disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  'Send Broadcast'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
