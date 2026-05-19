import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 text-center ring-1 ring-foreground/[0.06] shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Compass className="h-6 w-6" />
        </div>
        <p className="mt-4 font-heading text-4xl font-bold tracking-tight text-foreground">
          404
        </p>
        <h1 className="mt-1 font-heading text-lg font-semibold text-foreground">
          Page not found
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have been
          moved.
        </p>
        <Button render={<Link href="/dashboard" />} className="mt-5">
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
