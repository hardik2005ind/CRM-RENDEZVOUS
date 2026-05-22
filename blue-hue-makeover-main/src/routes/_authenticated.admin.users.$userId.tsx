import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { adminListLeadsForUser, adminGetLeadHistory, getMe } from "@/lib/crm.functions";
import { LeadDetailsHeader, StatusBadge, LeadCommentsSection } from "@/components/crm/Dashboard";
import { ArrowLeft, Clock, User2, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users/$userId")({
  head: () => ({ meta: [{ title: "Admin — Activity Head leads" }] }),
  component: AdminUserLeadsPage,
});

function AdminUserLeadsPage() {
  const { userId } = Route.useParams();
  const getMeFn = useServerFn(getMe);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });
  const navigate = useNavigate();
  useEffect(() => { if (me && me.role !== "admin") navigate({ to: "/" }); }, [me, navigate]);

  const listFn = useServerFn(adminListLeadsForUser);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-leads", userId],
    queryFn: () => listFn({ data: { user_id: userId } }),
    enabled: me?.role === "admin",
  });

  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);

  if (me?.role !== "admin") return null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="size-3.5" /> Back to activity heads
      </Link>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {data?.owner?.full_name ?? "Activity head"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{data?.owner?.email}</p>
      </header>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Lead</th>
              <th className="px-4 py-2.5 font-medium">Company</th>
              <th className="px-4 py-2.5 font-medium">POC contact</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Latest description</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && (data?.leads.length ?? 0) === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No leads yet for this activity head.</td></tr>
            )}
            {data?.leads.map((l) => (
              <tr key={l.id} onClick={() => setActiveLeadId(l.id)} className="border-t border-border hover:bg-muted/30 cursor-pointer">
                <td className="px-4 py-3 font-medium">{l.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.company_name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {l.poc_name ?? "—"}{l.contact_number ? ` · ${l.contact_number}` : ""}
                </td>
                <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                <td className="px-4 py-3 max-w-md truncate">{l.latest_description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeLeadId && (
        <AdminLeadModal leadId={activeLeadId} onClose={() => setActiveLeadId(null)} />
      )}
    </div>
  );
}

function AdminLeadModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const histFn = useServerFn(adminGetLeadHistory);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-lead-history", leadId],
    queryFn: () => histFn({ data: { lead_id: leadId } }),
  });
  const lead = data?.lead;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold">{lead?.name ?? "Lead"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <div className="p-5">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              {lead && <LeadDetailsHeader lead={lead} />}
              <LeadCommentsSection leadId={leadId} canPost />
              <h3 className="text-sm font-semibold mb-3">All updates</h3>
              <ol className="relative border-l border-border pl-5 space-y-4">
                {(data?.updates ?? []).map((u) => (
                  <li key={u.id} className="relative">
                    <span className="absolute -left-[27px] top-1.5 size-3 rounded-full bg-primary" />
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1"><Clock className="size-3" />{new Date(u.created_at).toLocaleString()}</span>
                      <span className="inline-flex items-center gap-1"><User2 className="size-3" />{u.author?.full_name ?? u.author?.email ?? "Unknown"}</span>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{u.description}</p>
                  </li>
                ))}
                {(data?.updates?.length ?? 0) === 0 && (
                  <li className="text-sm text-muted-foreground">No updates yet.</li>
                )}
              </ol>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
