import { db, dbUsable } from "./db";
import type { SessionUser } from "./auth";

/* ==========================================================================
   Audit trail (section F/G)
   --------------------------------------------------------------------------
   Append-only record of staff actions. Two rules:

     • It never throws. An audit write failing must not fail the action the
       user asked for — but it is logged to the server console so the gap is
       visible in the deploy logs.
     • It never stores secrets. `redact()` strips password/hash/token/secret
       keys at any depth before the diff is written.
   ========================================================================== */

const SECRET_KEY = /pass(word)?|secret|token|hash|otp|api[_-]?key|authorization/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEY.test(key) ? "***" : redact(v, depth + 1);
  }
  return out;
}

/** Field-level diff of before/after, ignoring keys that did not change. */
export function diffOf(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, next] of Object.entries(after)) {
    const prev = before?.[key];
    if (JSON.stringify(prev) === JSON.stringify(next)) continue;
    diff[key] = { from: redact(prev), to: redact(next) };
  }
  return diff;
}

export async function recordAudit(input: {
  actor: SessionUser | null;
  action: "create" | "update" | "delete" | "login" | "logout" | "invite" | "role" | "suspend" | "export";
  entity: string;
  entityId?: string | null;
  diff?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  if (!dbUsable()) return;
  try {
    await db()
      .from("audit_logs")
      .insert({
        actor_id: input.actor?.id ?? null,
        actor_email: input.actor?.email ?? null,
        actor_role: input.actor?.role ?? null,
        action: input.action,
        entity: input.entity,
        entity_id: input.entityId ?? null,
        diff: input.diff ? (redact(input.diff) as Record<string, unknown>) : null,
        meta: (input.meta ?? {}) as Record<string, unknown>,
        ip: input.ip ?? null,
        user_agent: input.userAgent ?? null,
      });
  } catch (error) {
    console.warn("[audit] write failed:", (error as Error).message);
  }
}
