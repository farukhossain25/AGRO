"use client";

import { useState } from "react";
import { toBn } from "@/lib/format";

/* ==========================================================================
   The "কী বদলেছে" cell of the audit log
   --------------------------------------------------------------------------
   THE BUG THIS REPLACES
     The page used to do `row.diff![key].from` for every key of the stored JSON.
     That only works for the diffOf() shape `{ field: { from, to } }`. Several
     writers store something else — settings store the raw value object, the
     wallet-adjust action stores a flat `{ amount, note }`, the reorder action
     stores `{ moved }`-style scalars, and a value can be `null`. Any one of
     those rows made the whole page throw and the admin saw the generic
     "প্যানেলের এই অংশটি লোড হয়নি" screen (the reference number in the
     screenshot is that boundary's digest).

   THE RULE HERE
     Every stored shape gets rendered, and nothing is ever assumed:
       {from, to}  → "আগে → পরে"
       anything else → printed as a value, labelled "নতুন মান"
     A diff can also be a plain string, number or array (not an object at all),
     so the outer value is inspected before it is iterated.

   Long values (a product description, a whole settings object) are clamped and
   scroll inside their own box — one bad row must never stretch the table.
   ========================================================================== */

type DiffLeaf = { from?: unknown; to?: unknown };

/** "from/to" only counts when the object has those keys — `{ amount, note }`
 *  is a value, not a change pair. */
function isChangePair(value: unknown): value is DiffLeaf {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return "from" in (value as Record<string, unknown>) || "to" in (value as Record<string, unknown>);
}

/** Anything printable, with an explicit marker for the values JSON cannot show. */
function show(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "খালি";
  if (typeof value === "string") return value === "" ? "(খালি)" : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isLong(text: string): boolean {
  return text.length > 80 || text.includes("\n");
}

function Value({ children, tone }: { children: string; tone: "old" | "new" | "plain" }) {
  const [open, setOpen] = useState(false);
  const long = isLong(children);
  const toneClass =
    tone === "old"
      ? "text-sand-100/40 line-through decoration-sand-100/25"
      : tone === "new"
        ? "text-leaf-200/90"
        : "text-sand-100/60";

  return (
    <span className={`break-words font-mono text-[10.5px] ${toneClass}`}>
      {long && !open ? (
        <>
          {children.slice(0, 78)}…
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ml-1 rounded bg-white/[0.06] px-1 py-px font-sans text-[9.5px] text-sand-100/70 hover:bg-white/10"
          >
            পুরোটা
          </button>
        </>
      ) : (
        <span className={long ? "block max-h-40 overflow-auto whitespace-pre-wrap rounded bg-black/20 p-1.5" : ""}>
          {children}
        </span>
      )}
    </span>
  );
}

export function AuditDiff({ diff }: { diff: unknown }) {
  /* A diff stored as a bare scalar or list (never an object). */
  if (!diff || typeof diff !== "object" || Array.isArray(diff)) {
    if (diff === null || diff === undefined) return <span className="text-sand-100/30">—</span>;
    return <Value tone="plain">{show(diff)}</Value>;
  }

  const entries = Object.entries(diff as Record<string, unknown>);
  if (!entries.length) return <span className="text-sand-100/30">—</span>;

  return (
    <details>
      <summary className="cursor-pointer text-[11.5px] text-leaf-300">
        {toBn(entries.length)}টি ফিল্ড
      </summary>
      <ul className="mt-1 space-y-1">
        {entries.map(([key, value]) => (
          <li key={key} className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className="font-mono text-[10.5px] text-sand-100/50">{key}:</span>
            {isChangePair(value) ? (
              <>
                <Value tone="old">{show(value.from)}</Value>
                <span aria-hidden className="text-sand-100/30">→</span>
                <Value tone="new">{show(value.to)}</Value>
              </>
            ) : (
              <Value tone="plain">{show(value)}</Value>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
