import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { adminListActivityHeads, adminDeleteActivityHead, getMe } from "@/lib/crm.functions";
import { Users, Trash2, ChevronRight, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — Activity Heads" }] }),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const getMeFn = useServerFn(getMe);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });
  const navigate = useNavigate();
  useEffect(() => {
    if (me && me.role !== "admin") navigate({ to: "/" });
  }, [me, navigate]);

  const listFn = useServerFn(adminListActivityHeads);
  const { data: heads, isLoading } = useQuery({
    queryKey: ["admin-activity-heads"],
    queryFn: () => listFn(),
    enabled: me?.role === "admin",
  });

  const qc = useQueryClient();
  const deleteFn = useServerFn(adminDeleteActivityHead);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const delMut = useMutation({
    mutationFn: (user_id: string) => deleteFn({ data: { user_id } }),
    onSuccess: () => {
      toast.success("Activity head deleted");
      qc.invalidateQueries({ queryKey: ["admin-activity-heads"] });
      setConfirmDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (me?.role !== "admin") return null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
          <Users className="size-6" /> Activity Heads
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Click an activity head to see all of their leads. You can also remove their account entirely.
        </p>
      </header>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Leads</th>
              <th className="px-4 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && (heads?.length ?? 0) === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No activity heads yet. They appear here as soon as someone signs up.</td></tr>
            )}
            {heads?.map((h) => (
              <tr key={h.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link
                    to="/admin/users/$userId"
                    params={{ userId: h.id }}
                    className="font-medium hover:underline inline-flex items-center gap-1.5"
                  >
                    {h.full_name}
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{h.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{h.lead_count}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setConfirmDelete({ id: h.id, name: h.full_name })}
                    className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => setConfirmDelete(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md p-5">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-full bg-destructive/10 grid place-items-center">
                <AlertTriangle className="size-5 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Delete this account?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This will permanently remove <strong>{confirmDelete.name}</strong>, their login, and all of their leads and updates. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-3 py-2 text-sm rounded-md border border-border">Cancel</button>
              <button
                onClick={() => delMut.mutate(confirmDelete.id)}
                disabled={delMut.isPending}
                className="px-3 py-2 text-sm rounded-md bg-destructive text-destructive-foreground disabled:opacity-60"
              >
                {delMut.isPending ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
