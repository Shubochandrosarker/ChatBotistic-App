"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { describeAuthError } from "@/lib/supabase/auth-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthShell } from "@/components/brand/auth-shell";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"email" | "chatbotistic">("email");
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "chatbotistic") {
      // Login bridge — credentials are verified against the
      // white-label backend (tochat) first; the API mirrors/syncs the
      // account + workspace + widget connection server-side, then we
      // sign in locally with the same credentials. No password is
      // stored client-side beyond this session request.
      try {
        const res = await fetch("/api/auth/bridge-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Could not sign in with your Chatbotistic account.");
          setLoading(false);
          return;
        }
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setError(describeAuthError(signInError.message));
          setLoading(false);
          return;
        }
        router.push("/dashboard");
        return;
      } catch {
        setError("Network error — please try again.");
        setLoading(false);
        return;
      }
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(describeAuthError(error.message));
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <AuthShell>
      <Card className="w-full border-border bg-card elevation-2">
        <CardHeader>
          <CardTitle className="font-heading text-[22px] font-bold text-foreground">Welcome back</CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in to your account
          </CardDescription>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "email"}
              onClick={() => { setMode("email"); setError(null); }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "email"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Email
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "chatbotistic"}
              onClick={() => { setMode("chatbotistic"); setError(null); }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "chatbotistic"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Chatbotistic
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {mode === "chatbotistic" && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
                Use your <span className="font-medium text-foreground">app.chatbotistic.com</span> account
                — same email &amp; password. We&apos;ll connect your widgets automatically.
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-foreground">
                  Password
                </Label>
                {mode === "email" && (
                  <Link
                    href="/forgot-password"
                    className="text-sm text-primary hover:text-primary"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-10 w-full bg-primary text-primary-foreground hover:bg-primary disabled:opacity-50"
            >
              {loading
                ? "Signing in..."
                : mode === "chatbotistic"
                  ? "Sign in with Chatbotistic"
                  : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-primary hover:text-primary"
            >
              Create account
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
