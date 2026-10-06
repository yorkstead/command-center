import type { ActionResult } from "@/lib/validation";

export function FormError({ state }: { state: ActionResult | null }) {
  if (!state || state.ok) return null;
  return <p className="text-sm text-destructive" role="alert">{state.error}</p>;
}
