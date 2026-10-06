"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarDays, Columns3, ListChecks, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

export const NAV = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/work", label: "Work", icon: ListChecks },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/meetings", label: "Meetings", icon: CalendarDays },
  { href: "/clients", label: "Clients", icon: Building2 },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
            isActive(pathname, href) && "bg-accent font-medium text-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground",
            isActive(pathname, href) && "text-foreground",
          )}
        >
          <Icon className="size-5" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
