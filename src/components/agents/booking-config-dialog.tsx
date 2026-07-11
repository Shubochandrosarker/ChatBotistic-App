'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, X, ArrowLeft, Calendar } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import type { TochatBookingConfig, TochatOperator, TochatWeekday } from '@/lib/tochat/client';

interface BookingConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: TochatOperator | null;
}

const WEEKDAYS: { key: TochatWeekday; label: string }[] = [
  { key: 'MON', label: 'Monday' },
  { key: 'TUE', label: 'Tuesday' },
  { key: 'WED', label: 'Wednesday' },
  { key: 'THU', label: 'Thursday' },
  { key: 'FRI', label: 'Friday' },
  { key: 'SAT', label: 'Saturday' },
  { key: 'SUN', label: 'Sunday' },
];

interface Window {
  availableFrom: string;
  availableUntil: string;
}

type Schedule = Record<TochatWeekday, Window[]>;

function emptySchedule(): Schedule {
  return { MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [] };
}

function scheduleFromConfig(config?: TochatBookingConfig | null): Schedule {
  const schedule = emptySchedule();
  for (const t of config?.bookingTimes ?? []) {
    if (schedule[t.day]) {
      schedule[t.day].push({ availableFrom: t.availableFrom, availableUntil: t.availableUntil });
    }
  }
  return schedule;
}

