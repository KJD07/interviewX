"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supportChat, ApiError } from "@/lib/api";
import { SUPPORT_EMAIL } from "@/lib/legal";

export type SupportChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const WELCOME: SupportChatMessage = {
  role: "assistant",
  content:
    "Hi! I'm EvaluLabs Help. Ask me anything about the website — plans, interviews, enterprise, or how to get started. (I only answer EvaluLabs questions.)",
};

export default function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SupportChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, messages, sending]);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setError("");
    const nextUser: SupportChatMessage = { role: "user", content: text };
    const apiMessages = [...messages, nextUser]
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, nextUser]);
    setInput("");
    setSending(true);
    try {
      const { reply } = await supportChat.send(apiMessages);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      const detail =
        err instanceof ApiError
          ? err.detail
          : "Something went wrong. Please try again or email us.";
      setError(typeof detail === "string" ? detail : "Could not reach help chat.");
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setSending(false);
    }
  }, [input, sending, messages]);

  return (
    <>
      {open && (
        <div
          className="fixed bottom-[5.5rem] right-4 z-[90] flex w-[min(100vw-2rem,380px)] flex-col overflow-hidden rounded-2xl border shadow-xl sm:right-6"
          style={{
            borderColor: "var(--border-mid)",
            background: "var(--surface)",
            maxHeight: "min(70vh, 520px)",
          }}
          role="dialog"
          aria-label="EvaluLabs help chat"
        >
          <header
            className="flex items-center justify-between gap-3 border-b px-4 py-3"
            style={{ borderColor: "var(--border)", background: "var(--hero-bg)" }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--hero-text)" }}>
                EvaluLabs Help
              </p>
              <p className="text-xs opacity-80" style={{ color: "var(--hero-text)" }}>
                Website & product questions only
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 opacity-80 hover:opacity-100"
              style={{ color: "var(--hero-text)" }}
              aria-label="Close help chat"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <div
            ref={listRef}
            className="flex-1 space-y-3 overflow-y-auto px-3 py-3"
            style={{ background: "var(--page)" }}
          >
            {messages.map((msg, i) => (
              <div
                key={`${msg.role}-${i}`}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap"
                  style={
                    msg.role === "user"
                      ? { background: "var(--accent)", color: "var(--accent-ink)" }
                      : {
                          background: "var(--surface)",
                          color: "var(--ink)",
                          border: "1px solid var(--border)",
                        }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {sending && (
              <p className="text-xs px-1" style={{ color: "var(--ink-faint)" }}>Thinking…</p>
            )}
          </div>

          {error && (
            <p className="px-3 pb-1 text-xs" style={{ color: "var(--danger)" }} role="alert">
              {error}
            </p>
          )}

          <div
            className="border-t px-3 py-2"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder="Ask about plans, features, enterprise…"
                className="flex-1 resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{
                  borderColor: "var(--border-mid)",
                  background: "var(--surface-alt)",
                  color: "var(--ink)",
                }}
                disabled={sending}
              />
              <button
                type="button"
                onClick={send}
                disabled={sending || !input.trim()}
                className="rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-40"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                Send
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-snug" style={{ color: "var(--ink-faint)" }}>
              Still stuck?{" "}
              <Link href="/contact" className="underline underline-offset-2">
                Contact us
              </Link>{" "}
              or email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-[90] flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-lg transition hover:opacity-90 sm:right-6"
        style={{ background: "var(--hero-bg)", color: "var(--hero-text)" }}
        aria-expanded={open}
        aria-label={open ? "Close EvaluLabs help" : "Open EvaluLabs help chat"}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3c-4.97 0-9 3.58-9 8 0 1.85.74 3.55 2 4.9L4 21l4.55-1.2c1.2.33 2.47.52 3.45.52 4.97 0 9-3.58 9-8s-4.03-8-9-8z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        {open ? "Close" : "Help"}
      </button>
    </>
  );
}
