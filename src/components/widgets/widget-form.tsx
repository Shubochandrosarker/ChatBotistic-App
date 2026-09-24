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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { WidgetPreview } from '@/components/widgets/widget-preview';
import type { TochatWidget } from '@/lib/tochat/client';

interface WidgetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widget?: TochatWidget | null;
  onSaved: () => void;
}

const DEFAULT_COLOR = '#27d974';

interface FormState {
  name: string;
  active: boolean;
  color: string;
  rightpos: boolean;
  isopen: boolean;
  theme: string;
  zIndex: string;
  iconUrl: string;
  whatsappIconUrl: string;
  backgroundImageUrl: string;
  widgetMessage: string;
  buttonMessage: string;
  offlineMessage: string;
  legend: string;
  welcomeBackMessage: string;
  transYourPhone: string;
  telValidationText: string;
  requiredValidationText: string;
  emailValidationText: string;
  transSuccessMessage: string;
  translateChatAnswer: string;
  translateOnlineFrom: string;
  translateShowTimetable: string;
  showAllAgents: string;
  showLessAgents: string;
  bannerUrl: string;
  activateBanner: boolean;
  returningBannerUrl: string;
  showBannerLanding: boolean;
  slug: string;
  landingPrimaryColor: string;
  landingSecondaryColor: string;
  landingLegal: string;
  landingTermsAndConditions: string;
  landingPrivacy: string;
  enableCookieBanner: boolean;
  cookiesTitle: string;
  cookiesDescription: string;
  haltBusiness: boolean;
}

function emptyForm(): FormState {
  return {
    name: '',
    active: true,
    color: DEFAULT_COLOR,
    rightpos: true,
    isopen: false,
    theme: '1',
    zIndex: '',
    iconUrl: '',
    whatsappIconUrl: '',
    backgroundImageUrl: '',
    widgetMessage: '',
    buttonMessage: '',
    offlineMessage: '',
    legend: '',
    welcomeBackMessage: '',
    transYourPhone: '',
    telValidationText: '',
    requiredValidationText: '',
    emailValidationText: '',
    transSuccessMessage: '',
    translateChatAnswer: '',
    translateOnlineFrom: '',
    translateShowTimetable: '',
    showAllAgents: '',
    showLessAgents: '',
    bannerUrl: '',
    activateBanner: false,
    returningBannerUrl: '',
    showBannerLanding: false,
    slug: '',
    landingPrimaryColor: '',
    landingSecondaryColor: '',
    landingLegal: '',
    landingTermsAndConditions: '',
    landingPrivacy: '',
    enableCookieBanner: false,
    cookiesTitle: '',
    cookiesDescription: '',
    haltBusiness: false,
  };
}

