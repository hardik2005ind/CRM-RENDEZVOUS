import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// --- Current user + role ---------------------------------------------------
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const authClaims = claims as { email?: string; user_metadata?: { full_name?: string } };
    const email = authClaims.email?.toLowerCase() ?? "";
    const fullName = authClaims.user_metadata?.full_name?.trim() || email.split("@")[0] || "CRM User";

    if (email) {
      await supabaseAdmin.from("profiles").upsert({ id: userId, email, full_name: fullName });
      if (email === "admin@company.com") {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId).neq("role", "admin");
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
      } else {
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: userId, role: "activity_head" }, { onConflict: "user_id,role" });
      }
    }

    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const role = roles?.[0]?.role ?? "activity_head";
    return { profile, role, userId };
  });

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admin access required");
}

// --- Leads (activity head view) -------------------------------------------
export const listMyLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("owner_id", userId)
      .order("last_updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      name: z.string().min(1).max(200),
      company_name: z.string().min(1).max(200),
      poc_name: z.string().max(200).optional().nullable(),
      contact_number: z.string().max(50).optional().nullable(),
      secondary_contact_number: z.string().max(50).optional().nullable(),
      email: z.string().email().max(200).optional().nullable().or(z.literal("")),
      status: z.string().max(50).optional().nullable(),
      description: z.string().min(1).max(2000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        name: data.name,
        company_name: data.company_name,
        poc_name: data.poc_name ?? null,
        contact_number: data.contact_number ?? null,
        secondary_contact_number: data.secondary_contact_number ?? null,
        email: data.email ? data.email : null,
        status: data.status ?? "new",
        owner_id: userId,
        latest_description: data.description,
        last_updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { error: upErr } = await supabase.from("lead_updates").insert({
      lead_id: lead.id,
      description: data.description,
      created_by: userId,
    });
    if (upErr) throw new Error(upErr.message);
    return lead;
  });

export const addLeadUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      lead_id: z.string().uuid(),
      description: z.string().min(1).max(2000),
      status: z.string().max(50).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("lead_updates").insert({
      lead_id: data.lead_id,
      description: data.description,
      created_by: userId,
    });
    if (error) throw new Error(error.message);

    const { error: updErr } = await supabase
      .from("leads")
      .update({
        latest_description: data.description,
        last_updated_at: new Date().toISOString(),
        ...(data.status ? { status: data.status } : {}),
      })
      .eq("id", data.lead_id);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

export const listLeadHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ lead_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: lead, error: lErr } = await supabase
      .from("leads")
      .select("*")
      .eq("id", data.lead_id)
      .maybeSingle();
    if (lErr) throw new Error(lErr.message);
    if (!lead) throw new Error("Lead not found");

    const { data: updates, error: uErr } = await supabase
      .from("lead_updates")
      .select("id, description, created_by, created_at")
      .eq("lead_id", data.lead_id)
      .order("created_at", { ascending: true });
    if (uErr) throw new Error(uErr.message);

    const authorIds = Array.from(new Set([...(updates ?? []).map((u) => u.created_by), lead.owner_id]));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", authorIds);
    const byId = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));

    return {
      lead: { ...lead, owner: byId[lead.owner_id] ?? null },
      updates: (updates ?? []).map((u) => ({ ...u, author: byId[u.created_by] ?? null })),
    };
  });

export const updateMyLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      lead_id: z.string().uuid(),
      name: z.string().min(1).max(200),
      company_name: z.string().min(1).max(200),
      poc_name: z.string().max(200).optional().nullable(),
      contact_number: z.string().max(50).optional().nullable(),
      secondary_contact_number: z.string().max(50).optional().nullable(),
      email: z.string().email().max(200).optional().nullable().or(z.literal("")),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: lead, error: fErr } = await supabase
      .from("leads")
      .select("id, owner_id")
      .eq("id", data.lead_id)
      .maybeSingle();
    if (fErr) throw new Error(fErr.message);
    if (!lead) throw new Error("Lead not found");
    if (lead.owner_id !== userId) throw new Error("You can only edit your own leads");
    const { error } = await supabase
      .from("leads")
      .update({
        name: data.name,
        company_name: data.company_name,
        poc_name: data.poc_name ?? null,
        contact_number: data.contact_number ?? null,
        secondary_contact_number: data.secondary_contact_number ?? null,
        email: data.email ? data.email : null,
      })
      .eq("id", data.lead_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMyLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ lead_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: lead, error: fErr } = await supabase
      .from("leads")
      .select("id, owner_id")
      .eq("id", data.lead_id)
      .maybeSingle();
    if (fErr) throw new Error(fErr.message);
    if (!lead) throw new Error("Lead not found");
    if (lead.owner_id !== userId) throw new Error("You can only delete your own leads");
    const { error } = await supabase.from("leads").delete().eq("id", data.lead_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Admin endpoints ------------------------------------------------------
export const adminListActivityHeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rErr) throw new Error(rErr.message);

    const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
    const activityHeadIds = (roles ?? [])
      .filter((r) => r.role === "activity_head" && !adminIds.has(r.user_id))
      .map((r) => r.user_id);

    if (activityHeadIds.length === 0) return [];

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, created_at")
      .in("id", activityHeadIds);
    if (pErr) throw new Error(pErr.message);

    const { data: leads, error: lErr } = await supabaseAdmin
      .from("leads")
      .select("owner_id")
      .in("owner_id", activityHeadIds);
    if (lErr) throw new Error(lErr.message);

    const counts: Record<string, number> = {};
    for (const l of leads ?? []) counts[l.owner_id] = (counts[l.owner_id] ?? 0) + 1;

    return (profiles ?? [])
      .map((p) => ({ ...p, lead_count: counts[p.id] ?? 0 }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  });

