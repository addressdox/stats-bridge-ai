import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useServerFn } from "@tanstack/react-start";
import { getMyStaffAccess } from "@/lib/statbridge/access.functions";

export type StaffRole = Database["public"]["Enums"]["staff_role"];

export type StaffProfile = {
  id: string;
  full_name: string;
  role: StaffRole;
  is_active: boolean;
  is_demo: boolean;
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  official: "Communications official",
  administrator: "Knowledge administrator",
  manager: "Communications manager",
};

/**
 * The signed-in staff member and the role recorded on the server.
 * The role is never taken from anything the browser can set.
 */
export function useStaff() {
  const queryClient = useQueryClient();
  const fetchAccess = useServerFn(getMyStaffAccess);

  const query = useQuery({
    queryKey: ["staff-profile"],
    retry: false,
    staleTime: 30_000,
    queryFn: async (): Promise<StaffProfile | null> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role, is_active, is_demo")
        .eq("id", auth.user.id)
        .maybeSingle();
      return data ?? null;
    },
  });

  const access = useQuery({
    queryKey: ["staff-access", query.data?.id],
    queryFn: () => fetchAccess(),
    enabled: Boolean(query.data?.id && query.data?.is_active),
    staleTime: 30_000,
    retry: false,
  });
  const permissions = new Set(access.data?.permissions ?? []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      queryClient.invalidateQueries({ queryKey: ["staff-profile"] });
      if (event === "SIGNED_OUT") queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return {
    profile: query.data ?? null,
    isLoading: query.isPending || (Boolean(query.data?.id) && access.isPending),
    role: query.data?.role ?? null,
    roles: access.data?.roles ?? [],
    permissions: access.data?.permissions ?? [],
    hasPermission: (permission: string) => permissions.has(permission),
    can: {
      review: permissions.has("cases.review"),
      release: permissions.has("cases.release"),
      knowledge: permissions.has("sources.approve"),
    },
  };
}
