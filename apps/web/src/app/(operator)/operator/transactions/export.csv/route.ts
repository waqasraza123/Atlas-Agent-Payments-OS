import { canAtlasActorExportData } from "@atlas/auth";
import { exportPlatformTransactionCsvForActor } from "@atlas/database";
import { NextResponse, type NextRequest } from "next/server";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";

export async function GET(request: NextRequest) {
  const resolution = await resolveWorkspaceActor("OPERATOR");

  if (resolution.status !== "ready") {
    return new NextResponse("Operator context could not be resolved.", {
      status: 403
    });
  }

  if (!canAtlasActorExportData(resolution.actor)) {
    return new NextResponse("Support sessions cannot export operator data.", {
      status: 403
    });
  }

  const csv = await exportPlatformTransactionCsvForActor(
    resolution.actor,
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="platform-transactions.csv"'
    }
  });
}