function scheduleToBookingTimes(schedule: Schedule) {
  return WEEKDAYS.flatMap(({ key }) =>
    schedule[key].map((w) => ({ day: key, availableFrom: w.availableFrom, availableUntil: w.availableUntil })),
  );
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Manage the booking (appointment) configs attached to one agent —
 * same two-pane list/edit pattern as the FAQ manager. The weekly
 * schedule is the one genuinely complex part: each day can have zero
 * or more time windows (matching the API's own shape — a day can be
 * "closed", have one shift, or a morning/afternoon split).
 */
export function BookingConfigDialog({ open, onOpenChange, agent }: BookingConfigDialogProps) {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [configs, setConfigs] = useState<TochatBookingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [duration, setDuration] = useState('60');
  const [breakTime, setBreakTime] = useState('0');
  const [availablePlacePerSlot, setAvailablePlacePerSlot] = useState('1');
  const [allowedHourUntilBooking, setAllowedHourUntilBooking] = useState('0');
  const [timezone, setTimezone] = useState('');
  const [sendReminder, setSendReminder] = useState(true);
  const [sendReminder48, setSendReminder48] = useState(true);
  const [cancelBookingInReminder, setCancelBookingInReminder] = useState(true);
  const [blockingDays, setBlockingDays] = useState<string[]>([]);
  const [newBlockingDay, setNewBlockingDay] = useState('');
  const [schedule, setSchedule] = useState<Schedule>(emptySchedule);

  const load = useCallback(async () => {
    if (!agent?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tochat/booking-configs?operatorId=${agent.id}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load booking configs');
      } else {
        setConfigs(data.bookingConfigs ?? []);
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
    setStartDate(todayIso());
    setEndDate(todayIso());
    setDuration('60');
    setBreakTime('0');
    setAvailablePlacePerSlot('1');
    setAllowedHourUntilBooking('0');
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
    setSendReminder(true);
    setSendReminder48(true);
    setCancelBookingInReminder(true);
    setBlockingDays([]);
    setSchedule(emptySchedule());
    setView('edit');
  }

  function startEdit(config: TochatBookingConfig) {
    setEditingId(config.id ?? null);
    setStartDate(config.startDate ?? todayIso());
    setEndDate(config.endDate ?? todayIso());
    setDuration(String(config.duration ?? 60));
    setBreakTime(String(config.breakTime ?? 0));
    setAvailablePlacePerSlot(String(config.availablePlacePerSlot ?? 1));
    setAllowedHourUntilBooking(String(config.allowedHourUntilBooking ?? 0));
    setTimezone(config.timezone ?? '');
    setSendReminder(config.sendReminder ?? true);
    setSendReminder48(config.sendReminder48 ?? true);
    setCancelBookingInReminder(config.cancelBookingInReminder ?? true);
    setBlockingDays(config.blockingDays ?? []);
    setSchedule(scheduleFromConfig(config));
    setView('edit');
  }

  function addWindow(day: TochatWeekday) {
    setSchedule((prev) => ({
      ...prev,
      [day]: [...prev[day], { availableFrom: '09:00', availableUntil: '17:00' }],
    }));
  }

  function updateWindow(day: TochatWeekday, index: number, patch: Partial<Window>) {
    setSchedule((prev) => ({
      ...prev,
      [day]: prev[day].map((w, i) => (i === index ? { ...w, ...patch } : w)),
    }));
  }

  function removeWindow(day: TochatWeekday, index: number) {
    setSchedule((prev) => ({ ...prev, [day]: prev[day].filter((_, i) => i !== index) }));
  }

  function addBlockingDay() {
    if (!newBlockingDay) return;
    setBlockingDays((prev) => (prev.includes(newBlockingDay) ? prev : [...prev, newBlockingDay].sort()));
    setNewBlockingDay('');
  }

  async function handleSave() {
    if (!agent?.id) return;
    if (!timezone.trim()) {
      toast.error('Timezone is required');
      return;
    }
    const bookingTimes = scheduleToBookingTimes(schedule);
    if (bookingTimes.length === 0) {
      toast.error('Add at least one available time window');
      return;
    }

    const body = {
      startDate,
      endDate,
      duration: Number(duration) || 60,
      breakTime: Number(breakTime) || 0,
      availablePlacePerSlot: Number(availablePlacePerSlot) || 1,
      allowedHourUntilBooking: Number(allowedHourUntilBooking) || 0,
      timezone: timezone.trim(),
      bookingTimes,
      sendReminder,
      sendReminder48,
      cancelBookingInReminder,
      blockingDays,
    };

    setSaving(true);
    try {
      const res = await fetch(
        editingId ? `/api/tochat/booking-configs/${editingId}` : '/api/tochat/booking-configs',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingId ? body : { ...body, operatorId: agent.id }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save booking config');
        return;
      }
      toast.success(editingId ? 'Booking config updated' : 'Booking config created');
      setView('list');
      load();
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(config: TochatBookingConfig) {
    if (!config.id) return;
    setDeletingId(config.id);
    try {
      const res = await fetch(`/api/tochat/booking-configs/${config.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error ?? 'Failed to delete booking config');
        return;
      }
      toast.success('Booking config deleted');
      load();
    } finally {
      setDeletingId(null);
    }
  }

  if (!agent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            {view === 'edit' && (
              <button
                type="button"
                onClick={() => setView('list')}
                aria-label="Back to booking configs"
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            {view === 'list' ? `Bookings — ${agent.name}` : editingId ? 'Edit booking config' : 'New booking config'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {view === 'list'
              ? 'Appointment windows customers can book with this agent.'
              : 'Set the booking window, slot length, and weekly availability.'}
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
              New booking config
            </Button>

            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : configs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No booking configs yet for this agent.
              </p>
            ) : (
              <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
                {configs.map((config) => (
                  <li
                    key={config.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Calendar className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {config.startDate} → {config.endDate}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {config.duration}min slots · {config.bookingTimes?.length ?? 0} window
                          {config.bookingTimes?.length === 1 ? '' : 's'} · {config.timezone}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => startEdit(config)}
                        aria-label="Edit booking config"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(config)}
                        disabled={deletingId === config.id}
                        className="text-destructive hover:text-destructive"
                        aria-label="Delete booking config"
                      >
                        {deletingId === config.id ? (
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
          <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bc-start" className="text-foreground">
                  Start date
                </Label>
                <Input
                  id="bc-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-muted border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bc-end" className="text-foreground">
                  End date
                </Label>
                <Input
                  id="bc-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-muted border-border text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="bc-duration" className="text-foreground">
                  Slot length (min)
                </Label>
                <Input
                  id="bc-duration"
                  type="number"
                  min={5}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="bg-muted border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bc-break" className="text-foreground">
                  Break (min)
                </Label>
                <Input
                  id="bc-break"
                  type="number"
                  min={0}
                  value={breakTime}
                  onChange={(e) => setBreakTime(e.target.value)}
                  className="bg-muted border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bc-places" className="text-foreground">
                  Places/slot
                </Label>
                <Input
                  id="bc-places"
                  type="number"
                  min={1}
                  value={availablePlacePerSlot}
                  onChange={(e) => setAvailablePlacePerSlot(e.target.value)}
                  className="bg-muted border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bc-notice" className="text-foreground">
                  Min notice (hrs)
                </Label>
                <Input
                  id="bc-notice"
                  type="number"
                  min={0}
                  value={allowedHourUntilBooking}
                  onChange={(e) => setAllowedHourUntilBooking(e.target.value)}
                  className="bg-muted border-border text-foreground"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bc-timezone" className="text-foreground">
                Timezone
              </Label>
              <Input
                id="bc-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Europe/Madrid"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Weekly availability</Label>
              <div className="space-y-2 rounded-lg border border-border p-3">
                {WEEKDAYS.map(({ key, label }) => (
                  <div key={key} className="flex flex-wrap items-start gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                    <span className="w-24 shrink-0 pt-1.5 text-xs font-medium text-foreground">{label}</span>
                    <div className="flex flex-1 flex-wrap gap-2">
                      {schedule[key].length === 0 ? (
                        <span className="pt-1.5 text-xs text-muted-foreground">Closed</span>
                      ) : (
                        schedule[key].map((w, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <Input
                              type="time"
                              value={w.availableFrom}
                              onChange={(e) => updateWindow(key, i, { availableFrom: e.target.value })}
                              className="h-8 w-24 bg-muted border-border text-xs text-foreground"
                            />
                            <span className="text-xs text-muted-foreground">–</span>
                            <Input
                              type="time"
                              value={w.availableUntil}
                              onChange={(e) => updateWindow(key, i, { availableUntil: e.target.value })}
                              className="h-8 w-24 bg-muted border-border text-xs text-foreground"
                            />
                            <button
                              type="button"
                              onClick={() => removeWindow(key, i)}
                              aria-label={`Remove ${label} window`}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                      <button
                        type="button"
                        onClick={() => addWindow(key)}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                      >
                        <Plus className="size-3" />
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Blocked dates</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={newBlockingDay}
                  onChange={(e) => setNewBlockingDay(e.target.value)}
                  className="bg-muted border-border text-foreground"
                />
                <Button type="button" variant="outline" size="sm" onClick={addBlockingDay} className="border-border">
                  Add
                </Button>
              </div>
              {blockingDays.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {blockingDays.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
                    >
                      {d}
                      <button
                        type="button"
                        onClick={() => setBlockingDays((prev) => prev.filter((x) => x !== d))}
                        aria-label={`Remove blocked date ${d}`}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Reminders</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-2">
                  <span className="text-xs text-foreground">24h reminder</span>
                  <Switch checked={sendReminder} onCheckedChange={(v) => setSendReminder(!!v)} aria-label="24h reminder" />
                </label>
                <label className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-2">
                  <span className="text-xs text-foreground">48h reminder</span>
                  <Switch checked={sendReminder48} onCheckedChange={(v) => setSendReminder48(!!v)} aria-label="48h reminder" />
                </label>
                <label className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-2">
                  <span className="text-xs text-foreground">Cancel link</span>
                  <Switch
                    checked={cancelBookingInReminder}
                    onCheckedChange={(v) => setCancelBookingInReminder(!!v)}
                    aria-label="Include cancel link in reminders"
                  />
                </label>
              </div>
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
    </Dialog>
  );
}
