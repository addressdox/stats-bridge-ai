import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { randomBytes } from "crypto";
import { z } from "zod";

type Ctx = {
  userId: string;
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
};

async function permission(context: Ctx, key: string) {
  const result = await context.supabase.rpc("has_permission", { _uid: context.userId, _permission: key });
  if (result.error || result.data !== true) throw new Error(`Your account does not have ${key} access.`);
  return context.userId;
}

export type WidgetSite = {
  id: string;
  siteKey: string;
  name: string;
  allowedOrigins: string[];
  accentColour: string | null;
  position: string | null;
  defaultLanguage: string | null;
  openingText: string | null;
  isActive: boolean;
  createdAt: string;
};

export const listWidgetSites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WidgetSite[]> => {
    await permission(context as never, "widgets.manage");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data, error } = await db.from("widget_sites").select("*").order("created_at", { ascending: false });
    if (error) throw new Error("The website list could not be loaded.");
    return (data ?? []).map((row) => ({
      id: row.id,
      siteKey: row.site_key,
      name: row.name,
      allowedOrigins: row.allowed_origins ?? [],
      accentColour: row.accent_colour,
      position: row.position,
      defaultLanguage: row.default_language,
      openingText: row.opening_text,
      isActive: row.is_active,
      createdAt: row.created_at,
    }));
  });

const originList = z
  .string()
  .trim()
  .min(1)
  .transform((value) =>
    value
      .split(/[\s,]+/)
      .map((item) => item.trim().replace(/\/$/, ""))
      .filter(Boolean),
  )
  .refine((list) => list.length > 0 && list.every((item) => /^https?:\/\/[^/]+$/.test(item)), {
    message: "Each website address must look like https://www.example.co.za, with no path.",
  });

const siteSchema = z.object({
  id: z.string().uuid().nullable().default(null),
  name: z.string().trim().min(2).max(120),
  origins: originList,
  accentColour: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #0f766e.")
    .nullable()
    .default(null),
  position: z.enum(["bottom-right", "bottom-left"]).default("bottom-right"),
  defaultLanguage: z.string().trim().min(2).max(12).default("en"),
  openingText: z.string().trim().max(240).nullable().default(null),
  isActive: z.boolean().default(true),
});

export const saveWidgetSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => siteSchema.parse(input))
  .handler(async ({ context, data }): Promise<{ id: string; siteKey: string }> => {
    const actor = await permission(context as never, "widgets.manage");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    const values = {
      name: data.name,
      allowed_origins: data.origins,
      accent_colour: data.accentColour,
      position: data.position,
      default_language: data.defaultLanguage,
      opening_text: data.openingText,
      is_active: data.isActive,
    };

    if (data.id) {
      const { data: row, error } = await db
        .from("widget_sites")
        .update(values)
        .eq("id", data.id)
        .select("id, site_key")
        .single();
      if (error || !row) throw new Error("The website could not be saved.");
      await db.rpc("write_audit", {
        _actor: actor,
        _action: "widget_site_saved",
        _entity_kind: "widget_site",
        _entity_id: row.id,
        _detail: { name: data.name, origins: data.origins },
        _origin: "screen",
      } as never);
      return { id: row.id, siteKey: row.site_key };
    }

    const siteKey = `sb_${randomBytes(9).toString("base64url")}`;
    const { data: row, error } = await db
      .from("widget_sites")
      .insert({ ...values, site_key: siteKey })
      .select("id, site_key")
      .single();
    if (error || !row) throw new Error("The website could not be registered.");
    await db.rpc("write_audit", {
      _actor: actor,
      _action: "widget_site_registered",
      _entity_kind: "widget_site",
      _entity_id: row.id,
      _detail: { name: data.name, origins: data.origins },
      _origin: "screen",
    } as never);
    return { id: row.id, siteKey: row.site_key };
  });
