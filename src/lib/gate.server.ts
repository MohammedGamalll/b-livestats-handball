import { clearSession, getRequestUrl, useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

let sessionIdCounter = 0;

function makeSessionId(): string {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `gate-${Date.now()}-${sessionIdCounter++}`;
}

function getSessionConfig() {
  const requestUrl = getRequestUrl();
  const isSecureRequest = requestUrl.protocol === "https:";

  return {
    password: process.env.SESSION_SECRET || "dev-only-fallback-do-not-use-in-production-please-set-secret",
    name: "bls-gate-v2",
    maxAge: 60 * 60 * 24 * 30,
    generateId: makeSessionId,
    cookie: {
      httpOnly: true,
      secure: isSecureRequest,
      // SameSite=None is required so the cookie is sent inside cross-site iframes
      // (e.g. the Lovable preview embedded in the chat). It requires Secure, so
      // we only use it on HTTPS; fall back to Lax on plain HTTP (local dev).
      sameSite: (isSecureRequest ? "none" : "lax") as "none" | "lax",
      path: "/",
    },
  };
}

export type GateSession = { unlocked?: boolean };

export function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input.trim(), "utf8").digest();
  const b = createHash("sha256").update(expected.trim(), "utf8").digest();
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function readGateSession() {
  const config = getSessionConfig();
  try {
    return await useSession<GateSession>(config);
  } catch {
    // Corrupt/undecryptable cookie (e.g. SESSION_SECRET rotated).
    await clearSession({ name: config.name, cookie: config.cookie });
    return {
      id: undefined as string | undefined,
      data: {} as GateSession,
      update: async (_v: GateSession) => {
        throw new Error("The old access cookie was reset. Please enter the password again.");
      },
      clear: async () => {
        await clearSession({ name: config.name, cookie: config.cookie });
      },
    };
  }
}
