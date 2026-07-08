"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface DocsNavGroup {
  heading: string;
  items: { id: string; label: string }[];
}

/**
 * Sticky sidebar for the single-page docs: anchor links per section,
 * with the active section tracked via IntersectionObserver (scrollspy).
 * On small screens it renders as a horizontally scrollable chip bar.
 */
export function DocsNav({ groups }: { groups: DocsNavGroup[] }) {
  const [active, setActive] = useState<string>(groups[0]?.items[0]?.id ?? "");

  useEffect(() => {
    const ids = groups.flatMap((g) => g.items.map((i) => i.id));
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Prefer the section whose heading most recently entered the
        // reading band — i.e. the lowest top. Sorting ascending would keep
        // the previous (taller, still-overlapping) section highlighted
        // after an anchor jump.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.boundingClientRect.top - a.boundingClientRect.top);
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [groups]);

  return (
    <>
      {/* Mobile: chip bar */}
      <nav
        aria-label="Documentation sections"
        className="sticky top-16 z-30 -mx-4 mb-8 flex gap-2 overflow-x-auto border-b border-border bg-background/90 px-4 py-3 backdrop-blur-lg lg:hidden"
      >
        {groups.flatMap((group) =>
          group.items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                active === item.id
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </a>
          )),
        )}
      </nav>

      {/* Desktop: sticky sidebar */}
      <nav
        aria-label="Documentation sections"
        className="sticky top-24 hidden max-h-[calc(100dvh-8rem)] w-60 shrink-0 overflow-y-auto pr-4 lg:block"
      >
        {groups.map((group) => (
          <div key={group.heading} className="mb-6">
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {group.heading}
            </p>
            <ul className="space-y-0.5 border-l border-border">
              {group.items.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className={cn(
                      "-ml-px block border-l-2 py-1.5 pl-3.5 text-sm transition-colors",
                      active === item.id
                        ? "border-primary font-medium text-primary"
                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
