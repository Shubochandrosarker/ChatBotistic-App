"use client"

import Link from 'next/link'
import { UserPlus, Briefcase, Radio, Zap } from 'lucide-react'
import type { ComponentType } from 'react'

// Quick-action shortcuts. Each navigates to the page that owns the
// relevant "create" flow. We deliberately don't try to auto-open any
// modal on the target page — that'd require touching those pages,
// which is out of scope here.
interface Action {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
  tint: string
}

const ACTIONS: Action[] = [
  {
    label: 'New Contact',
    href: '/contacts',
    icon: UserPlus,
    tint: 'bg-violet-500/12 text-violet-500 dark:text-violet-300',
  },
  {
    label: 'New Deal',
    href: '/pipelines',
    icon: Briefcase,
    tint: 'bg-blue-500/12 text-blue-500 dark:text-blue-300',
  },
  {
    label: 'New Broadcast',
    href: '/broadcasts/new',
    icon: Radio,
    tint: 'bg-amber-500/14 text-amber-600 dark:text-amber-300',
  },
  {
    label: 'New Automation',
    href: '/automations/new',
    icon: Zap,
    tint: 'bg-emerald-500/12 text-emerald-500 dark:text-emerald-300',
  },
]

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {ACTIONS.map((a) => {
        const Icon = a.icon
        return (
          <Link
            key={a.href}
            href={a.href}
            className="group flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 ring-1 ring-foreground/[0.06] shadow-sm transition-all hover:shadow-md hover:ring-foreground/15"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.tint}`}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-foreground">{a.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
