import { LogOut } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import { MobileTabBar, SidebarNav } from "@/components/shell/nav";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { RealtimeRefresh } from "@/components/shell/realtime-refresh";
import { OwnerAvatar } from "@/components/ui/badge";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { me } = await requireMember();

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[13rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-surface px-3 py-4 md:flex">
        <div className="px-2.5 pb-4">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Yorkstead</p>
          <p className="text-sm font-semibold">Command Center</p>
        </div>
        <SidebarNav />
        <div className="mt-auto flex items-center gap-2 border-t pt-3">
          <OwnerAvatar initials={me.initials} />
          <span className="truncate text-sm">{me.display_name}</span>
          <div className="ml-auto flex">
            <ThemeToggle />
            <form action={signOut}>
              <button
                type="submit"
                aria-label="Sign out"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <LogOut className="size-4" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <header className="flex items-center justify-between border-b bg-surface px-4 py-2 md:hidden">
        <p className="text-sm font-semibold">Command Center</p>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
          <OwnerAvatar initials={me.initials} title={me.display_name} />
        </div>
      </header>

      <main className="min-w-0 pb-20 md:pb-0">{children}</main>
      <MobileTabBar />
      <RealtimeRefresh />
    </div>
  );
}
