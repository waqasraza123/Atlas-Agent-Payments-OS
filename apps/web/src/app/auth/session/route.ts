import {
  atlasLocalSessionCookieName,
  createAtlasLocalSessionSelection,
  isAtlasLocalSessionProfileKey,
  serializeAtlasLocalSessionSelection
} from "@atlas/auth";
import { NextResponse } from "next/server";

function resolveRedirectPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "/";
  }

  return value.startsWith("/") ? value : "/";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"));
  const profileKey = formData.get("profileKey");
  const nextUrl = new URL(redirectTo, request.url);

  if (typeof profileKey !== "string" || !isAtlasLocalSessionProfileKey(profileKey)) {
    return NextResponse.redirect(nextUrl);
  }

  const response = NextResponse.redirect(nextUrl);
  response.cookies.set(atlasLocalSessionCookieName, serializeAtlasLocalSessionSelection(createAtlasLocalSessionSelection(profileKey)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });

  return response;
}
