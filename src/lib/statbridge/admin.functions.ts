/**
 * Administration of the desk itself: settings, staff accounts and roles.
 *
 * Reading is open to any signed-in staff member; every change is limited to an
 * administrator and is checked on the server, never in the browser.
 */
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { DeskSettings } from "./settings.server";

type Ctx = {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
  userId: string;
};

async function staffOnly(context: Ctx) {
  const { data } = await context.supabase.rpc("is_staff", { _uid: context.userId });
  if (data !== true) throw new Error("This area is for Stats SA communications staff.");
  return context.userId;
}

async function administratorOnly(context: Ctx) {
  const { data } = await context.supabase.rpc("has_staff_role", {
    _uid: context.userId,
    _role: "administrator",
  });
  if (data !== true) throw new Error("Only an administrator can change this.");
  return context.userId;
}

export const getDeskSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DeskSettings> => {
    await staffOnly(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readDeskSettings } = await import("./settings.server");
    return readDeskSettings(supabaseAdmin);
  });

const settingsPatchSchema = z.object({
  desk_name: z.string().trim().min(3).max(160).optional(),
  support_email: z.string().trim().email().or(z.literal("")).optional(),
  officer_phone: z.string().trim().max(40).optional(),
  officer_phone_label: z.string().trim().min(2).max(80).optional(),
  phone_handover_enabled: z.boolean().optional(),
  office_hours: z.string().trim().min(3).max(120).optional(),
  time_zone: z.string().trim().min(3).max(60).optional(),
  notify_email: z.string().trim().email().or(z.literal("")).optional(),
  handover_response_minutes: z.number().int().min(1).max(240).optional(),
  visitor_retention_days: z.number().int().min(30).max(3650).optional(),
  voice_enabled: z.boolean().optional(),
  widget_enabled: z.boolean().optional(),
  public_api_enabled: z.boolean().optional(),
  crawler_enabled: z.boolean().optional(),
  media_auto_escalate: z.boolean().optional(),
});
export type DeskSettingsPatch = z.infer<typeof settingsPatchSchema>;

export const saveDeskSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settingsPatchSchema.parse(input))
  .handler(async ({ context, data }): Promise<DeskSettings> => {
    await administratorOnly(context as never);
    const typed = context as unknown as Ctx;
    const { data: saved, error } = await typed.supabase.rpc("save_desk_settings", { _patch: data });
    if (error) throw new Error("The settings could not be saved.");
    return saved as DeskSettings;
  });

export type StaffMember = {
  id: string;
  fullName: string;
  role: "official" | "administrator" | "manager";
  isActive: boolean;
  isDemo: boolean;
  email: string | null;
  lastSignInAt: string | null;
  createdAt: string;
};

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffMember[]> => {
    await staffOnly(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, role, is_active, is_demo, created_at")
      .order("created_at", { ascending: true })
      .limit(500);

    const { data: accounts } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 });
    const byId = new Map(
      (accounts?.users ?? []).map((user) => [user.id, { email: user.email ?? null, at: user.last_sign_in_at ?? null }]),
    );

    return (profiles ?? []).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active,
      isDemo: row.is_demo,
      email: byId.get(row.id)?.email ?? null,
      lastSignInAt: byId.get(row.id)?.at ?? null,
      createdAt: row.created_at,
    }));
  });

const roleSchema = z.enum(["official", "administrator", "manager"]);

export const changeStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ staffId: z.string().uuid(), role: roleSchema }).parse(input))
  .handler(async ({ context, data }) => {
    const actor = await administratorOnly(context as never);
    if (actor === data.staffId) throw new Error("You cannot change your own role.");
    const typed = context as unknown as Ctx;
    const { error } = await typed.supabase.rpc("set_role", { _target: data.staffId, _role: data.role });
    if (error) throw new Error("The role could not be changed.");
    return { ok: true };
  });

export const setStaffActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ staffId: z.string().uuid(), isActive: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    const actor = await administratorOnly(context as never);
    if (actor === data.staffId) throw new Error("You cannot switch off your own account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: data.isActive })
      .eq("id", data.staffId);
    if (error) throw new Error("The account could not be changed.");
    await supabaseAdmin.rpc("write_audit", {
      _actor: actor,
      _action: data.isActive ? "staff_reactivated" : "staff_suspended",
      _entity_kind: "profile",
      _entity_id: data.staffId,
      _case_id: null as unknown as string,
      _from: "",
      _to: "",
      _detail: {},
      _origin: "screen",
    });
    return { ok: true };
  });

export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email(),
        fullName: z.string().trim().min(2).max(120),
        role: roleSchema,
        password: z.string().min(10).max(72),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const actor = await administratorOnly(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) {
      throw new Error(error?.message ?? "That account could not be created.");
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: created.user.id,
      full_name: data.fullName,
      role: data.role,
      is_active: true,
      created_by: actor,
    });
    if (profileError) throw new Error("The account was created but the staff record could not be saved.");

    await supabaseAdmin.from("staff_invitations").upsert(
      {
        email: data.email,
        full_name: data.fullName,
        role: data.role,
        invited_by: actor,
        accepted_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );

    await supabaseAdmin.rpc("write_audit", {
      _actor: actor,
      _action: "staff_account_created",
      _entity_kind: "profile",
      _entity_id: created.user.id,
      _case_id: null as unknown as string,
      _from: "",
      _to: data.role,
      _detail: {},
      _origin: "screen",
    });

    return { ok: true, staffId: created.user.id };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ fullName: z.string().trim().min(2).max(120) }).parse(input))
  .handler(async ({ context, data }) => {
    const me = await staffOnly(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ full_name: data.fullName }).eq("id", me);
    if (error) throw new Error("Your name could not be saved.");
    return { ok: true };
  });
