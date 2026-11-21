import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const COOKIE_NAME = "ba_session";
const ADMIN_COOKIE = "ba_admin";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type SessionUser = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: "customer" | "admin";
};

function secret(): Uint8Array {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 16) {
    throw new Error("JWT_SECRET is missing or too short. Set a 32+ character secret.");
  }
  return new TextEncoder().encode(value);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({
    sub: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("biswas-agro")
    .setAudience("biswas-agro-web")
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: "biswas-agro",
      audience: "biswas-agro-web",
    });
    const p = payload as JWTPayload & Partial<SessionUser>;
    if (!p.sub || !p.role) return null;
    return {
      id: p.sub,
      name: (p.name as string) ?? null,
      email: (p.email as string) ?? null,
      phone: (p.phone as string) ?? null,
      role: p.role === "admin" ? "admin" : "customer",
    };
  } catch {
    return null;
  }
}

export const sessionCookie = {
  name: COOKIE_NAME,
  adminName: ADMIN_COOKIE,
  maxAge: MAX_AGE,
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  },
};
