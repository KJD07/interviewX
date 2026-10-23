"use client";
import { useMemo, useState } from "react";

type Block = { kind: "h"; text: string } | { kind: "p"; text: string } | { kind: "ul"; items: string[] };

// Descriptions stored before the feeds kept line breaks are one flat line.
// Recover the structure most postings have: ALL-CAPS section headings and
// " - " / "•" bullets.
function unflatten(text: string) {
  return text
    .replace(/\s*[•●▪◦]\s+/g, "\n- ")
    .replace(
      /(^|\s)((?:[A-Z][A-Z&'’/,]+\s+){1,6}[A-Z][A-Z&'’/]+)(?=\s*(?:[-:]|[A-Z(]|$))/g,
      (m, pre: string, h: string) =>
        h.replace(/[^A-Z]/g, "").length >= 6 && /[A-Z]{4}/.test(h) ? `${pre}\n# ${h}\n` : m,
    )
    .replace(/([.!?:;)])\s+-\s+/g, "$1\n- ");
}

// Split a long paragraph into ~3-sentence chunks so it isn't a wall of text.
function chunk(text: string): string[] {
  if (text.length < 450) return [text];
  const sentences = text.match(/[^.!?]+(?:[.!?]+["')\]]?|$)\s*/g) || [text];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    cur += s;
    if (cur.length > 320) {
      out.push(cur.trim());
      cur = "";
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parse(raw: string): Block[] {
  const text = raw.includes("\n") ? raw : unflatten(raw);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const blocks: Block[] = [];
  lines.forEach((line, i) => {
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "ul") last.items.push(bullet[1]);
      else blocks.push({ kind: "ul", items: [bullet[1]] });
    } else if (line.startsWith("# ")) {
      blocks.push({ kind: "h", text: line.slice(2) });
    } else if (i < lines.length - 1 && line.length <= 60 && !/[.!?,;]$/.test(line)) {
      // A short unpunctuated line ahead of more content reads as a heading.
      blocks.push({ kind: "h", text: line.replace(/:$/, "") });
    } else {
      chunk(line).forEach((p) => blocks.push({ kind: "p", text: p }));
    }
  });
  return blocks;
}

// "High-velocity: Rapid experimentation…" → bold the short lead-in label.
function Item({ text }: { text: string }) {
  const m = text.match(/^([^:]{2,40}):\s+(.+)$/);
  if (!m) return <>{text}</>;
  return (
    <>
      <span className="font-medium" style={{ color: "var(--ink)" }}>{m[1]}:</span> {m[2]}
    </>
  );
}

export default function JobDescription({ text }: { text: string }) {
  const blocks = useMemo(() => parse(text), [text]);
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 1200;
  const collapsed = long && !expanded;

  return (
    <div>
      <div
        className="relative space-y-3 text-sm leading-relaxed max-w-[70ch]"
        style={{
          color: "var(--ink-dim)",
          maxHeight: collapsed ? "22rem" : undefined,
          overflow: collapsed ? "hidden" : undefined,
        }}
      >
        {blocks.map((b, i) =>
          b.kind === "h" ? (
            <p
              key={i}
              className="pt-2 text-[13px] font-semibold tracking-wide first:pt-0"
              style={{ color: "var(--ink)" }}
            >
              {b.text}
            </p>
          ) : b.kind === "ul" ? (
            <ul key={i} className="list-disc pl-5 space-y-1.5 marker:text-[var(--ink-faint)]">
              {b.items.map((it, j) => (
                <li key={j}>
                  <Item text={it} />
                </li>
              ))}
            </ul>
          ) : (
            <p key={i}>{b.text}</p>
          ),
        )}
        {collapsed && (
          <div
            className="absolute inset-x-0 bottom-0 h-20 pointer-events-none"
            style={{ background: "linear-gradient(to bottom, transparent, var(--surface))" }}
          />
        )}
      </div>
      {long && (
        <button
          className="mt-2 text-xs font-medium underline"
          style={{ color: "var(--accent)" }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : "Show full description"}
        </button>
      )}
    </div>
  );
}