function formFromWidget(widget?: TochatWidget | null): FormState {
  if (!widget) return emptyForm();
  const base = emptyForm();
  return {
    ...base,
    name: widget.name ?? base.name,
    active: widget.active ?? base.active,
    color: widget.color ?? base.color,
    rightpos: widget.rightpos ?? base.rightpos,
    isopen: widget.isopen ?? base.isopen,
    theme: widget.theme != null ? String(widget.theme) : base.theme,
    zIndex: widget.zIndex != null ? String(widget.zIndex) : base.zIndex,
    iconUrl: widget.iconUrl ?? base.iconUrl,
    whatsappIconUrl: widget.whatsappIconUrl ?? base.whatsappIconUrl,
    backgroundImageUrl: widget.backgroundImageUrl ?? base.backgroundImageUrl,
    widgetMessage: widget.widgetMessage ?? base.widgetMessage,
    buttonMessage: widget.buttonMessage ?? base.buttonMessage,
    offlineMessage: widget.offlineMessage ?? base.offlineMessage,
    legend: widget.legend ?? base.legend,
    welcomeBackMessage: widget.WelcomeBackMessage ?? base.welcomeBackMessage,
    transYourPhone: widget.transYourPhone ?? base.transYourPhone,
    telValidationText: widget.telValidationText ?? base.telValidationText,
    requiredValidationText: widget.requiredValidationText ?? base.requiredValidationText,
    emailValidationText: widget.emailValidationText ?? base.emailValidationText,
    transSuccessMessage: widget.transSuccessMessage ?? base.transSuccessMessage,
    translateChatAnswer: widget.translateChatAnswer ?? base.translateChatAnswer,
    translateOnlineFrom: widget.translateOnlineFrom ?? base.translateOnlineFrom,
    translateShowTimetable: widget.translateShowTimetable ?? base.translateShowTimetable,
    showAllAgents: widget.showAllAgents ?? base.showAllAgents,
    showLessAgents: widget.showLessAgents ?? base.showLessAgents,
    bannerUrl: widget.bannerUrl ?? base.bannerUrl,
    activateBanner: widget.ActivateBanner ?? base.activateBanner,
    returningBannerUrl: widget.returningBannerUrl ?? base.returningBannerUrl,
    showBannerLanding: widget.showBannerLanding ?? base.showBannerLanding,
    slug: widget.slug ?? base.slug,
    landingPrimaryColor: widget.landingPrimaryColor ?? base.landingPrimaryColor,
    landingSecondaryColor: widget.landingSecondaryColor ?? base.landingSecondaryColor,
    landingLegal: widget.landingLegal ?? base.landingLegal,
    landingTermsAndConditions: widget.landingTermsAndConditions ?? base.landingTermsAndConditions,
    landingPrivacy: widget.landingPrivacy ?? base.landingPrivacy,
    enableCookieBanner: widget.enableCookieBanner ?? base.enableCookieBanner,
    cookiesTitle: widget.cookiesTitle ?? base.cookiesTitle,
    cookiesDescription: widget.cookiesDescription ?? base.cookiesDescription,
    haltBusiness: widget.haltBusiness ?? base.haltBusiness,
  };
}

/**
 * Trim to `null` (not `undefined`) for optional fields. A PUT body is
 * JSON — `undefined` values are dropped by `JSON.stringify`, so an
 * omitted key can't be told apart from "leave this alone," and
 * clearing a field in the form would silently fail to clear it on
 * Tochat. An explicit `null` says "empty" unambiguously either way.
 */
