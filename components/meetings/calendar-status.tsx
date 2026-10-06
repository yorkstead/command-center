"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { syncCalendarNow } from "@/lib/actions/calendar";
import { Button } from "@/components/ui/button";
import type { CalendarStatus } from "@/lib/db/types";

/** One line under the Meetings header: is Google Calendar connected, and when did it last sync. */
export function CalendarStatusBar({
  status,
  result,
  syncedAgo,
}: {
  status: CalendarStatus | null;
  result: string | null;
  syncedAgo: string | null;
}) {
  const [pending, startTransition] = useTransition();

  if (!status) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm md:px-6">
        <span className="text-muted-foreground">
          {result === "failed" ? "Connecting Google Calendar didn't work. Try again." : "Google Calendar isn't connected."}
        </span>
        <a href="/api/calendar/google/connect" className="font-medium underline underline-offset-2">
          Connect Google Calendar
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm md:px-6">
      <span className="text-muted-foreground">
        Syncing from Google Calendar as {status.account_email}
        {syncedAgo ? `, last synced ${syncedAgo}` : result === "connected" ? ", first sync running" : ""}.
      </span>
      {status.last_error ? (
        <span className="text-destructive" role="alert">
          Last sync failed: {status.last_error}
        </span>
      ) : null}
      <span className="ml-auto flex items-center gap-2">
        <Button variant="ghost" disabled={pending} onClick={() => startTransition(() => syncCalendarNow())}>
          <RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden />
          {pending ? "Syncing…" : "Sync now"}
        </Button>
        <a href="/api/calendar/google/connect" className="text-xs text-muted-foreground underline underline-offset-2">
          Reconnect
        </a>
      </span>
    </div>
  );
}
