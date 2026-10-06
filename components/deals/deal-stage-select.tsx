"use client";

import { useState, useTransition } from "react";
import { moveDealStage } from "@/lib/actions/deals";
import { DEAL_STAGES } from "@/lib/labels";
import type { DealStage } from "@/lib/db/types";

export function DealStageSelect({ id, stage }: { id: string; stage: DealStage }) {
  const [value, setValue] = useState(stage);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: DealStage) {
    let lostReason: string | null = null;
    if (next === "lost") {
      lostReason = prompt("Why was this deal lost?")?.trim() || null;
      if (!lostReason) return;
    }
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await moveDealStage({ id, stage: next, lost_reason: lostReason });
      if (!result.ok) {
        setValue(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <select
        aria-label="Stage"
        value={value}
        disabled={pending}
        onChange={(e) => change(e.target.value as DealStage)}
        className="h-7 w-full rounded-sm border bg-surface-raised px-1 text-xs"
      >
        {DEAL_STAGES.map((s) => (
          <option key={s.value} value={s.value}>Move to: {s.label}</option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
