import { exportSellerRequestCsv } from "@atlas/database";
import { NextResponse, type NextRequest } from "next/server";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";

export async function GET(request: NextRequest) {
  const resolution = await resolveWorkspaceActor("SELLER");

  if (resolution.status !== "ready") {
    return new NextResponse("Seller context could not be resolved.", {
      status: 403
    });
  }

  const csv = await exportSellerRequestCsv(
    resolution.actor.organization.id,
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="seller-requests.csv"'
    }
  });
}

