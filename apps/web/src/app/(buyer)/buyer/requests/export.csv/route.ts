import { canAtlasActorExportData } from "@atlas/auth";
import { exportBuyerRequestCsvForActor } from "@atlas/database";
import { NextResponse, type NextRequest } from "next/server";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";

export async function GET(request: NextRequest) {
  const resolution = await resolveWorkspaceActor("BUYER");

  if (resolution.status !== "ready") {
    return new NextResponse("Buyer context could not be resolved.", {
      status: 403
    });
  }

  if (!canAtlasActorExportData(resolution.actor)) {
    return new NextResponse("Support sessions cannot export buyer data.", {
      status: 403
    });
  }

  const csv = await exportBuyerRequestCsvForActor(resolution.actor, Object.fromEntries(request.nextUrl.searchParams.entries()));

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="buyer-requests.csv"'
    }
  });
}
