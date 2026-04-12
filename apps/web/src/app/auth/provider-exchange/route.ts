import { atlasLocalSessionCookieName } from "@atlas/auth";
import {
  createAtlasIdentityProviderSessionToken,
  verifyAtlasIdentityAssertionToken
} from "@atlas/auth/server";
import { appRuntime, authRuntime } from "@atlas/config";
import { exchangeIdentityAssertionForSession } from "@atlas/database";
import { NextResponse } from "next/server";

function resolveRedirectPath(value: unknown) {
  return typeof value === "string" && value.startsWith("/") ? value : "/";
}

async function readExchangePayload(request: Request) {
  if (request.headers.get("content-type")?.includes("application/json")) {
    return (await request.json()) as Record<string, unknown>;
  }

  const formData = await request.formData();
  return Object.fromEntries(formData.entries());
}

export async function POST(request: Request) {
  const payload = await readExchangePayload(request);
  const redirectTo = resolveRedirectPath(payload.redirectTo);
  const assertionToken = payload.assertionToken;
  const nextUrl = new URL(redirectTo, request.url);

  if (authRuntime.providerMode !== "identity-bridge") {
    return NextResponse.redirect(nextUrl);
  }

  if (typeof assertionToken !== "string" || assertionToken.trim().length === 0) {
    return new NextResponse("Missing identity assertion token.", {
      status: 400
    });
  }

  const verification = verifyAtlasIdentityAssertionToken(authRuntime.identityBridgeSecret, assertionToken);
  if (verification.status !== "ready") {
    return new NextResponse(verification.message, {
      status: 401
    });
  }

  const expiresAt = new Date(
    Math.min(
      new Date(verification.payload.expiresAt).getTime(),
      Date.now() + authRuntime.identitySessionTtlMinutes * 60 * 1000
    )
  ).toISOString();

  const session = await exchangeIdentityAssertionForSession({
    selection: verification.payload.selection,
    subject: verification.payload.subject,
    provider: verification.payload.provider,
    issuedAt: verification.payload.issuedAt,
    expiresAt,
    userName: verification.payload.userName
  });

  const response = NextResponse.redirect(nextUrl);
  response.cookies.set(
    atlasLocalSessionCookieName,
    createAtlasIdentityProviderSessionToken(authRuntime.sessionSigningSecret, verification.payload.selection, {
      sessionId: session.id,
      provider: session.provider,
      issuedAt: verification.payload.issuedAt,
      expiresAt: session.expiresAt
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: appRuntime.appEnv !== "local",
      maxAge: Math.max(1, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000)),
      path: "/"
    }
  );

  return response;
}
