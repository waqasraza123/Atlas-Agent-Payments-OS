import { atlasLocalSessionCookieName } from "@atlas/auth";
import {
  createAtlasIdentityProviderSessionToken,
  verifyAtlasExternalIdentityToken,
  verifyAtlasIdentityAssertionToken
} from "@atlas/auth/server";
import { appRuntime, authRuntime } from "@atlas/config";
import { exchangeExternalIdentityForSession, exchangeIdentityAssertionForSession } from "@atlas/database";
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

function parseExternalJwksJson() {
  try {
    const parsed = JSON.parse(authRuntime.externalOidcJwksJson) as { keys?: Array<Record<string, unknown>> };
    return Array.isArray(parsed.keys) ? parsed.keys : [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const payload = await readExchangePayload(request);
  const redirectTo = resolveRedirectPath(payload.redirectTo);
  const assertionToken = payload.assertionToken;
  const identityToken = payload.identityToken;
  const nextUrl = new URL(redirectTo, request.url);

  if (authRuntime.providerMode !== "identity-bridge" && authRuntime.providerMode !== "external-oidc") {
    return NextResponse.redirect(nextUrl);
  }

  const exchangeResult =
    authRuntime.providerMode === "identity-bridge"
      ? await (async () => {
          if (typeof assertionToken !== "string" || assertionToken.trim().length === 0) {
            return {
              status: 400,
              message: "Missing identity assertion token."
            } as const;
          }

          const verification = verifyAtlasIdentityAssertionToken(authRuntime.identityBridgeSecret, assertionToken);
          if (verification.status !== "ready") {
            return {
              status: 401,
              message: verification.message
            } as const;
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

          return {
            status: 200,
            selection: verification.payload.selection,
            provider: session.provider,
            issuedAt: verification.payload.issuedAt,
            expiresAt: session.expiresAt,
            sessionId: session.id
          } as const;
        })()
      : await (async () => {
          if (typeof identityToken !== "string" || identityToken.trim().length === 0) {
            return {
              status: 400,
              message: "Missing external identity token."
            } as const;
          }

          const verification = verifyAtlasExternalIdentityToken(
            {
              issuer: authRuntime.externalOidcIssuer,
              audience: authRuntime.externalOidcAudience,
              provider: authRuntime.externalOidcProvider,
              jwks: parseExternalJwksJson()
            },
            identityToken
          );

          if (verification.status !== "ready") {
            return {
              status: 401,
              message: verification.message
            } as const;
          }

          const expiresAt = new Date(
            Math.min(
              new Date(verification.payload.expiresAt).getTime(),
              Date.now() + authRuntime.identitySessionTtlMinutes * 60 * 1000
            )
          ).toISOString();

          const session = await exchangeExternalIdentityForSession({
            selection: verification.payload.selection,
            subject: verification.payload.subject,
            provider: verification.payload.provider,
            issuer: verification.payload.issuer,
            audience: verification.payload.audience,
            issuedAt: verification.payload.issuedAt,
            expiresAt,
            userName: verification.payload.userName
          });

          return {
            status: 200,
            selection: verification.payload.selection,
            provider: session.provider,
            issuedAt: verification.payload.issuedAt,
            expiresAt: session.expiresAt,
            sessionId: session.id
          } as const;
        })();

  if (exchangeResult.status !== 200) {
    return new NextResponse(exchangeResult.message, {
      status: exchangeResult.status
    });
  }

  const response = NextResponse.redirect(nextUrl);
  response.cookies.set(
    atlasLocalSessionCookieName,
    createAtlasIdentityProviderSessionToken(authRuntime.sessionSigningSecret, exchangeResult.selection, {
      sessionId: exchangeResult.sessionId,
      provider: exchangeResult.provider,
      issuedAt: exchangeResult.issuedAt,
      expiresAt: exchangeResult.expiresAt
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: appRuntime.appEnv !== "local",
      maxAge: Math.max(1, Math.floor((new Date(exchangeResult.expiresAt).getTime() - Date.now()) / 1000)),
      path: "/"
    }
  );

  return response;
}
