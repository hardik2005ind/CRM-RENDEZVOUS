import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import toast from "react-hot-toast";
import {
  listMyLeads,
  createLead,
  addLeadUpdate,
  listLeadHistory,
  deleteMyLead,
  updateMyLead,
  listLeadComments,
  markLeadCommentsRead,
  listMyLeadCommentCounts,
  adminAddLeadComment,
} from "@/lib/crm.functions";
import { Plus, X, Clock, User2, MessageSquarePlus, Search, Phone, Building2, Tag, Trash2, Pencil, Mail, Bell, MessageCircle } from "lucide-react";

const LEAD_STATUSES = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"] as const;

export function Dashboard() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add leads, log updates, and review their complete timeline.
          </p>
        </div>
        <NotificationsBell />
      </header>
      <LeadsView />
    </div>
  );
}

function LeadsView() {
  const listFn = useServerFn(listMyLeads);
  const countsFn = useServerFn(listMyLeadCommentCounts);
  const { data: leads, isLoading } = useQuery({
    queryKey: ["my-leads"],
    queryFn: () => listFn(),
  });
  const { data: counts } = useQuery({
    queryKey: ["my-lead-comment-counts"],
    queryFn: () => countsFn(),
    refetchInterval: 30000,
  });
  const unreadByLead = counts?.unreadByLead ?? {};
  const [addOpen, setAddOpen] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const filteredLeads = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return leads ?? [];
    return (leads ?? []).filter((lead) =>
      [lead.name, lead.company_name, lead.poc_name, lead.contact_number, lead.latest_description, lead.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [leads, query]);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lead, company, POC, status…"
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm hover:bg-primary/90"
        >
          <Plus className="size-4" /> Add lead
        </button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Lead</th>
              <th className="px-4 py-2.5 font-medium">Company</th>
              <th className="px-4 py-2.5 font-medium">POC</th>
              <th className="px-4 py-2.5 font-medium">Contact</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Updated</th>
              <th className="px-4 py-2.5 font-medium w-10"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && (leads?.length ?? 0) === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">No leads yet. Click “Add lead” to get started.</td></tr>
            )}
            {!isLoading && (leads?.length ?? 0) > 0 && filteredLeads.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">No leads match your search.</td></tr>
            )}
            {filteredLeads.map((l) => (
              <tr
                key={l.id}
                onClick={() => setActiveLeadId(l.id)}
                className="border-t border-border hover:bg-muted/30 cursor-pointer"
              >
                <td className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-2">
                    {unreadByLead[l.id] ? (
                      <span
                        className="size-2 rounded-full bg-red-500 shrink-0"
                        title={`${unreadByLead[l.id]} new admin comment(s)`}
                      />
                    ) : null}
                    {l.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{l.company_name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.poc_name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.contact_number ?? "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {new Date(l.last_updated_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <DeleteLeadButton leadId={l.id} leadName={l.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addOpen && <AddLeadModal onClose={() => setAddOpen(false)} />}
      {activeLeadId && (
        <LeadHistoryModal
          leadId={activeLeadId}
          onClose={() => setActiveLeadId(null)}
        />
      )}
    </>
  );
}

function DeleteLeadButton({ leadId, leadName }: { leadId: string; leadName: string }) {
  const qc = useQueryClient();
  const delFn = useServerFn(deleteMyLead);
  const mut = useMutation({
    mutationFn: () => delFn({ data: { lead_id: leadId } }),
    onSuccess: () => {
      toast.success("Lead deleted");
      qc.invalidateQueries({ queryKey: ["my-leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <button
      onClick={() => {
        if (window.confirm(`Delete lead "${leadName}"? This cannot be undone.`)) mut.mutate();
      }}
      disabled={mut.isPending}
      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-50"
      title="Delete lead"
    >
      <Trash2 className="size-4" />
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    new: "bg-muted text-foreground/70",
    contacted: "bg-blue-100 text-blue-800",
    qualified: "bg-indigo-100 text-indigo-800",
    proposal: "bg-purple-100 text-purple-800",
    negotiation: "bg-amber-100 text-amber-800",
    won: "bg-green-100 text-green-800",
    lost: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colorMap[status] ?? "bg-muted"}`}>
      {status}
    </span>
  );
}

function AddLeadModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createLead);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [pocName, setPocName] = useState("");
  const [contact, setContact] = useState("");
  const [secondaryContact, setSecondaryContact] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<typeof LEAD_STATUSES[number]>("new");
  const [description, setDescription] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          name,
          company_name: company,
          poc_name: pocName || null,
          contact_number: contact || null,
          secondary_contact_number: secondaryContact || null,
          email: email || null,
          status,
          description,
        },
      }),
    onSuccess: () => {
      toast.success("Lead added");
      qc.invalidateQueries({ queryKey: ["my-leads"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ModalShell title="Add lead" onClose={onClose}>
      <form
        onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
        className="space-y-4"
      >
        <Field label="Lead name" required>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Q3 partnership pitch" />
        </Field>
        <Field label="Company name" required>
          <input required value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} placeholder="e.g. Acme Corp" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="POC name">
            <input value={pocName} onChange={(e) => setPocName(e.target.value)} className={inputCls} placeholder="Jane Doe" />
          </Field>
          <Field label="Contact number">
            <input value={contact} onChange={(e) => setContact(e.target.value)} className={inputCls} placeholder="+91 98765 43210" />
          </Field>
          <Field label="Secondary phone (optional)">
            <input value={secondaryContact} onChange={(e) => setSecondaryContact(e.target.value)} className={inputCls} placeholder="+91 98765 00000" />
          </Field>
          <Field label="Email address (optional)">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="jane@acme.com" />
          </Field>
        </div>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof LEAD_STATUSES[number])} className={inputCls}>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Initial description" required>
          <textarea
            required rows={4}
            value={description} onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
            placeholder="First contact notes, what was discussed, next steps…"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm rounded-md border border-border">Cancel</button>
          <button
            type="submit" disabled={mut.isPending}
            className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-60"
          >{mut.isPending ? "Saving…" : "Save lead"}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function EditLeadModal({ lead, onClose }: { lead: any; onClose: () => void }) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateMyLead);
  const [name, setName] = useState(lead.name ?? "");
  const [company, setCompany] = useState(lead.company_name ?? "");
  const [pocName, setPocName] = useState(lead.poc_name ?? "");
  const [contact, setContact] = useState(lead.contact_number ?? "");
  const [secondaryContact, setSecondaryContact] = useState(lead.secondary_contact_number ?? "");
  const [email, setEmail] = useState(lead.email ?? "");

  const mut = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          lead_id: lead.id,
          name,
          company_name: company,
          poc_name: pocName || null,
          contact_number: contact || null,
          secondary_contact_number: secondaryContact || null,
          email: email || null,
        },
      }),
    onSuccess: () => {
      toast.success("Lead updated");
      qc.invalidateQueries({ queryKey: ["my-leads"] });
      qc.invalidateQueries({ queryKey: ["lead-history", lead.id] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ModalShell title="Edit lead" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
        <Field label="Lead name" required>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Company name" required>
          <input required value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="POC name">
            <input value={pocName} onChange={(e) => setPocName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Contact number">
            <input value={contact} onChange={(e) => setContact(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Secondary phone (optional)">
            <input value={secondaryContact} onChange={(e) => setSecondaryContact(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Email address (optional)">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm rounded-md border border-border">Cancel</button>
          <button type="submit" disabled={mut.isPending} className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-60">
            {mut.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function LeadHistoryModal({
  leadId, onClose,
}: { leadId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const historyFn = useServerFn(listLeadHistory);
  const addFn = useServerFn(addLeadUpdate);
  const { data, isLoading } = useQuery({
    queryKey: ["lead-history", leadId],
    queryFn: () => historyFn({ data: { lead_id: leadId } }),
  });
  const [desc, setDesc] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");
  const [editOpen, setEditOpen] = useState(false);

  const mut = useMutation({
    mutationFn: () => addFn({ data: { lead_id: leadId, description: desc, status: newStatus || null } }),
    onSuccess: () => {
      toast.success("Update added");
      setDesc("");
      setNewStatus("");
      qc.invalidateQueries({ queryKey: ["lead-history", leadId] });
      qc.invalidateQueries({ queryKey: ["my-leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lead = data?.lead;

  return (
    <ModalShell title={lead?.name ? `${lead.name}` : "Lead history"} onClose={onClose} wide>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          {lead && (
            <>
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-border hover:bg-muted"
                >
                  <Pencil className="size-3.5" /> Edit details
                </button>
              </div>
              <LeadDetailsHeader lead={lead} />
            </>
          )}

          <LeadCommentsSection leadId={leadId} canPost={false} />

          <h3 className="text-sm font-semibold mb-3">Timeline</h3>
          <ol className="relative border-l border-border pl-5 space-y-4">
            {(data?.updates ?? []).map((u, idx) => (
              <li key={u.id} className="relative">
                <span className="absolute -left-[27px] top-1.5 size-3 rounded-full bg-primary" />
                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1"><Clock className="size-3" />{new Date(u.created_at).toLocaleString()}</span>
                  <span className="inline-flex items-center gap-1"><User2 className="size-3" />{u.author?.full_name ?? u.author?.email ?? "Unknown"}</span>
                  {idx === 0 && <span className="px-1.5 py-0.5 rounded bg-muted text-foreground/70">First contact</span>}
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{u.description}</p>
              </li>
            ))}
            {(data?.updates?.length ?? 0) === 0 && (
              <li className="text-sm text-muted-foreground">No updates yet.</li>
            )}
          </ol>

          <form
            onSubmit={(e) => { e.preventDefault(); if (desc.trim()) mut.mutate(); }}
            className="mt-6 border-t border-border pt-4 space-y-3"
          >
            <Field label="Add new update">
              <textarea
                rows={3} value={desc} onChange={(e) => setDesc(e.target.value)}
                className={inputCls} placeholder="What happened next?"
              />
            </Field>
            <Field label="Change status (optional)">
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className={inputCls}>
                <option value="">Keep current ({lead?.status})</option>
                {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <div className="flex justify-end">
              <button
                type="submit" disabled={mut.isPending || !desc.trim()}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-60"
              >
                <MessageSquarePlus className="size-4" />
                {mut.isPending ? "Saving…" : "Add update"}
              </button>
            </div>
          </form>
        </>
      )}
      {editOpen && lead && (
        <EditLeadModal lead={lead} onClose={() => setEditOpen(false)} />
      )}
    </ModalShell>
  );
}

export function LeadDetailsHeader({ lead }: { lead: any }) {
  return (
    <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-muted/30 rounded-md p-4">
      <Detail icon={<Building2 className="size-3.5" />} label="Company" value={lead.company_name ?? "—"} />
      <Detail icon={<Tag className="size-3.5" />} label="Status" value={<StatusBadge status={lead.status} />} />
      <Detail icon={<User2 className="size-3.5" />} label="POC" value={lead.poc_name ?? "—"} />
      <Detail icon={<Phone className="size-3.5" />} label="Contact" value={lead.contact_number ?? "—"} />
      <Detail icon={<Phone className="size-3.5" />} label="Secondary phone" value={lead.secondary_contact_number ?? "—"} />
      <Detail icon={<Mail className="size-3.5" />} label="Email" value={lead.email ?? "—"} />
      {lead.owner && (
        <Detail icon={<User2 className="size-3.5" />} label="Owner" value={lead.owner.full_name ?? lead.owner.email} />
      )}
      <Detail icon={<Clock className="size-3.5" />} label="Last updated" value={new Date(lead.last_updated_at).toLocaleString()} />
    </div>
  );
}


function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">{icon}{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

// --- helpers ---
const inputCls =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">
        {label}{required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
  );
}

function ModalShell({
  title, onClose, children, wide,
}: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-card border border-border rounded-lg shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-auto`}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export { StatusBadge };

// --- Admin comments + notifications ---------------------------------------

export function LeadCommentsSection({
  leadId,
  canPost,
  onPosted,
}: {
  leadId: string;
  canPost: boolean;
  onPosted?: () => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listLeadComments);
  const markFn = useServerFn(markLeadCommentsRead);
  const { data: comments } = useQuery({
    queryKey: ["lead-comments", leadId],
    queryFn: () => listFn({ data: { lead_id: leadId } }),
  });

  // Owner: mark read once when opened
  const markedRef = useRef(false);
  useEffect(() => {
    if (canPost) return; // admin shouldn't mark as read
    if (markedRef.current) return;
    if (!comments || comments.length === 0) return;
    const hasUnread = comments.some((c: any) => !c.read_at);
    if (!hasUnread) return;
    markedRef.current = true;
    markFn({ data: { lead_id: leadId } })
      .then(() => {
        qc.invalidateQueries({ queryKey: ["lead-comments", leadId] });
        qc.invalidateQueries({ queryKey: ["my-lead-comment-counts"] });
      })
      .catch(() => {});
  }, [comments, canPost, leadId, markFn, qc]);

  return (
    <div className="mb-6 rounded-md border border-border bg-muted/20 p-4">
      <h3 className="text-sm font-semibold mb-3 inline-flex items-center gap-1.5">
        <MessageCircle className="size-4" /> Admin notes
      </h3>
      <ul className="space-y-3">
        {(comments ?? []).length === 0 && (
          <li className="text-xs text-muted-foreground">No admin notes on this lead yet.</li>
        )}
        {(comments ?? []).map((c: any) => (
          <li key={c.id} className="rounded-md bg-card border border-border p-3">
            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1"><User2 className="size-3" />{c.author?.full_name ?? c.author?.email ?? "Admin"}</span>
              <span className="inline-flex items-center gap-1"><Clock className="size-3" />{new Date(c.created_at).toLocaleString()}</span>
            </div>
            <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
          </li>
        ))}
      </ul>
      {canPost && <AdminAddCommentForm leadId={leadId} onPosted={onPosted} />}
    </div>
  );
}

function AdminAddCommentForm({ leadId, onPosted }: { leadId: string; onPosted?: () => void }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const addFn = useServerFn(adminAddLeadComment);
  const mut = useMutation({
    mutationFn: () => addFn({ data: { lead_id: leadId, body } }),
    onSuccess: () => {
      toast.success("Comment posted");
      setBody("");
      qc.invalidateQueries({ queryKey: ["lead-comments", leadId] });
      onPosted?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (body.trim()) mut.mutate(); }}
      className="mt-3 space-y-2"
    >
      <textarea
        rows={3} value={body} onChange={(e) => setBody(e.target.value)}
        className={inputCls}
        placeholder="Write a note, task or review for this lead's owner…"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={mut.isPending || !body.trim()}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-60"
        >
          <MessageSquarePlus className="size-4" />
          {mut.isPending ? "Posting…" : "Post comment"}
        </button>
      </div>
    </form>
  );
}

function NotificationsBell() {
  const qc = useQueryClient();
  const countsFn = useServerFn(listMyLeadCommentCounts);
  const { data } = useQuery({
    queryKey: ["my-lead-comment-counts"],
    queryFn: () => countsFn(),
    refetchInterval: 30000,
  });
  const [open, setOpen] = useState(false);
  const total = data?.totalUnread ?? 0;
  const recent = data?.recent ?? [];
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center size-9 rounded-md border border-border bg-card hover:bg-muted"
        title="Notifications"
      >
        <Bell className="size-4" />
        {total > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-medium grid place-items-center">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 z-50 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <span className="text-sm font-semibold">Notifications</span>
              <span className="text-xs text-muted-foreground">{total} new</span>
            </div>
            <ul className="max-h-80 overflow-auto">
              {recent.length === 0 && (
                <li className="px-4 py-6 text-center text-xs text-muted-foreground">No new admin comments.</li>
              )}
              {recent.map((n: any) => (
                <li key={n.id}>
                  <button
                    onClick={() => { setActiveLeadId(n.lead_id); setOpen(false); }}
                    className="w-full text-left px-4 py-3 hover:bg-muted/40 border-b border-border last:border-b-0"
                  >
                    <div className="text-xs text-muted-foreground flex items-center justify-between">
                      <span className="font-medium text-foreground truncate">
                        {n.lead?.name ?? "Lead"}{n.lead?.company_name ? ` · ${n.lead.company_name}` : ""}
                      </span>
                      <span>{new Date(n.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-1 text-sm line-clamp-2">{n.body}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      {activeLeadId && (
        <LeadHistoryModal
          leadId={activeLeadId}
          onClose={() => {
            setActiveLeadId(null);
            qc.invalidateQueries({ queryKey: ["my-lead-comment-counts"] });
          }}
        />
      )}
    </div>
  );
}
