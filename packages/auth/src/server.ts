import {
  createHmac,
  createPrivateKey,
  createPublicKey,
  createSign,
  timingSafeEqual,
  verify,
  type JsonWebKey as CryptoJsonWebKey
} from "node:crypto";
import {
  createAtlasIdentityAssertionPayload,
  atlasSignedSessionVersion,
  createAtlasSignedSessionPayload,
  type AtlasExternalIdentityPayload,
  type AtlasIdentityAssertionPayload,
  isAtlasSupportAccessRecord,
  parseAtlasLocalSessionSelection,
  type AtlasLocalSessionSelection,
  type AtlasSignedSessionPayload,
  type AtlasSupportAccessRecord
} from "./index";

export type AtlasSignedSessionVerificationResult =
  | {
      status: "ready";
      payload: AtlasSignedSessionPayload;
    }
  | {
      status: "invalid" | "expired";
      message: string;
    };

export type AtlasIdentityAssertionVerificationResult =
  | {
      status: "ready";
      payload: AtlasIdentityAssertionPayload;
    }
  | {
      status: "invalid" | "expired";
      message: string;
    };

export type AtlasExternalIdentityVerificationResult =
  | {
      status: "ready";
      payload: AtlasExternalIdentityPayload;
    }
  | {
      status: "invalid" | "expired";
      message: string;
    };

type AtlasExternalIdentityVerificationInput = {
  issuer: string;
  audience: string;
  provider: string;
  jwks: Array<Record<string, unknown>>;
};

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function decodeBase64UrlJson(value: string) {
  return JSON.parse(decodeBase64Url(value)) as Record<string, unknown>;
}

function createAtlasSessionSignature(secret: string, payloadSegment: string) {
  return createHmac("sha256", secret).update(payloadSegment).digest("base64url");
}

function hasMatchingSignature(expected: string, actual: string) {
  try {
    return timingSafeEqual(Buffer.from(expected, "base64url"), Buffer.from(actual, "base64url"));
  } catch {
    return false;
  }
}

function parseAtlasIsoTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function encodeBase64UrlBytes(value: Buffer) {
  return value.toString("base64url");
}

function parseJwtSegments(token: string) {
  const segments = token.split(".");

  if (segments.length !== 3 || segments.some((segment) => segment.trim().length === 0)) {
    return null;
  }

  return {
    headerSegment: segments[0],
    payloadSegment: segments[1],
    signatureSegment: segments[2]
  };
}

function readNumericTimestamp(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.floor(value * 1000);
}

function selectAtlasJwk(jwks: Array<Record<string, unknown>>, kid: unknown) {
  if (typeof kid !== "string" || kid.trim().length === 0) {
    return null;
  }

  return (
    jwks.find((candidate) => typeof candidate.kid === "string" && candidate.kid === kid && candidate.kty === "RSA") ?? null
  );
}

function verifyJwtSignature(
  segments: { headerSegment: string; payloadSegment: string; signatureSegment: string },
  jwk: Record<string, unknown>
) {
  try {
    const publicKey = createPublicKey({
      key: jwk as CryptoJsonWebKey,
      format: "jwk"
    });

    return verify(
      "RSA-SHA256",
      Buffer.from(`${segments.headerSegment}.${segments.payloadSegment}`, "utf8"),
      publicKey,
      Buffer.from(segments.signatureSegment, "base64url")
    );
  } catch {
    return false;
  }
}

export function createAtlasSignedSessionToken(secret: string, payload: AtlasSignedSessionPayload) {
  const payloadSegment = encodeBase64Url(JSON.stringify(payload));
  const signatureSegment = createAtlasSessionSignature(secret, payloadSegment);
  return `${payloadSegment}.${signatureSegment}`;
}

export function createAtlasIdentityAssertionToken(secret: string, payload: AtlasIdentityAssertionPayload) {
  const payloadSegment = encodeBase64Url(JSON.stringify(payload));
  const signatureSegment = createAtlasSessionSignature(secret, payloadSegment);
  return `${payloadSegment}.${signatureSegment}`;
}

