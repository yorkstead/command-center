import { cn } from "@/lib/cn";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "text-muted-foreground border-border",
  info: "text-info border-info/40",
  success: "text-success border-success/40",
  warning: "text-warning border-warning/40",
  danger: "text-destructive border-destructive/40",
};

// Low-key outlined badge: status should be readable, not shouty.
export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded-sm border px-1.5 text-[11px] font-medium whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

export function OwnerAvatar({ initials, title }: { initials?: string | null; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border bg-surface text-[10px] font-semibold text-muted-foreground"
    >
      {initials ?? "—"}
    </span>
  );
}
