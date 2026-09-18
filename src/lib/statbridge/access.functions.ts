import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";

export type StaffAccess = {
  permissions: string[];
  roles: Array<{ id: string; key: string; name: string }>;
};

export const getMyStaffAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffAccess> => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await db.from("profiles").select("is_active").eq("id", context.userId).maybeSingle();
    if (!profile?.is_active) return { permissions: [], roles: [] };

    const { data } = await db
      .from("user_roles")
      .select("roles!inner(id,key,name,is_active,role_permissions(permission_key))")
      .eq("user_id", context.userId);
    const roles: StaffAccess["roles"] = [];
    const permissions = new Set<string>();
    for (const row of data ?? []) {
      const role = row.roles as unknown as {
        id: string;
        key: string;
        name: string;
        is_active: boolean;
        role_permissions: Array<{ permission_key: string }>;
      };
      if (!role?.is_active) continue;
      roles.push({ id: role.id, key: role.key, name: role.name });
      for (const permission of role.role_permissions ?? []) permissions.add(permission.permission_key);
    }
    return { roles, permissions: [...permissions].sort() };
  });