export function verifyAtlasSignedSessionToken(
  secret: string,
  token: string | null | undefined,
  now: Date = new Date()
): AtlasSignedSessionVerificationResult {
  if (!token || token.trim().length === 0) {
    return {
      status: "invalid",
      message: "Missing signed actor session token"
    };
  }

  const [payloadSegment, signatureSegment] = token.split(".");
  if (!payloadSegment || !signatureSegment) {
    return {
      status: "invalid",
      message: "Signed actor session token is malformed"
    };
  }

  const expectedSignature = createAtlasSessionSignature(secret, payloadSegment);
  if (!hasMatchingSignature(expectedSignature, signatureSegment)) {
    return {
      status: "invalid",
      message: "Signed actor session token could not be verified"
    };
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payloadSegment)) as Partial<AtlasSignedSessionPayload>;
    const issuedAt = typeof parsed.issuedAt === "string" ? parseAtlasIsoTimestamp(parsed.issuedAt) : null;
    const expiresAt = typeof parsed.expiresAt === "string" ? parseAtlasIsoTimestamp(parsed.expiresAt) : null;
    const selection =
      parsed.selection && typeof parsed.selection === "object"
        ? parseAtlasLocalSessionSelection(encodeURIComponent(JSON.stringify(parsed.selection)))
        : null;

    if (
      parsed.version !== atlasSignedSessionVersion ||
      (parsed.source !== "local-development" &&
        parsed.source !== "internal-support" &&
        parsed.source !== "identity-provider") ||
      !selection ||
      issuedAt === null ||
      expiresAt === null ||
      expiresAt <= issuedAt
    ) {
      return {
        status: "invalid",
        message: "Signed actor session token contains invalid session fields"
      };
    }

    if (parsed.source === "internal-support") {
      if (!isAtlasSupportAccessRecord(parsed.supportAccess)) {
        return {
          status: "invalid",
          message: "Signed actor session token contains invalid support-access scope"
        };
      }

      if (selection.workspace !== "OPERATOR") {
        return {
          status: "invalid",
          message: "Support-access sessions must originate from the operator workspace"
        };
      }
    }

    if (parsed.source === "identity-provider") {
      if (typeof parsed.sessionId !== "string" || parsed.sessionId.trim().length === 0) {
        return {
          status: "invalid",
          message: "Identity-provider session token is missing its persisted session reference"
        };
      }

      if (typeof parsed.provider !== "string" || parsed.provider.trim().length === 0) {
        return {
          status: "invalid",
          message: "Identity-provider session token is missing its provider label"
        };
      }

      if (parsed.supportAccess !== null && parsed.supportAccess !== undefined) {
        return {
          status: "invalid",
          message: "Identity-provider sessions cannot carry support-access scope"
        };
      }
    }

    if (parsed.source === "local-development" && parsed.supportAccess !== null && parsed.supportAccess !== undefined) {
      return {
        status: "invalid",
        message: "Local-development sessions cannot carry support-access scope"
      };
    }

    if (expiresAt <= now.getTime()) {
      return {
        status: "expired",
        message: "Signed actor session token has expired"
      };
    }

    return {
      status: "ready",
      payload: {
        version: atlasSignedSessionVersion,
        source: parsed.source,
        issuedAt: new Date(issuedAt).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
        selection,
        sessionId: parsed.source === "identity-provider" && typeof parsed.sessionId === "string" ? parsed.sessionId.trim() : null,
        provider: parsed.source === "identity-provider" && typeof parsed.provider === "string" ? parsed.provider.trim() : null,
        supportAccess: parsed.source === "internal-support" ? parsed.supportAccess ?? null : null
      }
    };
  } catch {
    return {
      status: "invalid",
      message: "Signed actor session token could not be decoded"
    };
  }
}

