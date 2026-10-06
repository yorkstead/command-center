"use client";

import { useActionState } from "react";
import { sendMagicLink, type SignInState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return <p className="mt-4 text-sm">{state.message} Open it on this device.</p>;
  }

  return (
    <form action={action} className="mt-4 space-y-3">
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Work email</span>
        <Input name="email" type="email" autoComplete="email" required className="w-full" />
      </label>
      {state.status === "error" ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <Button type="submit" variant="primary" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
