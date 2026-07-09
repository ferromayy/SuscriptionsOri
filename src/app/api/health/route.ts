import { NextResponse } from "next/server";

import { ensureSuperAdminExists } from "@/lib/auth/bootstrap";
import { hasDatabaseConfig } from "@/lib/env";
import { createDbClient } from "@/lib/db/client";

export async function GET() {
  if (!hasDatabaseConfig()) {
    return NextResponse.json(
      {
        status: "error",
        database: "not_configured",
        auth: "custom",
        message: "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY",
      },
      { status: 503 },
    );
  }

  try {
    await ensureSuperAdminExists();
    const db = createDbClient();
    const { count, error } = await db
      .from("tenants")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);

    if (error) {
      return NextResponse.json(
        {
          status: "error",
          database: "connection_failed",
          auth: "custom",
          message: error.message,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      status: "ok",
      database: "connected",
      auth: "custom",
      tenants: count ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        status: "error",
        database: "connection_failed",
        auth: "custom",
        message,
      },
      { status: 503 },
    );
  }
}