export function verifyAtlasIdentityAssertionToken(
  secret: string,
  token: string | null | undefined,
  now: Date = new Date()
): AtlasIdentityAssertionVerificationResult {
  if (!token || token.trim().length === 0) {
    return {
      status: "invalid",
      message: "Missing identity assertion token"
    };
  }

  const [payloadSegment, signatureSegment] = token.split(".");
  if (!payloadSegment || !signatureSegment) {
    return {
      status: "invalid",
      message: "Identity assertion token is malformed"
    };
  }

  const expectedSignature = createAtlasSessionSignature(secret, payloadSegment);
  if (!hasMatchingSignature(expectedSignature, signatureSegment)) {
    return {
      status: "invalid",
      message: "Identity assertion token could not be verified"
    };
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payloadSegment)) as Partial<AtlasIdentityAssertionPayload>;
    const issuedAt = typeof parsed.issuedAt === "string" ? parseAtlasIsoTimestamp(parsed.issuedAt) : null;
    const expiresAt = typeof parsed.expiresAt === "string" ? parseAtlasIsoTimestamp(parsed.expiresAt) : null;
    const selection =
      parsed.selection && typeof parsed.selection === "object"
        ? parseAtlasLocalSessionSelection(encodeURIComponent(JSON.stringify(parsed.selection)))
        : null;

    if (
      parsed.version !== atlasSignedSessionVersion ||
      parsed.source !== "identity-bridge" ||
      !selection ||
      typeof parsed.subject !== "string" ||
      parsed.subject.trim().length === 0 ||
      typeof parsed.provider !== "string" ||
      parsed.provider.trim().length === 0 ||
      issuedAt === null ||
      expiresAt === null ||
      expiresAt <= issuedAt
    ) {
      return {
        status: "invalid",
        message: "Identity assertion token contains invalid session fields"
      };
    }

    if (expiresAt <= now.getTime()) {
      return {
        status: "expired",
        message: "Identity assertion token has expired"
      };
    }

    return {
      status: "ready",
      payload: {
        version: atlasSignedSessionVersion,
        source: "identity-bridge",
        issuedAt: new Date(issuedAt).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
        selection,
        subject: parsed.subject.trim(),
        provider: parsed.provider.trim(),
        userName: typeof parsed.userName === "string" && parsed.userName.trim().length > 0 ? parsed.userName.trim() : null
      }
    };
  } catch {
    return {
      status: "invalid",
      message: "Identity assertion token could not be decoded"
    };
  }
}

export function verifyAtlasExternalIdentityToken(
  input: AtlasExternalIdentityVerificationInput,
  token: string | null | undefined,
  now: Date = new Date()
): AtlasExternalIdentityVerificationResult {
  if (!token || token.trim().length === 0) {
    return {
      status: "invalid",
      message: "Missing external identity token"
    };
  }

  const segments = parseJwtSegments(token);
  if (!segments) {
    return {
      status: "invalid",
      message: "External identity token is malformed"
    };
  }

  try {
    const header = decodeBase64UrlJson(segments.headerSegment);
    const payload = decodeBase64UrlJson(segments.payloadSegment);

    if (header.alg !== "RS256") {
      return {
        status: "invalid",
        message: "External identity token must use RS256"
      };
    }

    const jwk = selectAtlasJwk(input.jwks, header.kid);
    if (!jwk || !verifyJwtSignature(segments, jwk)) {
      return {
        status: "invalid",
        message: "External identity token signature could not be verified"
      };
    }

    const issuer = typeof payload.iss === "string" ? payload.iss.trim() : "";
    const subject = typeof payload.sub === "string" ? payload.sub.trim() : "";
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const userName = typeof payload.name === "string" && payload.name.trim().length > 0 ? payload.name.trim() : null;
    const audienceValue = payload.aud;
    const audiences =
      typeof audienceValue === "string"
        ? [audienceValue]
        : Array.isArray(audienceValue)
          ? audienceValue.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          : [];
    const issuedAt = readNumericTimestamp(payload.iat);
    const expiresAt = readNumericTimestamp(payload.exp);
    const organizationSlug =
      typeof payload.atlas_org_slug === "string" && payload.atlas_org_slug.trim().length > 0
        ? payload.atlas_org_slug.trim()
        : "";
    const workspace =
      typeof payload.atlas_workspace === "string"
        ? parseAtlasLocalSessionSelection(
            encodeURIComponent(
              JSON.stringify({
                profileKey: null,
                workspace: payload.atlas_workspace,
                userEmail: email,
                organizationSlug,
                role: payload.atlas_role,
                agentId: payload.atlas_agent_id
              })
            )
          )?.workspace ?? null
        : null;
    const selection =
      workspace !== null
        ? parseAtlasLocalSessionSelection(
            encodeURIComponent(
              JSON.stringify({
                profileKey: null,
                workspace,
                userEmail: email,
                organizationSlug,
                role: payload.atlas_role,
                agentId: typeof payload.atlas_agent_id === "string" ? payload.atlas_agent_id : null
              })
            )
          )
        : null;

    if (
      issuer !== input.issuer ||
      subject.length === 0 ||
      email.length === 0 ||
      selection === null ||
      issuedAt === null ||
      expiresAt === null ||
      expiresAt <= issuedAt ||
      !audiences.includes(input.audience)
    ) {
      return {
        status: "invalid",
        message: "External identity token contains invalid Atlas session claims"
      };
    }

    if (expiresAt <= now.getTime()) {
      return {
        status: "expired",
        message: "External identity token has expired"
      };
    }

    return {
      status: "ready",
      payload: {
        issuer,
        audience: input.audience,
        provider: input.provider,
        subject,
        selection,
        email,
        userName,
        issuedAt: new Date(issuedAt).toISOString(),
        expiresAt: new Date(expiresAt).toISOString()
      }
    };
  } catch {
    return {
      status: "invalid",
      message: "External identity token could not be decoded"
    };
  }
}

