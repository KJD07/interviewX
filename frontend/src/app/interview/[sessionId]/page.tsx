"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { interviews, ApiError } from "@/lib/api";
import type { InterviewSession } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "ai";
  text: string;
  ts: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block rounded-full"
          style={{
            width: 6,
            height: 6,
            background: "var(--slate-dim)",
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1 mr-2.5"
          style={{ background: "var(--indigo-glow)", color: "var(--indigo)" }}
        >
          AI
        </div>
      )}
      <div className="max-w-[75%]">
        <div
          className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
          style={
            isUser
              ? {
                  background: "var(--indigo)",
                  color: "var(--white)",
                  borderBottomRightRadius: 4,
                }
              : {
                  background: "var(--navy-light)",
                  border: "1px solid var(--navy-mid)",
                  color: "var(--white)",
                  borderBottomLeftRadius: 4,
                }
          }
        >
          {msg.text}
        </div>
        <p
          className={`text-xs mt-1 ${isUser ? "text-right" : "text-left"}`}
          style={{ color: "var(--slate-dim)" }}
        >
          {formatTime(msg.ts)}
        </p>
      </div>
      {isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1 ml-2.5"
          style={{ background: "var(--navy-light)", color: "var(--slate)", border: "1px solid var(--navy-mid)" }}
        >
          You
        </div>
      )}
    </div>
  );
}

// ── End confirm modal ─────────────────────────────────────────────────────────

function EndModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(15,23,42,0.85)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-6 fade-up"
        style={{ background: "var(--navy-light)", border: "1px solid var(--navy-mid)" }}
      >
        <h2 className="text-base font-bold mb-2" style={{ color: "var(--white)" }}>
          End interview?
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--slate)" }}>
          The AI will score your performance and generate feedback. You won't be able to continue after this.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded text-sm font-semibold transition-opacity disabled:opacity-40"
            style={{ background: "var(--navy-mid)", color: "var(--white)" }}
          >
            Keep going
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded text-sm font-semibold transition-opacity disabled:opacity-40"
            style={{ background: "var(--danger)", color: "var(--white)" }}
          >
            {loading ? "Ending…" : "End interview"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InterviewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const sessionId = Number(params.sessionId);

  const [session, setSession] = useState<InterviewSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [aiTyping, setAiTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [showEndModal, setShowEndModal] = useState(false);
  const [ending, setEnding] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Load session ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sessionId) return;
    interviews.detail(sessionId)
      .then((s) => {
        setSession(s);
        // Rehydrate existing transcript
        if (s.transcript && s.transcript.length > 0) {
          setMessages(s.transcript as Message[]);
        }
        // If session already ended, redirect to results
        if (s.status === "completed") {
          router.replace(`/interview/${sessionId}/results`);
        }
      })
      .catch((err) => {
        if (err instanceof ApiError) setLoadError(err.detail);
        else setLoadError("Could not load session.");
      });
  }, [sessionId, router]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiTyping]);

  // ── Auto-resize textarea ────────────────────────────────────────────────────

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  // ── Send message ────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || aiTyping) return;

    const userMsg: Message = { role: "user", text, ts: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    setAiTyping(true);

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await interviews.chat(sessionId, text);
      const aiMsg: Message = {
        role: "ai",
        text: res.ai_message,
        ts: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errMsg: Message = {
        role: "ai",
        text: err instanceof ApiError
          ? `Error: ${err.detail}`
          : "Something went wrong. Please try again.",
        ts: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
      setAiTyping(false);
      textareaRef.current?.focus();
    }
  }, [input, sending, aiTyping, sessionId]);

  // Keyboard: Enter to send (Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── End interview ───────────────────────────────────────────────────────────

  const handleEnd = async () => {
    setEnding(true);
    try {
      await interviews.end(sessionId);
      router.push(`/interview/${sessionId}/results`);
    } catch (err) {
      setShowEndModal(false);
      setEnding(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <ProtectedRoute>
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "var(--navy)" }}
        >
          <div className="text-center">
            <p className="text-sm mb-4" style={{ color: "var(--danger)" }}>
              {loadError}
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="text-sm hover:underline"
              style={{ color: "var(--indigo)" }}
            >
              ← Back to dashboard
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div
        className="flex flex-col"
        style={{ height: "100dvh", background: "var(--navy)" }}
      >
        {/* ── Header ── */}
        <header
          className="flex items-center justify-between px-5 py-3.5 shrink-0 border-b"
          style={{ borderColor: "var(--navy-light)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-base font-bold tracking-tight" style={{ color: "var(--white)" }}>
              InterviewX
            </span>
            <span
              className="hidden sm:block text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: "var(--indigo-glow)", color: "var(--indigo)" }}
            >
              Session #{sessionId}
            </span>
            {/* Live indicator */}
            <span className="flex items-center gap-1.5">
              <span
                className="block w-2 h-2 rounded-full"
                style={{
                  background: "#22c55e",
                  boxShadow: "0 0 0 3px rgba(34,197,94,0.2)",
                  animation: "pulse 2s ease-in-out infinite",
                }}
              />
              <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
              <span className="text-xs" style={{ color: "#22c55e" }}>
                Live
              </span>
            </span>
          </div>

          <button
            onClick={() => setShowEndModal(true)}
            className="px-3.5 py-1.5 rounded text-xs font-semibold transition-opacity"
            style={{
              background: "rgba(239,68,68,0.12)",
              color: "var(--danger)",
              border: "1px solid rgba(239,68,68,0.25)",
            }}
          >
            End interview
          </button>
        </header>

        {/* ── Message thread ── */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
          {messages.length === 0 && !session && (
            <div className="flex justify-center mt-12">
              <p className="text-sm" style={{ color: "var(--slate-dim)" }}>
                Loading interview…
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <Bubble key={i} msg={msg} />
          ))}

          {aiTyping && (
            <div className="flex justify-start">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1 mr-2.5"
                style={{ background: "var(--indigo-glow)", color: "var(--indigo)" }}
              >
                AI
              </div>
              <div
                className="rounded-2xl"
                style={{
                  background: "var(--navy-light)",
                  border: "1px solid var(--navy-mid)",
                  borderBottomLeftRadius: 4,
                }}
              >
                <TypingDots />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input bar ── */}
        <div
          className="px-4 py-3 shrink-0 border-t"
          style={{ borderColor: "var(--navy-light)" }}
        >
          <div
            className="flex items-end gap-3 rounded-xl px-4 py-3"
            style={{
              background: "var(--navy-light)",
              border: "1px solid var(--navy-mid)",
            }}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResize();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer… (Enter to send, Shift+Enter for newline)"
              disabled={sending || aiTyping}
              className="flex-1 resize-none bg-transparent text-sm leading-relaxed disabled:opacity-50"
              style={{
                color: "var(--white)",
                outline: "none",
                boxShadow: "none",
                border: "none",
                caretColor: "var(--indigo)",
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending || aiTyping}
              className="shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold transition-opacity disabled:opacity-30"
              style={{ background: "var(--indigo)", color: "var(--white)" }}
            >
              {sending ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M14 8H2M9 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-center text-xs mt-2" style={{ color: "var(--slate-dim)" }}>
            AI is evaluating your answers in real time · {user?.username}
          </p>
        </div>
      </div>

      {/* ── End modal ── */}
      {showEndModal && (
        <EndModal
          onConfirm={handleEnd}
          onCancel={() => setShowEndModal(false)}
          loading={ending}
        />
      )}
    </ProtectedRoute>
  );
}