import { NextResponse } from "next/server";

import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      {
        status: "error",
        database: "not_configured",
        message: "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
      },
      { status: 503 },
    );
  }

  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("tenants")
      .select("*", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        {
          status: "error",
          database: "connection_failed",
          message: error.message,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      status: "ok",
      database: "connected",
      tenants: count ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        status: "error",
        database: "connection_failed",
        message,
      },
      { status: 503 },
    );
  }
}
