import { cn } from "@/lib/cn";

export const fieldClass =
  "h-8 rounded-md border border-input bg-surface-raised px-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldClass, "pr-7", className)} {...props} />;
}