export function createAtlasLocalSessionToken(
  secret: string,
  selection: AtlasLocalSessionSelection,
  options?: {
    issuedAt?: string;
    expiresAt?: string;
  }
) {
  return createAtlasSignedSessionToken(
    secret,
    createAtlasSignedSessionPayload(selection, {
      source: "local-development",
      issuedAt: options?.issuedAt,
      expiresAt: options?.expiresAt,
      sessionId: null,
      provider: null,
      supportAccess: null
    })
  );
}

export function createAtlasIdentityProviderSessionToken(
  secret: string,
  selection: AtlasLocalSessionSelection,
  input: {
    sessionId: string;
    provider: string;
    issuedAt?: string;
    expiresAt?: string;
  }
) {
  return createAtlasSignedSessionToken(
    secret,
    createAtlasSignedSessionPayload(selection, {
      source: "identity-provider",
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
      sessionId: input.sessionId,
      provider: input.provider,
      supportAccess: null
    })
  );
}

export function createAtlasSupportSessionToken(
  secret: string,
  principalSelection: AtlasLocalSessionSelection,
  supportAccess: AtlasSupportAccessRecord,
  options?: {
    issuedAt?: string;
    expiresAt?: string;
  }
) {
  return createAtlasSignedSessionToken(
    secret,
    createAtlasSignedSessionPayload(principalSelection, {
      source: "internal-support",
      issuedAt: options?.issuedAt,
      expiresAt: options?.expiresAt,
      sessionId: null,
      provider: null,
      supportAccess
    })
  );
}

export function createAtlasIdentityAssertionTokenForSelection(
  secret: string,
  selection: AtlasLocalSessionSelection,
  input: {
    subject: string;
    provider: string;
    userName?: string | null;
    issuedAt?: string;
    expiresAt?: string;
  }
) {
  return createAtlasIdentityAssertionToken(secret, createAtlasIdentityAssertionPayload(selection, input));
}

export function createAtlasExternalIdentityTokenForSelection(
  privateKey:
    | string
    | {
        key: string;
        passphrase?: string;
      },
  selection: AtlasLocalSessionSelection,
  input: {
    issuer: string;
    audience: string;
    provider: string;
    subject: string;
    userName?: string | null;
    issuedAt?: string;
    expiresAt?: string;
    keyId?: string;
  }
) {
  const issuedAt = input.issuedAt ?? new Date().toISOString();
  const expiresAt = input.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const headerSegment = encodeBase64Url(
    JSON.stringify({
      alg: "RS256",
      typ: "JWT",
      kid: input.keyId ?? "atlas-test-key"
    })
  );
  const payloadSegment = encodeBase64Url(
    JSON.stringify({
      iss: input.issuer,
      aud: input.audience,
      sub: input.subject,
      email: selection.userEmail.toLowerCase(),
      name: input.userName?.trim() ?? null,
      iat: Math.floor(Date.parse(issuedAt) / 1000),
      exp: Math.floor(Date.parse(expiresAt) / 1000),
      atlas_org_slug: selection.organizationSlug,
      atlas_workspace: selection.workspace,
      atlas_role: selection.role,
      atlas_agent_id: selection.agentId,
      atlas_provider: input.provider
    })
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${headerSegment}.${payloadSegment}`);
  signer.end();
  const privateKeyObject =
    typeof privateKey === "string"
      ? createPrivateKey(privateKey)
      : createPrivateKey({
          key: privateKey.key,
          format: "pem",
          passphrase: privateKey.passphrase
        });
  const signatureSegment = encodeBase64UrlBytes(signer.sign(privateKeyObject));

  return `${headerSegment}.${payloadSegment}.${signatureSegment}`;
}
