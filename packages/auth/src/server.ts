import { createHmac, timingSafeEqual } from "node:crypto";
import {
  createAtlasIdentityAssertionPayload,
  atlasSignedSessionVersion,
  createAtlasSignedSessionPayload,
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

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
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
