import {
  atlasLocalSessionCookieName,
  createAtlasLocalSessionSelection,
  isAtlasLocalSessionProfileKey,
  type AtlasLocalSessionSelection
} from "@atlas/auth";
import { createAtlasLocalSessionToken } from "@atlas/auth/server";
import { appRuntime, authRuntime } from "@atlas/config";
import { NextResponse } from "next/server";

function resolveRedirectPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "/";
  }

  return value.startsWith("/") ? value : "/";
}

function createSessionCookieValue(selection: AtlasLocalSessionSelection) {
  return createAtlasLocalSessionToken(authRuntime.sessionSigningSecret, selection, {
    expiresAt: new Date(Date.now() + authRuntime.localSessionTtlMinutes * 60 * 1000).toISOString()
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"));
  const profileKey = formData.get("profileKey");
  const nextUrl = new URL(redirectTo, request.url);

  if (appRuntime.appEnv !== "local" && appRuntime.appEnv !== "development") {
    return NextResponse.redirect(nextUrl);
  }

  if (typeof profileKey !== "string" || !isAtlasLocalSessionProfileKey(profileKey)) {
    return NextResponse.redirect(nextUrl);
  }

  const response = NextResponse.redirect(nextUrl);
  response.cookies.set(atlasLocalSessionCookieName, createSessionCookieValue(createAtlasLocalSessionSelection(profileKey)), {
    httpOnly: true,
    sameSite: "lax",
    secure: appRuntime.appEnv !== "local",
    maxAge: authRuntime.localSessionTtlMinutes * 60,
    path: "/"
  });

  return response;
}

export async function DELETE(request: Request) {
  const redirectTo = new URL(resolveRedirectPath(new URL(request.url).searchParams.get("redirectTo")), request.url);
  const response = NextResponse.redirect(redirectTo);
  response.cookies.delete(atlasLocalSessionCookieName);
  return response;
}