function opt(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toPayload(form: FormState): Record<string, unknown> {
  return {
    name: form.name.trim(),
    active: form.active,
    color: form.color,
    rightpos: form.rightpos,
    isopen: form.isopen,
    theme: Number(form.theme) || 1,
    zIndex: form.zIndex.trim() ? Number(form.zIndex) : null,
    iconUrl: opt(form.iconUrl),
    whatsappIconUrl: opt(form.whatsappIconUrl),
    backgroundImageUrl: opt(form.backgroundImageUrl),
    widgetMessage: opt(form.widgetMessage),
    buttonMessage: opt(form.buttonMessage),
    offlineMessage: opt(form.offlineMessage),
    legend: opt(form.legend),
    WelcomeBackMessage: opt(form.welcomeBackMessage),
    transYourPhone: opt(form.transYourPhone),
    telValidationText: opt(form.telValidationText),
    requiredValidationText: opt(form.requiredValidationText),
    emailValidationText: opt(form.emailValidationText),
    transSuccessMessage: opt(form.transSuccessMessage),
    translateChatAnswer: opt(form.translateChatAnswer),
    translateOnlineFrom: opt(form.translateOnlineFrom),
    translateShowTimetable: opt(form.translateShowTimetable),
    showAllAgents: opt(form.showAllAgents),
    showLessAgents: opt(form.showLessAgents),
    bannerUrl: opt(form.bannerUrl),
    ActivateBanner: form.activateBanner,
    returningBannerUrl: opt(form.returningBannerUrl),
    showBannerLanding: form.showBannerLanding,
    slug: opt(form.slug),
    landingPrimaryColor: opt(form.landingPrimaryColor),
    landingSecondaryColor: opt(form.landingSecondaryColor),
    landingLegal: opt(form.landingLegal),
    landingTermsAndConditions: opt(form.landingTermsAndConditions),
    landingPrivacy: opt(form.landingPrivacy),
    enableCookieBanner: form.enableCookieBanner,
    cookiesTitle: opt(form.cookiesTitle),
    cookiesDescription: opt(form.cookiesDescription),
    haltBusiness: form.haltBusiness,
  };
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-foreground">
        {label} {required && <span className="text-red-400">*</span>}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
      />
    </div>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-foreground">
        {label}
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ToggleField({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted px-3 py-2">
      <div>
        <Label htmlFor={id} className="text-foreground">
          {label}
        </Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={(v) => onChange(!!v)} aria-label={label} />
    </div>
  );
}

/**
 * Widget Studio's advanced editor — the full Tochat widget field set,
 * organized into tabs so ~35 fields stay approachable, with a live
 * visual preview alongside so appearance/message changes are
 * immediately visible rather than abstract.
 */
export function WidgetForm({ open, onOpenChange, widget, onSaved }: WidgetFormProps) {
  const isEdit = !!widget?.id;
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(formFromWidget(widget));
  }, [open, widget]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error('Widget name is required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        isEdit ? `/api/tochat/widgets/${widget!.id}` : '/api/tochat/widgets',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toPayload(form)),
        },
      );
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save widget');
        return;
      }
      if (data.configured === false) {
        toast.error('Tochat.be is not connected — set TOCHAT_API_EMAIL / TOCHAT_API_PASSWORD.');
        return;
      }

      toast.success(isEdit ? 'Widget updated' : 'Widget created');
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
      <DialogContent className="bg-card border-border text-foreground sm:max-w-4xl max-h-[min(92dvh,880px)] w-[calc(100%-1rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEdit ? 'Edit Widget' : 'New Widget'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isEdit
              ? 'Update this WhatsApp widget on Tochat.be.'
              : 'Create a new WhatsApp chat widget on Tochat.be.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="max-h-[min(70vh,calc(100dvh-15rem))] space-y-4 overflow-y-auto pr-1">
            <Tabs defaultValue="general">
              <TabsList className="mb-3 flex-wrap bg-muted">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="appearance">Appearance</TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
                <TabsTrigger value="banner">Banner</TabsTrigger>
                <TabsTrigger value="landing">Landing page</TabsTrigger>
                <TabsTrigger value="legal">Legal &amp; cookies</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4">
                <TextField
                  id="wf-name"
                  label="Name"
                  required
                  value={form.name}
                  onChange={(v) => set('name', v)}
                  placeholder="e.g. Sales widget"
                />
                <TextField
                  id="wf-slug"
                  label="Custom URL slug"
                  value={form.slug}
                  onChange={(v) => set('slug', v)}
                  placeholder="my-widget"
                />
                <ToggleField
                  id="wf-active"
                  label="Active"
                  hint="Turn off to hide this widget everywhere it's embedded."
                  checked={form.active}
                  onChange={(v) => set('active', v)}
                />
                <ToggleField
                  id="wf-halt"
                  label="Pause (outside business hours)"
                  hint="Shows the offline message instead of the chat form."
                  checked={form.haltBusiness}
                  onChange={(v) => set('haltBusiness', v)}
                />
              </TabsContent>

              <TabsContent value="appearance" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="wf-color" className="text-foreground">
                      Brand color
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="wf-color"
                        type="color"
                        value={form.color}
                        onChange={(e) => set('color', e.target.value)}
                        className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-border bg-muted p-0.5"
                      />
                      <Input
                        value={form.color}
                        onChange={(e) => set('color', e.target.value)}
                        className="bg-muted border-border text-foreground"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wf-theme" className="text-foreground">
                      Theme
                    </Label>
                    <Select value={form.theme} onValueChange={(v) => set('theme', v ?? '1')}>
                      <SelectTrigger className="w-full bg-muted border-border text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-muted border-border">
                        {['1', '2', '3'].map((v) => (
                          <SelectItem key={v} value={v} className="text-foreground focus:bg-accent focus:text-foreground">
                            Theme {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ToggleField
                    id="wf-rightpos"
                    label="Right side"
                    checked={form.rightpos}
                    onChange={(v) => set('rightpos', v)}
                  />
                  <ToggleField
                    id="wf-isopen"
                    label="Auto-open on load"
                    checked={form.isopen}
                    onChange={(v) => set('isopen', v)}
                  />
                </div>

                <TextField
                  id="wf-zindex"
                  label="Z-index"
                  value={form.zIndex}
                  onChange={(v) => set('zIndex', v.replace(/[^0-9]/g, ''))}
                  placeholder="100"
                />
                <TextField
                  id="wf-icon"
                  label="Icon URL"
                  value={form.iconUrl}
                  onChange={(v) => set('iconUrl', v)}
                  placeholder="https://…/icon.png"
                />
                <TextField
                  id="wf-whatsapp-icon"
                  label="WhatsApp icon URL"
                  value={form.whatsappIconUrl}
                  onChange={(v) => set('whatsappIconUrl', v)}
                  placeholder="https://…/whatsapp-icon.png"
                />
                <TextField
                  id="wf-bg"
                  label="Background image URL"
                  value={form.backgroundImageUrl}
                  onChange={(v) => set('backgroundImageUrl', v)}
                  placeholder="https://…/background.jpg"
                />
              </TabsContent>

              <TabsContent value="messages" className="space-y-4">
                <TextAreaField
                  id="wf-widget-message"
                  label="Greeting message"
                  value={form.widgetMessage}
                  onChange={(v) => set('widgetMessage', v)}
                  placeholder="Hi! How can we help?"
                />
                <TextAreaField
                  id="wf-offline-message"
                  label="Offline message"
                  value={form.offlineMessage}
                  onChange={(v) => set('offlineMessage', v)}
                  placeholder="We're not online right now — leave your number and we'll get back to you."
                />
                <TextAreaField
                  id="wf-welcome-back"
                  label="Welcome-back message"
                  value={form.welcomeBackMessage}
                  onChange={(v) => set('welcomeBackMessage', v)}
                  placeholder="Welcome back!"
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField
                    id="wf-button-message"
                    label="Button label"
                    value={form.buttonMessage}
                    onChange={(v) => set('buttonMessage', v)}
                    placeholder="Send"
                  />
                  <TextField
                    id="wf-legend"
                    label="Legend / header title"
                    value={form.legend}
                    onChange={(v) => set('legend', v)}
                    placeholder="This is my landing!"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField
                    id="wf-success"
                    label="Success message"
                    value={form.transSuccessMessage}
                    onChange={(v) => set('transSuccessMessage', v)}
                    placeholder="Success"
                  />
                  <TextField
                    id="wf-chat-answer"
                    label="Chat answer label"
                    value={form.translateChatAnswer}
                    onChange={(v) => set('translateChatAnswer', v)}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField
                    id="wf-online-from"
                    label={'"Online from" label'}
                    value={form.translateOnlineFrom}
                    onChange={(v) => set('translateOnlineFrom', v)}
                    placeholder="Online From"
                  />
                  <TextField
                    id="wf-show-timetable"
                    label={'"Show timetable" label'}
                    value={form.translateShowTimetable}
                    onChange={(v) => set('translateShowTimetable', v)}
                    placeholder="Show timetable"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField
                    id="wf-show-all-agents"
                    label={'"Show all agents" label'}
                    value={form.showAllAgents}
                    onChange={(v) => set('showAllAgents', v)}
                  />
                  <TextField
                    id="wf-show-less-agents"
                    label={'"Show less agents" label'}
                    value={form.showLessAgents}
                    onChange={(v) => set('showLessAgents', v)}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField
                    id="wf-phone-label"
                    label="Phone field label"
                    value={form.transYourPhone}
                    onChange={(v) => set('transYourPhone', v)}
                    placeholder="Your phone number"
                  />
                  <TextField
                    id="wf-tel-validation"
                    label="Phone validation error"
                    value={form.telValidationText}
                    onChange={(v) => set('telValidationText', v)}
                    placeholder="This telephone number is not valid"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField
                    id="wf-required-validation"
                    label={'"Required" error'}
                    value={form.requiredValidationText}
                    onChange={(v) => set('requiredValidationText', v)}
                    placeholder="This field is required"
                  />
                  <TextField
                    id="wf-email-validation"
                    label="Email validation error"
                    value={form.emailValidationText}
                    onChange={(v) => set('emailValidationText', v)}
                    placeholder="This email is not valid"
                  />
                </div>
              </TabsContent>

              <TabsContent value="banner" className="space-y-4">
                <ToggleField
                  id="wf-activate-banner"
                  label="Show banner"
                  hint="Displays a promotional banner alongside the widget."
                  checked={form.activateBanner}
                  onChange={(v) => set('activateBanner', v)}
                />
                <TextField
                  id="wf-banner-url"
                  label="Banner image URL"
                  value={form.bannerUrl}
                  onChange={(v) => set('bannerUrl', v)}
                  placeholder="https://…/banner.png"
                />
                <TextField
                  id="wf-returning-banner"
                  label="Returning-visitor banner URL"
                  value={form.returningBannerUrl}
                  onChange={(v) => set('returningBannerUrl', v)}
                  placeholder="https://…/banner-returning.png"
                />
                <ToggleField
                  id="wf-show-banner-landing"
                  label="Show banner on landing page"
                  checked={form.showBannerLanding}
                  onChange={(v) => set('showBannerLanding', v)}
                />
              </TabsContent>

              <TabsContent value="landing" className="space-y-4">
                {form.slug.trim() && (
                  <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Public URL:{' '}
                    <span className="font-mono text-foreground">
                      https://app.chatbotistic.com/land/{form.slug.trim().replace(/[^a-zA-Z0-9-_]/g, '')}
                    </span>{' '}
                    — live once you save. Set the slug under the General tab.
                  </p>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="wf-landing-primary" className="text-foreground">
                      Landing primary color
                    </Label>
                    <Input
                      id="wf-landing-primary"
                      type="color"
                      value={form.landingPrimaryColor || '#000000'}
                      onChange={(e) => set('landingPrimaryColor', e.target.value)}
                      className="h-9 w-full cursor-pointer bg-muted border-border p-0.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wf-landing-secondary" className="text-foreground">
                      Landing secondary color
                    </Label>
                    <Input
                      id="wf-landing-secondary"
                      type="color"
                      value={form.landingSecondaryColor || '#000000'}
                      onChange={(e) => set('landingSecondaryColor', e.target.value)}
                      className="h-9 w-full cursor-pointer bg-muted border-border p-0.5"
                    />
                  </div>
                </div>
                <TextAreaField
                  id="wf-landing-legal"
                  label="Landing legal notice"
                  value={form.landingLegal}
                  onChange={(v) => set('landingLegal', v)}
                  placeholder="The law states…"
                />
                <TextAreaField
                  id="wf-landing-terms"
                  label="Terms and conditions"
                  value={form.landingTermsAndConditions}
                  onChange={(v) => set('landingTermsAndConditions', v)}
                />
                <TextAreaField
                  id="wf-landing-privacy"
                  label="Privacy notice"
                  value={form.landingPrivacy}
                  onChange={(v) => set('landingPrivacy', v)}
                />
              </TabsContent>

              <TabsContent value="legal" className="space-y-4">
                <ToggleField
                  id="wf-cookie-banner"
                  label="Enable cookie banner"
                  checked={form.enableCookieBanner}
                  onChange={(v) => set('enableCookieBanner', v)}
                />
                <TextField
                  id="wf-cookies-title"
                  label="Cookie banner title"
                  value={form.cookiesTitle}
                  onChange={(v) => set('cookiesTitle', v)}
                  placeholder="Terms and conditions"
                />
                <TextAreaField
                  id="wf-cookies-description"
                  label="Cookie banner description"
                  value={form.cookiesDescription}
                  onChange={(v) => set('cookiesDescription', v)}
                  placeholder="Your rights…"
                />
              </TabsContent>
            </Tabs>
          </div>

          <div className="hidden flex-col gap-2 lg:flex">
            <p className="text-xs font-medium text-muted-foreground">Preview</p>
            <WidgetPreview
              widget={{
                name: form.name,
                color: form.color,
                rightpos: form.rightpos,
                isopen: form.isopen,
                iconUrl: form.iconUrl,
                widgetMessage: form.widgetMessage,
                buttonMessage: form.buttonMessage,
                legend: form.legend,
              }}
              className="flex-1"
            />
            <p className="text-[11px] text-muted-foreground">
              Approximate — the real widget renders from Tochat.be&apos;s
              own script once saved.
            </p>
          </div>

          <DialogFooter className="bg-card border-border lg:col-span-2">
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
              disabled={saving}
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
