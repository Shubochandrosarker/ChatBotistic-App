'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Paddle v2 overlay checkout, env-driven so one build serves sandbox and
 * live (the WPistic platform's proven pattern):
 *
 *   NEXT_PUBLIC_PADDLE_ENV         sandbox | live   (default: sandbox)
 *   NEXT_PUBLIC_PADDLE_CLIENT_TOKEN  Paddle client-side token
 *
 * Price IDs arrive as props from the server component (see /pricing),
 * which reads PRI_* from the server env at request time — no rebuild
 * needed to rotate prices.
 *
 * The license chain after payment: Paddle webhook → license issuance →
 * branded key email (docs/BILLING-AND-LICENSES.md).
 */

interface PaddleCheckoutButtonProps {
  priceId: string | null;
  label: string;
  planName: string;
  customerEmail?: string | null;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  className?: string;
  disabled?: boolean;
}

declare global {
  interface Window {
    Paddle?: {
      Initialize: (opts: Record<string, unknown>) => void;
      Environment: { set: (environment: 'sandbox') => void };
      Checkout: {
        open: (opts: Record<string, unknown>) => void;
      };
    };
  }
}

let paddleScriptPromise: Promise<void> | null = null;
let initializedToken: string | null = null;

function initializePaddle(clientToken: string, environment: 'sandbox' | 'live') {
  if (!window.Paddle || initializedToken === clientToken) return;
  if (environment === 'sandbox') window.Paddle.Environment.set('sandbox');
  window.Paddle.Initialize({ token: clientToken });
  initializedToken = clientToken;
}

export function usePaddleReady(clientToken: string | null): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!clientToken) return;
    const environment = process.env.NEXT_PUBLIC_PADDLE_ENV === 'live' ? 'live' : 'sandbox';
    if (window.Paddle) {
      initializePaddle(clientToken, environment);
      setReady(true);
      return;
    }
    if (!paddleScriptPromise) {
      paddleScriptPromise = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Paddle.js failed to load'));
        document.head.appendChild(script);
      });
    }
    paddleScriptPromise
      .then(() => {
        initializePaddle(clientToken, environment);
        setReady(true);
      })
      .catch(() => setReady(false));
  }, [clientToken]);

  return ready;
}

export function PaddleCheckoutButton({
  priceId,
  label,
  planName,
  customerEmail,
  variant = 'default',
  className,
  disabled,
}: PaddleCheckoutButtonProps) {
  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? null;
  const environment = process.env.NEXT_PUBLIC_PADDLE_ENV === 'live' ? 'live' : 'sandbox';
  const ready = usePaddleReady(clientToken);
  const [opening, setOpening] = useState(false);

  const open = useCallback(() => {
    if (!ready || !priceId || !window.Paddle) return;
    setOpening(true);
    try {
      window.Paddle.Checkout.open({
        settings: {
          displayMode: 'overlay',
          theme: 'light',
          successUrl: `${window.location.origin}/pricing?checkout=success`,
        },
        items: [{ priceId, quantity: 1 }],
        customData: { product: 'chatbotistic', plan: planName },
        ...(customerEmail ? { customer: { email: customerEmail } } : {}),
      });
    } finally {
      // Paddle owns the overlay from here; re-enable quickly so a
      // closed overlay can be re-opened without a page reload.
      setTimeout(() => setOpening(false), 1500);
    }
  }, [ready, priceId, planName, customerEmail]);

  if (!clientToken || !priceId) {
    return (
      <Button variant={variant} className={className} disabled title="Checkout not configured yet — set NEXT_PUBLIC_PADDLE_CLIENT_TOKEN and the plan's price ID">
        {label}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      className={className}
      disabled={disabled || !ready || opening}
      onClick={open}
    >
      {opening && <Loader2 className="size-4 animate-spin" />}
      {label}
      {environment === 'sandbox' && <span className="sr-only">(test mode)</span>}
    </Button>
  );
}
