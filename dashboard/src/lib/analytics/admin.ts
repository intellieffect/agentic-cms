import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

export type AnalyticsAdminAuthResult =
  | { ok: false; response: NextResponse }
  | { ok: true; sbAdmin: SupabaseClient };

export async function requireAnalyticsAdmin(): Promise<AnalyticsAdminAuthResult> {
  try {
    const sbAdmin = getSupabase();
    return { ok: true, sbAdmin };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Failed to initialize Supabase client" },
        { status: 500 },
      ),
    };
  }
}
