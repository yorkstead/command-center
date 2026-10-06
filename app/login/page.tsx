import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedInEmail = data?.claims?.email as string | undefined;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-md border bg-card p-6">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Yorkstead</p>
        <h1 className="mt-1 text-lg font-semibold">Command Center</h1>

        {error === "not-on-team" && signedInEmail ? (
          <div className="mt-4 space-y-3 text-sm">
            <p>
              You&apos;re signed in as <strong>{signedInEmail}</strong>, but that account isn&apos;t on the team yet.
              Ask Brandon to add you.
            </p>
            <form action={signOut}>
              <Button type="submit">Sign out</Button>
            </form>
          </div>
        ) : (
          <>
            {error === "link" ? (
              <p className="mt-4 text-sm text-destructive">That sign-in link expired or was already used. Send a new one.</p>
            ) : null}
            <LoginForm />
          </>
        )}
      </div>
    </main>
  );
}