export const adminListLeadsForUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: owner } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", data.user_id)
      .maybeSingle();
    const { data: leads, error } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("owner_id", data.user_id)
      .order("last_updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { owner, leads: leads ?? [] };
  });

export const adminGetLeadHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ lead_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: lead, error: lErr } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", data.lead_id)
      .maybeSingle();
    if (lErr) throw new Error(lErr.message);
    if (!lead) throw new Error("Lead not found");

    const { data: updates, error: uErr } = await supabaseAdmin
      .from("lead_updates")
      .select("id, description, created_by, created_at")
      .eq("lead_id", data.lead_id)
      .order("created_at", { ascending: true });
    if (uErr) throw new Error(uErr.message);

    const authorIds = Array.from(new Set([...(updates ?? []).map((u) => u.created_by), lead.owner_id]));
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", authorIds);
    const byId = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));

    return {
      lead: { ...lead, owner: byId[lead.owner_id] ?? null },
      updates: (updates ?? []).map((u) => ({ ...u, author: byId[u.created_by] ?? null })),
    };
  });

export const adminDeleteActivityHead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) throw new Error("You cannot delete your own admin account");

    // Make sure target is not an admin
    const { data: targetRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id);
    if ((targetRoles ?? []).some((r) => r.role === "admin")) {
      throw new Error("Cannot delete an admin account");
    }

    // Delete owned data first (CASCADE handles lead_updates)
    await supabaseAdmin.from("leads").delete().eq("owner_id", data.user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ lead_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("leads").delete().eq("id", data.lead_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Lead comments (admin -> activity head) -------------------------------
export const adminAddLeadComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      lead_id: z.string().uuid(),
      body: z.string().min(1).max(2000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("lead_comments").insert({
      lead_id: data.lead_id,
      author_id: context.userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listLeadComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ lead_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: comments, error } = await supabase
      .from("lead_comments")
      .select("id, body, created_at, read_at, author_id")
      .eq("lead_id", data.lead_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const authorIds = Array.from(new Set((comments ?? []).map((c) => c.author_id)));
    const { data: profs } = authorIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", authorIds)
      : { data: [] as { id: string; full_name: string; email: string }[] };
    const byId = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
    return (comments ?? []).map((c) => ({ ...c, author: byId[c.author_id] ?? null }));
  });

export const markLeadCommentsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ lead_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: lead } = await supabase
      .from("leads").select("id, owner_id").eq("id", data.lead_id).maybeSingle();
    if (!lead || lead.owner_id !== userId) return { ok: true };
    const { error } = await supabase
      .from("lead_comments")
      .update({ read_at: new Date().toISOString() })
      .eq("lead_id", data.lead_id)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyLeadCommentCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: leads } = await supabase.from("leads").select("id").eq("owner_id", userId);
    const ids = (leads ?? []).map((l) => l.id);
    if (!ids.length) return { unreadByLead: {} as Record<string, number>, totalUnread: 0, recent: [] as any[] };
    const { data: comments, error } = await supabase
      .from("lead_comments")
      .select("id, lead_id, body, created_at, read_at")
      .in("lead_id", ids)
      .is("read_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const unreadByLead: Record<string, number> = {};
    for (const c of comments ?? []) unreadByLead[c.lead_id] = (unreadByLead[c.lead_id] ?? 0) + 1;
    // Build recent list with lead names
    const leadIdsWithComments = Array.from(new Set((comments ?? []).map((c) => c.lead_id)));
    const { data: leadRows } = leadIdsWithComments.length
      ? await supabaseAdmin.from("leads").select("id, name, company_name").in("id", leadIdsWithComments)
      : { data: [] as { id: string; name: string; company_name: string | null }[] };
    const leadMap = Object.fromEntries((leadRows ?? []).map((l) => [l.id, l]));
    const recent = (comments ?? []).slice(0, 20).map((c) => ({
      id: c.id,
      lead_id: c.lead_id,
      body: c.body,
      created_at: c.created_at,
      lead: leadMap[c.lead_id] ?? null,
    }));
    return { unreadByLead, totalUnread: (comments ?? []).length, recent };
  });

// --- Shared company directory search (admin + activity heads) -------------
// Returns minimal info so activity heads can see if a company / POC is
// already being handled by someone else, without exposing private notes.
export const searchCompanyDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ q: z.string().trim().min(1).max(100) }).parse(input))
  .handler(async ({ data }) => {
    const term = data.q.replace(/[%_\\]/g, (m) => `\\${m}`);
    const pattern = `%${term}%`;
    const { data: leads, error } = await supabaseAdmin
      .from("leads")
      .select("id, company_name, name, poc_name, contact_number, status, owner_id, last_updated_at")
      .or(
        `company_name.ilike.${pattern},name.ilike.${pattern},poc_name.ilike.${pattern},contact_number.ilike.${pattern}`,
      )
      .order("last_updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const ownerIds = Array.from(new Set((leads ?? []).map((l) => l.owner_id)));
    const { data: owners } = ownerIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ownerIds)
      : { data: [] as { id: string; full_name: string; email: string }[] };
    const byId = Object.fromEntries((owners ?? []).map((p) => [p.id, p]));

    return (leads ?? []).map((l) => ({
      id: l.id,
      company_name: l.company_name,
      lead_name: l.name,
      poc_name: l.poc_name,
      contact_number: l.contact_number,
      status: l.status,
      last_updated_at: l.last_updated_at,
      owner: byId[l.owner_id] ?? null,
    }));
  });
