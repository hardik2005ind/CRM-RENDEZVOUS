import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/stores/auth";
import { getMe } from "@/lib/crm.functions";
import { Building2, LayoutDashboard, LogOut, Users, ShieldCheck, Search } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated")({
  component: ProtectedLayout,
});

function ProtectedLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const getMeFn = useServerFn(getMe);
  const meQuery = useQuery({
    queryKey: ["me", user?.id],
    queryFn: () => getMeFn(),
    enabled: !!user,
  });

  const me = meQuery.data;
  const isAdmin = me?.role === "admin";

  // Route guard: admin lands on /admin, activity heads on /
  useEffect(() => {
    if (!me) return;
    if (isAdmin && pathname === "/") navigate({ to: "/admin" });
    if (!isAdmin && pathname.startsWith("/admin")) navigate({ to: "/" });
  }, [me, isAdmin, pathname, navigate]);

  if (loading || !user || meQuery.isLoading || !me) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading…</div>;
  }

  const navItems = isAdmin
    ? [
        { to: "/admin" as const, label: "Activity Heads", Icon: Users },
        { to: "/directory" as const, label: "Directory", Icon: Search },
      ]
    : [
        { to: "/" as const, label: "My Leads", Icon: LayoutDashboard },
        { to: "/directory" as const, label: "Directory", Icon: Search },
      ];

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 shrink-0 bg-sidebar-bg text-sidebar-fg flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-white/5">
          <div className="size-8 rounded-md bg-teal text-teal-foreground grid place-items-center">
            <Building2 className="size-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold tracking-tight leading-none">Lead Hub</span>
            <span className="text-[10px] text-sidebar-muted mt-0.5 inline-flex items-center gap-1">
              {isAdmin ? <><ShieldCheck className="size-3" /> Admin portal</> : "Activity Head"}
            </span>
          </div>
        </div>

        <nav className="px-3 py-4 space-y-1 flex-1">
          {navItems.map(({ to, label, Icon }) => {
            const active = pathname === to || (to === "/admin" && pathname.startsWith("/admin"));
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active ? "bg-sidebar-active text-sidebar-fg" : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-fg"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="text-xs text-sidebar-muted">Signed in as</div>
          <div className="text-sm font-medium truncate">{me.profile?.full_name ?? user.email}</div>
          <div className="text-xs text-sidebar-muted capitalize mt-0.5">{me.role?.replace("_", " ")}</div>
          <button
            onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
            className="mt-3 inline-flex items-center gap-2 text-xs text-sidebar-muted hover:text-sidebar-fg"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
