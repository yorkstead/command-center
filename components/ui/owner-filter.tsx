import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Profile } from "@/lib/db/types";

/** "Mine / Eric / Everyone" switch, kept in the URL so it survives refresh and can be shared. */
export function OwnerFilter({
  basePath,
  current,
  team,
  meId,
  extraParams = {},
}: {
  basePath: string;
  current: string;
  team: Profile[];
  meId: string;
  extraParams?: Record<string, string | undefined>;
}) {
  const options = [
    { value: "me", label: "Mine" },
    ...team.filter((m) => m.id !== meId).map((m) => ({ value: m.id, label: m.display_name })),
    { value: "all", label: "Everyone" },
  ];

  return (
    <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Whose work">
      {options.map((o) => {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(extraParams)) if (v) params.set(k, v);
        if (o.value !== "me") params.set("owner", o.value);
        const qs = params.toString();
        return (
          <Link
            key={o.value}
            href={qs ? `${basePath}?${qs}` : basePath}
            className={cn(
              "rounded-sm px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground",
              current === o.value && "bg-accent font-medium text-foreground",
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Turns the owner URL value into a profile id to filter on, or null for everyone. */
export function resolveOwner(param: string | undefined, meId: string, team: Profile[]): { key: string; ownerId: string | null } {
  if (param === "all") return { key: "all", ownerId: null };
  if (param && team.some((m) => m.id === param)) return { key: param, ownerId: param };
  return { key: "me", ownerId: meId };
}
