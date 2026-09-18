/**
 * Desk settings: one record the administrator controls from the staff area.
 *
 * Everything that changes how the desk behaves in public — the officer's
 * telephone number for callers, whether the voice line, widget or public API
 * are open, how quickly a handover must be picked up — is read from here, so
 * behaviour can be changed without a code change.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export type DeskSettings = Database["public"]["Tables"]["desk_settings"]["Row"];

const FALLBACK: DeskSettings = {
  id: true,
  desk_name: "Naledi by AddressDox — Statistics South Africa information desk",
  support_email: null,
  officer_phone: null,
  officer_phone_label: "Stats SA communications desk",
  phone_handover_enabled: false,
  office_hours: "Monday to Friday, 08:00–16:30",
  time_zone: "Africa/Johannesburg",
  notify_email: null,
  handover_response_minutes: 5,
  visitor_retention_days: 365,
  voice_enabled: true,
  widget_enabled: true,
  public_api_enabled: true,
  crawler_enabled: true,
  media_auto_escalate: true,
  updated_by: null,
  updated_at: new Date(0).toISOString(),
};

/** Reads the desk settings, never throwing: the desk must keep working. */
export async function readDeskSettings(db: SupabaseClient<Database>): Promise<DeskSettings> {
  try {
    const { data } = await db.from("desk_settings").select("*").limit(1).maybeSingle();
    return data ?? FALLBACK;
  } catch {
    return FALLBACK;
  }
}

/** The telephone number a caller may be given, or null when it is not offered. */
export function callerPhoneOffer(settings: DeskSettings): { number: string; label: string } | null {
  if (!settings.phone_handover_enabled) return null;
  const number = (settings.officer_phone ?? "").trim();
  if (number.length < 6) return null;
  return { number, label: settings.officer_phone_label };
}

/** Reads a telephone number aloud digit by digit so a caller can write it down. */
export function speakableNumber(raw: string): string {
  return raw
    .replace(/[^\d+]/g, "")
    .split("")
    .join(" ");
}
