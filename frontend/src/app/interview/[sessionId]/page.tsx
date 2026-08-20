"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { interviews, ApiError } from "@/lib/api";
import type { InterviewSession, WorkspacePayload } from "@/lib/api";
import CodeWorkspace from "@/components/interview/CodeWorkspace";
import SystemDesignWorkspace from "@/components/interview/SystemDesignWorkspace";
import { useProctoring } from "@/hooks/useProctoring";
import icon from "@/app/icon.png";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "ai";
  text: string;
  ts: string;
  workspace?: WorkspacePayload;
}

// The AI's signal to show a workspace — no `content` yet, just what kind and
// (for coding) which language, until the candidate actually submits.
type OpenWorkspace = { type: "coding" | "system_design"; language?: string } | null;

// Minimal typing for the Web Speech API (not in default TS DOM lib)
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: Event) => void) | null;
  onstart: (() => void) | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatCountdown(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

// Pick a reasonable default voice (prefer English, non-"local"/novelty voices)
function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  return (
    voices.find((v) => /en-US|en-GB|en-IN/i.test(v.lang) && /Google|Microsoft/i.test(v.name)) ||
    voices.find((v) => /en-US|en-GB|en-IN/i.test(v.lang)) ||
    voices[0]
  );
}

// ── Countdown timer badge ────────────────────────────────────────────────────

function TimerBadge({ secondsLeft }: { secondsLeft: number | null }) {
  if (secondsLeft === null) return null;
  const low = secondsLeft <= 5 * 60; // last 5 minutes
  return (
    <span
      className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums"
      style={
        low
          ? { background: "rgba(239,68,68,0.12)", color: "var(--danger)" }
          : { background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)" }
      }
      title="Time remaining"
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      {formatCountdown(secondsLeft)}
    </span>
  );
}

// ── Typing / speaking indicator ───────────────────────────────────────────────

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
            background: "var(--ink-faint)",
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

// Animated waveform bars shown while the AI is speaking out loud
function SpeakingWave() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="block rounded-full"
          style={{
            width: 3,
            height: 12,
            background: "var(--accent)",
            animation: `wave 0.9s ease-in-out ${i * 0.1}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.3); opacity: 0.5; }
          50%      { transform: scaleY(1);   opacity: 1;   }
        }
      `}</style>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function Bubble({ msg, speaking }: { msg: Message; speaking?: boolean }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1 mr-2.5"
          style={{
            background: "var(--accent-glow)",
            color: "var(--accent)",
            boxShadow: speaking ? "0 0 0 3px rgba(99,102,241,0.25)" : undefined,
          }}
        >
          AI
        </div>
      )}
      <div className="max-w-[75%]">
        {msg.workspace?.content ? (
          <pre
            className="rounded-2xl px-4 py-3 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap"
            style={
              isUser
                ? { background: "var(--accent)", color: "var(--accent-ink)", borderBottomRightRadius: 4 }
                : {
                    background: "var(--surface)",
                    border: "1px solid var(--border-mid)",
                    color: "var(--ink)",
                    borderBottomLeftRadius: 4,
                  }
            }
          >
            <code>{msg.workspace.content}</code>
          </pre>
        ) : (
          <div
            className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
            style={
              isUser
                ? {
                    background: "var(--accent)",
                    color: "var(--accent-ink)",
                    borderBottomRightRadius: 4,
                  }
                : {
                    background: "var(--surface)",
                    border: speaking ? "1px solid var(--accent)" : "1px solid var(--border-mid)",
                    color: "var(--ink)",
                    borderBottomLeftRadius: 4,
                  }
            }
          >
            {msg.text}
          </div>
        )}
        <p
          className={`text-xs mt-1 flex items-center gap-1 ${isUser ? "justify-end" : "justify-start"}`}
          style={{ color: "var(--ink-faint)" }}
        >
          {formatTime(msg.ts)}
          {speaking && (
            <span style={{ color: "var(--accent)" }} className="inline-flex items-center gap-0.5">
              · <span>🔊 speaking…</span>
            </span>
          )}
        </p>
      </div>
      {isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1 ml-2.5"
          style={{ background: "var(--surface)", color: "var(--ink-dim)", border: "1px solid var(--border-mid)" }}
        >
          You
        </div>
      )}
    </div>
  );
}

// ── Live transcript preview bubble (while user is speaking, before send) ─────

function InterimBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%]">
        <div
          className="rounded-2xl px-4 py-3 text-sm leading-relaxed italic"
          style={{
            background: "rgba(99,102,241,0.35)",
            color: "var(--ink)",
            borderBottomRightRadius: 4,
            border: "1px dashed rgba(255,255,255,0.35)",
          }}
        >
          {text || "Listening…"}
        </div>
      </div>
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1 ml-2.5"
        style={{ background: "rgba(239,68,68,0.15)", color: "var(--danger)" }}
      >
        <span
          className="block w-2.5 h-2.5 rounded-full"
          style={{ background: "var(--danger)", animation: "pulse 1s ease-in-out infinite" }}
        />
      </div>
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
      style={{ background: "rgba(6, 10, 20, 0.7)" }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-6 fade-up"
        style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
      >
        <h2 className="font-display text-base font-bold mb-2" style={{ color: "var(--ink)" }}>
          End interview?
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--ink-dim)" }}>
          The AI will score your performance and generate feedback. You won't be able to continue after this.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-full text-sm font-semibold transition-opacity disabled:opacity-40"
            style={{ background: "var(--border-mid)", color: "var(--ink)" }}
          >
            Keep going
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-full text-sm font-semibold transition-opacity disabled:opacity-40"
            style={{ background: "var(--danger)", color: "var(--ink)" }}
          >
            {loading ? "Ending…" : "End interview"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const SILENCE_MS = 2000; // pause length that triggers auto-send in voice mode
const INITIAL_WAIT_MS = 5000; // max wait for the user to start speaking on the very first turn
const SUBSEQUENT_WAIT_MS = 5000; // max wait for the user to start speaking on every turn after that
const NO_RESPONSE_MESSAGE = "(No response)";

export default function InterviewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const sessionId = Number(params.sessionId);

  const [session, setSession] = useState<InterviewSession | null>(null);
  const {
    consentNeeded: proctoringConsentNeeded,
    acceptConsent: acceptProctoring,
    declineConsent: declineProctoring,
    warning: proctoringWarning,
    limitReached: proctoringLimitReached,
    blocked: proctoringBlocked,
    blockedReason: proctoringBlockedReason,
    disconnectSecondsLeft: proctoringDisconnectSecondsLeft,
  } = useProctoring(session);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [aiTyping, setAiTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [showEndModal, setShowEndModal] = useState(false);
  const [ending, setEnding] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [timeUp, setTimeUp] = useState(false);

  // ── Coding / system-design workspace state ──────────────────────────────
  const [openWorkspace, setOpenWorkspace] = useState<OpenWorkspace>(null);
  const [workspaceSubmitting, setWorkspaceSubmitting] = useState(false);

  // ── Full-screen mode state ──────────────────────────────────────────────────
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoExitReason, setAutoExitReason] = useState("");
  // Grace-period warning shown before we actually end the interview, so an
  // accidental Escape / alt-tab doesn't instantly burn a credit.
  const [exitWarning, setExitWarning] = useState<{ reason: string; secondsLeft: number } | null>(
    null
  );

  // ── Voice state ──────────────────────────────────────────────────────────
  const [voiceMode, setVoiceMode] = useState(false);
  const [micSupported, setMicSupported] = useState(true);
  const [ttsSupported, setTtsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timeUpHandledRef = useRef(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // True whenever we do NOT want to act on recognition events (AI is
  // speaking, a send is in flight, etc). Checked inside onresult/onstart
  // so a stray event from an instance we thought we'd killed can't sneak
  // through and get treated as the user's answer.
  const micMutedRef = useRef(true);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // caps how long we wait for the user to START speaking each turn
  const hasSpokenOnceRef = useRef(false); // true once the user has produced any speech in this interview
  const finalTranscriptRef = useRef("");
  const voiceModeRef = useRef(false); // mirrors voiceMode for use inside async callbacks
  const shouldListenRef = useRef(false); // whether we *want* to be listening right now
  const voiceModeBeforeWorkspaceRef = useRef(false); // was voice mode on right before a workspace auto-disabled it, so we can resume it once the workspace closes

  const hasEnteredFullscreenRef = useRef(false); // true once the candidate has confirmed full-screen
  const autoExitHandledRef = useRef(false); // guards against double auto-end firing
  const exitWarningIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null); // countdown tick
  const exitWarningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // fires the actual auto-end

  // Exit-warning strikes and "grace period in progress" are mirrored into
  // sessionStorage (keyed per session id) because otherwise a candidate could
  // dodge the auto-end entirely by refreshing the page: hasEnteredFullscreenRef
  // and the grace-period timer are plain in-memory state that resets to a
  // clean slate on every mount, so a refresh mid-countdown silently cancels
  // the pending auto-end and a refresh after each exit resets the "one free
  // warning" leniency indefinitely.
  const MAX_EXIT_STRIKES = 2;
  const exitPendingKey = `ix_exit_pending_${sessionId}`;
  const exitStrikesKey = `ix_exit_strikes_${sessionId}`;

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  // Feature detection
  useEffect(() => {
    const SR =
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    setMicSupported(!!SR);
    setTtsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    // Warm up voice list (some browsers load voices async)
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  // ── Load session ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sessionId) return;
    // Guards against a late response (e.g. the user navigated away while it
    // was in flight) still calling setState/router.replace on a component
    // React has already discarded.
    let cancelled = false;
    interviews.detail(sessionId)
      .then((s) => {
        if (cancelled) return;
        setSession(s);
        // Rehydrate existing transcript
        if (s.transcript && s.transcript.length > 0) {
          const transcript = s.transcript as Message[];
          setMessages(transcript);
          // If the AI's last turn opened a workspace and the candidate hasn't
          // submitted anything for it yet, restore that panel on reload.
          const last = transcript[transcript.length - 1];
          if (last.role === "ai" && last.workspace && !last.workspace.content) {
            setOpenWorkspace({ type: last.workspace.type, language: last.workspace.language });
          }
        }
        // If session already ended, redirect to results
        if (s.status === "completed") {
          router.replace(`/interview/${sessionId}/results`);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError) setLoadError(err.detail);
        else setLoadError("Could not load session.");
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, router]);

  // ── Countdown timer ──────────────────────────────────────────────────────────
  // Each session has a randomized 45-60 min limit set by the backend. We
  // recompute the deadline from started_at + duration_minutes so the timer
  // survives page refreshes and stays in sync with the server's own cutoff.

  useEffect(() => {
    if (!session || session.status !== "in_progress") return;

    const deadline =
      new Date(session.started_at).getTime() +
      session.duration_minutes * 60 * 1000;

    const tick = () => {
      const remaining = Math.round((deadline - Date.now()) / 1000);
      setSecondsLeft(remaining);
      if (remaining <= 0) setTimeUp(true);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session]);

  // When time runs out, auto-submit the interview for scoring exactly once.
  useEffect(() => {
    if (!timeUp || timeUpHandledRef.current || !sessionId) return;
    timeUpHandledRef.current = true;
    setShowEndModal(false);
    shouldListenRef.current = false;
    stopListening();
    window.speechSynthesis?.cancel();
    interviews
      .end(sessionId)
      .catch(() => {})
      .finally(() => router.replace(`/interview/${sessionId}/results`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp, sessionId, router]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiTyping, interimText, isAiSpeaking]);

  // ── Auto-resize textarea ────────────────────────────────────────────────────

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  // ── Send message (accepts optional override so voice transcripts don't race state) ──

  const handleSend = useCallback(
    async (overrideText?: string, workspace?: WorkspacePayload, isCheckIn?: boolean) => {
      const text = (overrideText ?? input).trim();
      if (!text && !workspace) return;
      if (sending || aiTyping || timeUp) return;

      const userMsg: Message = { role: "user", text, ts: new Date().toISOString(), workspace };
      setMessages((prev) => [...prev, userMsg]);
      if (!workspace) setInput("");
      setInterimText("");
      setSending(true);
      // A silent pause check-in doesn't need the full typing-indicator treatment.
      if (!isCheckIn) setAiTyping(true);
      if (workspace) setWorkspaceSubmitting(true);

      if (textareaRef.current) textareaRef.current.style.height = "auto";

      try {
        const res = await interviews.chat(sessionId, text, workspace);
        const aiMsg: Message = {
          role: "ai",
          text: res.ai_message,
          ts: new Date().toISOString(),
          workspace: res.open_workspace ?? undefined,
        };
        setMessages((prev) => [...prev, aiMsg]);

        if (res.open_workspace) {
          setOpenWorkspace(res.open_workspace);
        } else if (workspace && !isCheckIn) {
          // Only an actual workspace submission (not a background check-in,
          // and not an ordinary typed/spoken chat message sent while the
          // panel happens to be open) closes it when the AI doesn't request
          // a new one — otherwise talking/typing alongside an open workspace
          // (e.g. explaining your approach out loud) would wrongly dismiss it.
          setOpenWorkspace(null);
        }

        // Speak the AI's reply out loud if we're in voice mode
        if (voiceModeRef.current && ttsSupported) {
          speak(res.ai_message);
        }
      } catch (err) {
        if (err instanceof ApiError && err.code === "time_expired") {
          setTimeUp(true);
          return;
        }
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
        setWorkspaceSubmitting(false);
        textareaRef.current?.focus();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input, sending, aiTyping, timeUp, sessionId, ttsSupported]
  );

  const handleWorkspaceSubmit = useCallback(
    (content: string) => {
      if (!openWorkspace) return;
      handleSend("", { type: openWorkspace.type, content, language: openWorkspace.language }, false);
    },
    [openWorkspace, handleSend]
  );

  const handleWorkspaceCheckIn = useCallback(
    (content: string) => {
      if (!openWorkspace) return;
      handleSend("", { type: openWorkspace.type, content, language: openWorkspace.language }, true);
    },
    [openWorkspace, handleSend]
  );

  // Keyboard: Enter to send (Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Text-to-speech (AI voice) ────────────────────────────────────────────────

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    // Belt-and-suspenders: make sure the mic is actually dead before we
    // start talking, in case a recognition instance is still winding down.
    micMutedRef.current = true;
    stopListening();

    window.speechSynthesis.cancel(); // stop anything currently playing

    const utter = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) utter.voice = voice;
    utter.rate = 1;
    utter.pitch = 1;

    utter.onstart = () => {
      micMutedRef.current = true;
      setIsAiSpeaking(true);
    };
    utter.onend = () => {
      setIsAiSpeaking(false);
      // Small grace period after TTS ends before we unmute — some
      // browsers keep a trailing bit of speaker audio queued that would
      // otherwise leak into the very start of the next listening session.
      setTimeout(() => {
        micMutedRef.current = false;
        if (voiceModeRef.current && shouldListenRef.current && !timeUp) {
          startListening();
        }
      }, 250);
    };
    utter.onerror = () => {
      setIsAiSpeaking(false);
      setTimeout(() => {
        micMutedRef.current = false;
        if (voiceModeRef.current && shouldListenRef.current && !timeUp) {
          startListening();
        }
      }, 250);
    };

    window.speechSynthesis.speak(utter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp]);

  // ── Speech-to-text (user mic) ─────────────────────────────────────────────────

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const clearInitialWaitTimer = () => {
    if (initialWaitTimerRef.current) {
      clearTimeout(initialWaitTimerRef.current);
      initialWaitTimerRef.current = null;
    }
  };

  const stopListening = () => {
    clearSilenceTimer();
    clearInitialWaitTimer();
    micMutedRef.current = true; // belt-and-suspenders: ignore any late-firing events
    if (recognitionRef.current) {
      try {
        // Detach ALL handlers before killing the instance. Only nulling
        // onend (the old code) left onresult/onstart/onerror live, so a
        // recognition instance that hadn't fully released the mic yet
        // could still fire onresult with audio it picked up from the
        // speakers (the AI's own TTS voice) — and that stray transcript
        // would get auto-sent as if the user said it.
        recognitionRef.current.onresult = null;
        recognitionRef.current.onstart = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null; // avoid auto-restart loop on manual stop
        // abort() cuts the mic immediately; stop() tries to flush a final
        // result first, which is exactly the window where echo leaks in.
        recognitionRef.current.abort();
      } catch {
        /* no-op */
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const SRConstructor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!SRConstructor) {
      setMicSupported(false);
      return;
    }
    if (sending || aiTyping || timeUp || isAiSpeaking) return;

    // Stop any previous instance first
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        /* no-op */
      }
    }

    const recognition = new SRConstructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    finalTranscriptRef.current = "";
    setInterimText("");
    setVoiceError("");

    recognition.onstart = () => {
      micMutedRef.current = false; // this instance is legitimate, allow its results through
      setIsListening(true);

      // Cap how long we wait for the user to START speaking this turn. First
      // turn of the interview gets a longer grace period; every turn after
      // the user has spoken at least once uses the shorter dynamic wait.
      clearInitialWaitTimer();
      const waitMs = hasSpokenOnceRef.current ? SUBSEQUENT_WAIT_MS : INITIAL_WAIT_MS;
      initialWaitTimerRef.current = setTimeout(() => {
        const captured = finalTranscriptRef.current.trim();
        shouldListenRef.current = true; // resume listening after the AI responds & speaks
        stopListening();
        if (captured) {
          // The user had already said something before the window closed —
          // send it instead of waiting further.
          handleSend(captured);
        } else {
          // No speech at all within the wait window — don't keep waiting.
          // Tell the AI the candidate didn't answer so it moves the
          // interview forward on its own (e.g. re-prompts or asks the next question).
          handleSend(NO_RESPONSE_MESSAGE);
        }
      }, waitMs);
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      // Drop anything that arrives while we're supposed to be muted — this
      // is what actually stops the AI's own TTS voice (leaking in through
      // the mic) from being transcribed and auto-sent as the user's answer.
      if (micMutedRef.current) return;

      // The user has started speaking — the initial wait window is satisfied.
      clearInitialWaitTimer();
      hasSpokenOnceRef.current = true;

      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const chunk = result[0].transcript;
        if (result.isFinal) {
          finalTranscriptRef.current += chunk + " ";
        } else {
          interim += chunk;
        }
      }
      setInterimText((finalTranscriptRef.current + interim).trim());

      // Reset the "user has paused" timer on every new bit of speech
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        const finalText = (finalTranscriptRef.current + interim).trim();
        if (finalText) {
          shouldListenRef.current = true; // we'll resume after AI responds & speaks
          stopListening();
          handleSend(finalText);
        }
      }, SILENCE_MS);
    };

    recognition.onerror = (e: Event) => {
      const err = (e as unknown as { error?: string }).error;
      if (err === "not-allowed" || err === "service-not-allowed") {
        setVoiceError("Microphone access denied. Please allow mic access to use voice mode.");
        shouldListenRef.current = false;
        setVoiceMode(false);
        clearInitialWaitTimer();
      } else if (err === "no-speech") {
        // Harmless — just restart if we still want to be listening; our own
        // initial-wait timer (not this browser event) governs the cutoff.
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Some browsers stop recognition automatically after a pause; restart
      // it if we still want to be listening (and haven't already sent/spoken).
      if (
        shouldListenRef.current &&
        voiceModeRef.current &&
        !timeUp &&
        !sending &&
        !aiTyping &&
        !isAiSpeaking
      ) {
        try {
          recognition.start();
        } catch {
          /* already started elsewhere — ignore */
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      /* no-op: recognition may already be running */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending, aiTyping, timeUp, isAiSpeaking, handleSend]);

  // Toggle voice mode on/off
  const toggleVoiceMode = () => {
    if (voiceMode) {
      // Turning OFF
      shouldListenRef.current = false;
      micMutedRef.current = true;
      stopListening();
      window.speechSynthesis?.cancel();
      setIsAiSpeaking(false);
      setVoiceMode(false);
    } else {
      // Turning ON
      setVoiceError("");
      setVoiceMode(true);
      shouldListenRef.current = true;
      if (!sending && !aiTyping && !isAiSpeaking && !timeUp) {
        startListening();
      }
    }
  };

  // Clean up mic/speech on unmount
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      stopListening();
      window.speechSynthesis?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drop out of voice mode whenever a coding/system-design workspace opens —
  // typing code and talking over the mic don't mix, and leaving voice mode on
  // would keep listening (and auto-sending on silence) underneath the editor.
  // Note: this only stops the mic, not the speaker — the AI's spoken intro to
  // the workspace (queued by handleSend's speak() call in the same turn) must
  // be allowed to finish; speak()'s own onend checks voiceModeRef before
  // deciding whether to resume listening, so turning voiceMode off here is
  // enough to prevent the mic from restarting once it's done.
  //
  // Once the workspace closes again, resume voice mode automatically if it
  // was on beforehand — otherwise every coding question would permanently
  // strand the candidate in text mode. The toggle button is disabled while a
  // workspace is open (see below), so voiceModeRef can't flip back on mid-open
  // and re-trigger this; that also means every open_workspace payload from a
  // still-open workspace (a fresh object each response) is a harmless no-op here.
  useEffect(() => {
    if (openWorkspace) {
      if (voiceModeRef.current) {
        voiceModeBeforeWorkspaceRef.current = true;
        shouldListenRef.current = false;
        micMutedRef.current = true;
        stopListening();
        setVoiceMode(false);
      }
    } else if (voiceModeBeforeWorkspaceRef.current) {
      voiceModeBeforeWorkspaceRef.current = false;
      setVoiceError("");
      setVoiceMode(true);
      shouldListenRef.current = true;
      if (!sending && !aiTyping && !isAiSpeaking && !timeUp) {
        startListening();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWorkspace]);

  // ── End interview ───────────────────────────────────────────────────────────

  const handleEnd = async () => {
    setEnding(true);
    shouldListenRef.current = false;
    stopListening();
    window.speechSynthesis?.cancel();
    try {
      await interviews.end(sessionId);
      router.push(`/interview/${sessionId}/results`);
    } catch (err) {
      setShowEndModal(false);
      setEnding(false);
    }
  };

  // ── Auto-end (full-screen exit / window minimized) ─────────────────────────
  // Wrapped in a ref so the event listeners below (registered once) always call
  // the latest version without needing to re-subscribe on every render.
  const autoEndInterview = useCallback(
    async (reason: string) => {
      if (autoExitHandledRef.current || timeUpHandledRef.current) return;
      autoExitHandledRef.current = true;

      setAutoExitReason(reason);
      setShowEndModal(false);
      setEnding(true);
      shouldListenRef.current = false;
      stopListening();
      window.speechSynthesis?.cancel();

      try {
        await interviews.end(sessionId);
      } catch {
        /* best-effort — the session may already be over server-side */
      } finally {
        router.replace(`/interview/${sessionId}/results`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, router]
  );

  const autoEndInterviewRef = useRef(autoEndInterview);
  useEffect(() => {
    autoEndInterviewRef.current = autoEndInterview;
  }, [autoEndInterview]);

  // ── Auto-end (repeated proctoring violations) ───────────────────────────────
  useEffect(() => {
    if (proctoringLimitReached) {
      autoEndInterviewRef.current(
        "Repeated suspicious activity was detected and this interview was ended automatically."
      );
    }
  }, [proctoringLimitReached]);

  // ── Auto-end (camera declined, unavailable, or disconnected too long) ──────
  // Camera access is mandatory for a proctored interview — no "continue
  // without camera" path. proctoringBlockedReason carries which of those
  // specifically happened (declined / never available / disconnected and
  // didn't reconnect within the grace period).
  useEffect(() => {
    if (proctoringBlocked) {
      autoEndInterviewRef.current(
        proctoringBlockedReason || "Camera access is required for this proctored interview."
      );
    }
  }, [proctoringBlocked, proctoringBlockedReason]);

  // Cancel a pending exit warning — called when the candidate comes back
  // (re-enters full-screen / tab becomes visible again) before time runs out.
  const cancelExitWarning = useCallback(() => {
    if (exitWarningIntervalRef.current) {
      clearInterval(exitWarningIntervalRef.current);
      exitWarningIntervalRef.current = null;
    }
    if (exitWarningTimeoutRef.current) {
      clearTimeout(exitWarningTimeoutRef.current);
      exitWarningTimeoutRef.current = null;
    }
    setExitWarning(null);
    // The candidate returned in time — the countdown they were dodging is
    // over, so there's nothing left to protect against a refresh.
    sessionStorage.removeItem(exitPendingKey);
  }, [exitPendingKey]);

  // Start a grace-period countdown instead of ending the interview
  // immediately. Gives the candidate a chance to undo an accidental
  // Escape / alt-tab before a credit gets burned.
  const GRACE_PERIOD_SECONDS = 10;
  const beginExitWarning = useCallback(
    (reason: string) => {
      if (ending || autoExitHandledRef.current || exitWarningTimeoutRef.current) return;

      // Cumulative strikes persist across refreshes (sessionStorage), so
      // repeatedly exiting full-screen and refreshing to reset the "one free
      // warning" doesn't grant an unlimited number of free passes — a repeat
      // offender gets ended immediately instead of a fresh grace period.
      const strikes = Number(sessionStorage.getItem(exitStrikesKey) || "0") + 1;
      sessionStorage.setItem(exitStrikesKey, String(strikes));

      if (strikes > MAX_EXIT_STRIKES) {
        sessionStorage.removeItem(exitPendingKey);
        autoEndInterviewRef.current(
          `${reason} This happened multiple times, so the interview was automatically ended.`
        );
        return;
      }

      // Marks a countdown as "in progress" so that if the candidate refreshes
      // instead of returning, the next mount can detect the dodge and end the
      // interview immediately rather than starting over with a clean slate.
      sessionStorage.setItem(exitPendingKey, reason);

      setExitWarning({ reason, secondsLeft: GRACE_PERIOD_SECONDS });
      exitWarningIntervalRef.current = setInterval(() => {
        setExitWarning((prev) => {
          if (!prev) return prev;
          const secondsLeft = prev.secondsLeft - 1;
          return secondsLeft > 0 ? { ...prev, secondsLeft } : prev;
        });
      }, 1000);
      exitWarningTimeoutRef.current = setTimeout(() => {
        cancelExitWarning();
        autoEndInterviewRef.current(
          `${reason} You didn't return in time, so the interview was automatically ended.`
        );
      }, GRACE_PERIOD_SECONDS * 1000);
    },
    [ending, cancelExitWarning, exitPendingKey, exitStrikesKey]
  );

  useEffect(() => cancelExitWarning, [cancelExitWarning]);

  // If the page mounts and finds a grace-period countdown was left "in
  // progress" from before, the candidate refreshed instead of returning —
  // treat it the same as letting the countdown expire, rather than silently
  // granting a clean slate.
  useEffect(() => {
    if (!sessionId) return;
    const pendingReason = sessionStorage.getItem(exitPendingKey);
    if (pendingReason) {
      sessionStorage.removeItem(exitPendingKey);
      autoEndInterviewRef.current(
        `${pendingReason} You didn't return in time, so the interview was automatically ended.`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Escape (or any other way of leaving full-screen) starts the grace-period
  // warning rather than ending the interview outright.
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);

      if (active) {
        cancelExitWarning();
        return;
      }
      if (hasEnteredFullscreenRef.current && !ending && !autoExitHandledRef.current) {
        beginExitWarning("You exited full-screen mode.");
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ending, beginExitWarning, cancelExitWarning]);

  // Minimizing the window (or switching away/backgrounding the tab) starts
  // the grace-period warning rather than ending the interview outright.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Tab becoming visible again doesn't mean full-screen was restored
        // (switching tabs/apps often drops full-screen too) — only cancel
        // the warning once full-screen is actually back, same as the
        // fullscreenchange handler. Otherwise the modal (and its only
        // "resume" button, which re-requests full-screen) would vanish
        // while still minimized, leaving no way to get back in.
        if (document.fullscreenElement) {
          cancelExitWarning();
        }
        return;
      }
      if (hasEnteredFullscreenRef.current && !ending && !autoExitHandledRef.current) {
        beginExitWarning("Your window was minimized or you switched tabs.");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ending, beginExitWarning, cancelExitWarning]);

  // Leaving the page (e.g. after the interview ends) should release full-screen.
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Candidate-initiated entry into full-screen (requestFullscreen needs a user gesture).
  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Full-screen may be unsupported/denied — still let the interview proceed.
    }
    hasEnteredFullscreenRef.current = true;
    setShowFullscreenPrompt(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <ProtectedRoute>
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "var(--page)" }}
        >
          <div className="text-center">
            <p className="text-sm mb-4" style={{ color: "var(--danger)" }}>
              {loadError}
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="text-sm hover:underline"
              style={{ color: "var(--accent)" }}
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
        style={{ height: "100dvh", background: "var(--page)" }}
      >
        {/* ── Full-screen entry prompt ── */}
        {showFullscreenPrompt && session && session.status === "in_progress" && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center px-4"
            style={{ background: "rgba(6, 10, 20, 0.7)" }}
          >
            <div
              className="w-full max-w-sm rounded-[20px] p-8 text-center fade-up"
              style={{ background: "var(--page)", border: "1px solid var(--border)" }}
            >
              <div
                className="inline-flex w-11 h-11 rounded-xl items-center justify-center text-lg mb-4"
                style={{ background: "var(--surface-2)" }}
              >
                ⛶
              </div>
              <h2 className="font-display text-lg font-semibold tracking-tight mb-3" style={{ color: "var(--ink)" }}>
                Enter full-screen to begin
              </h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--ink-dim)" }}>
                This interview runs in full-screen mode. If you exit full-screen or
                switch away, you&apos;ll have a short grace period to return before the
                interview ends automatically — so make sure you&apos;re ready before
                continuing.
              </p>
              <button
                onClick={enterFullscreen}
                className="w-full py-3.5 rounded-full text-sm font-semibold transition-opacity"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                Start full-screen interview
              </button>
            </div>
          </div>
        )}

        {/* ── Proctoring consent (org-invited candidates only) ── */}
        {proctoringConsentNeeded && session && session.status === "in_progress" && (
          <div
            className="fixed inset-0 z-[65] flex items-center justify-center px-4"
            style={{ background: "rgba(6, 10, 20, 0.7)" }}
          >
            <div
              className="w-full max-w-sm rounded-xl p-6 text-center fade-up"
              style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
            >
              <h2 className="font-display text-base font-bold mb-2" style={{ color: "var(--ink)" }}>
                This interview is proctored
              </h2>
              <p className="text-sm mb-6" style={{ color: "var(--ink-dim)" }}>
                As part of this employer&apos;s hiring process, your camera captures a short
                clip only around moments flagged as unusual (e.g. losing focus, no face
                visible, another person appearing on camera, or a phone in view) — it does
                not record continuously. Camera access is required to take this interview;
                declining or a camera failure will end the interview automatically.
              </p>
              <button
                onClick={acceptProctoring}
                className="w-full py-2.5 rounded-full text-sm font-semibold transition-opacity"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                Allow camera & continue
              </button>
              <button
                onClick={declineProctoring}
                className="w-full py-2 mt-2 rounded-full text-sm font-medium hover:underline"
                style={{ color: "var(--ink-dim)" }}
              >
                Decline (ends the interview)
              </button>
            </div>
          </div>
        )}

        {/* ── Proctoring violation warning (non-blocking, self-dismissing) ── */}
        {proctoringWarning && (
          <div
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] px-4 py-3 rounded-lg text-sm font-medium shadow-lg fade-up"
            style={{ background: "var(--danger)", color: "#fff" }}
            role="alert"
          >
            ⚠ {proctoringWarning} This moment is being recorded.
          </div>
        )}

        {/* ── Camera disconnected (grace period to reconnect before auto-end) ── */}
        {proctoringDisconnectSecondsLeft !== null && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center px-4"
            style={{ background: "rgba(6, 10, 20, 0.7)" }}
          >
            <div
              className="w-full max-w-sm rounded-xl p-6 text-center fade-up"
              style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
            >
              <h2 className="font-display text-base font-bold mb-2" style={{ color: "var(--danger)" }}>
                Camera disconnected
              </h2>
              <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                Reconnect your camera within{" "}
                <span style={{ color: "var(--danger)", fontWeight: 600 }}>
                  {proctoringDisconnectSecondsLeft}s
                </span>{" "}
                or the interview will end automatically. This has been flagged as a violation.
              </p>
            </div>
          </div>
        )}

        {/* ── Exit warning (grace period before auto-end actually fires) ── */}
        {exitWarning && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center px-4"
            style={{ background: "rgba(6, 10, 20, 0.7)" }}
          >
            <div
              className="w-full max-w-sm rounded-xl p-6 text-center fade-up"
              style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
            >
              <h2 className="font-display text-base font-bold mb-2" style={{ color: "var(--danger)" }}>
                Come back to continue
              </h2>
              <p className="text-sm mb-2" style={{ color: "var(--ink-dim)" }}>
                {exitWarning.reason} Return to full-screen within{" "}
                <span style={{ color: "var(--danger)", fontWeight: 600 }}>
                  {exitWarning.secondsLeft}s
                </span>{" "}
                or the interview will end automatically.
              </p>
              <button
                onClick={async () => {
                  // Don't cancel the warning here — if a permission prompt
                  // (e.g. mic access for voice mode) is still pending, this
                  // request can fail silently and we'd be left stuck out of
                  // full-screen with no way to retry. The fullscreenchange
                  // listener above cancels the warning once full-screen is
                  // actually re-entered, so the modal stays up (and
                  // re-clickable) until that really happens.
                  try {
                    await document.documentElement.requestFullscreen?.();
                  } catch {
                    /* user gesture may still be required; ignore */
                  }
                }}
                className="w-full py-2.5 rounded-full text-sm font-semibold transition-opacity mt-4"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                I&apos;m back — resume
              </button>
            </div>
          </div>
        )}

        {/* ── Auto-ended overlay (shown briefly while redirecting to results) ── */}
        {ending && autoExitReason && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center px-4"
            style={{ background: "rgba(6, 10, 20, 0.7)" }}
          >
            <div
              className="w-full max-w-sm rounded-xl p-6 text-center fade-up"
              style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
            >
              <h2 className="font-display text-base font-bold mb-2" style={{ color: "var(--danger)" }}>
                Interview ended
              </h2>
              <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                {autoExitReason} Redirecting to your results…
              </p>
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <header
          className="flex items-center justify-between px-5 py-3.5 shrink-0 border-b gap-2"
          style={{ borderColor: "var(--surface)" }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-2 text-base font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
              <Image src={icon} alt="" width={24} height={24} className="rounded-md" priority />
              EvaluLabs
            </span>
            <span
              className="hidden sm:block text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)" }}
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
            <TimerBadge secondsLeft={secondsLeft} />
            {isFullscreen && (
              <span
                className="hidden sm:flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ background: "var(--surface-2)", color: "var(--ink-dim)" }}
                title="Exiting full-screen will end the interview"
              >
                Full-screen
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Voice mode toggle */}
            <button
              onClick={toggleVoiceMode}
              disabled={!micSupported || !ttsSupported || !!openWorkspace}
              title={
                !micSupported || !ttsSupported
                  ? "Voice not supported in this browser — try Chrome or Edge"
                  : openWorkspace
                  ? "Voice mode is unavailable while the coding/system-design workspace is open"
                  : voiceMode
                  ? "Switch back to text mode"
                  : "Switch to voice mode"
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity disabled:opacity-30"
              style={
                voiceMode
                  ? { background: "var(--accent)", color: "var(--accent-ink)" }
                  : { background: "var(--surface)", color: "var(--ink-dim)", border: "1px solid var(--border-mid)" }
              }
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 1.5a2 2 0 0 0-2 2v5a2 2 0 0 0 4 0v-5a2 2 0 0 0-2-2Z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
                <path
                  d="M4 7.5v1a4 4 0 0 0 8 0v-1M8 12.5v2M6 14.5h4"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
              {voiceMode ? "Voice mode on" : "Voice mode"}
            </button>

            <button
              onClick={() => setShowEndModal(true)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-opacity"
              style={{
                background: "rgba(239,68,68,0.12)",
                color: "var(--danger)",
                border: "1px solid rgba(239,68,68,0.25)",
              }}
            >
              End interview
            </button>
          </div>
        </header>

        {voiceError && (
          <div
            className="px-4 py-2 text-xs text-center shrink-0"
            style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger)" }}
          >
            {voiceError}
          </div>
        )}

        {/* ── Message thread ── */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
          {messages.length === 0 && !session && (
            <div className="flex justify-start mt-2">
              <div
                className="w-7 h-7 rounded-full shrink-0 mt-1 mr-2.5 skeleton"
                style={{ borderRadius: "9999px" }}
              />
              <div className="skeleton h-16 w-72 rounded-2xl" />
            </div>
          )}

          {messages.map((msg, i) => {
            const isLastAi = msg.role === "ai" && i === messages.length - 1;
            return <Bubble key={i} msg={msg} speaking={isLastAi && isAiSpeaking} />;
          })}

          {aiTyping && (
            <div className="flex justify-start">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1 mr-2.5"
                style={{ background: "var(--accent-glow)", color: "var(--accent)" }}
              >
                AI
              </div>
              <div
                className="rounded-2xl"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border-mid)",
                  borderBottomLeftRadius: 4,
                }}
              >
                {isAiSpeaking ? <SpeakingWave /> : <TypingDots />}
              </div>
            </div>
          )}

          {/* Live preview of what the mic is picking up, before it's sent */}
          {voiceMode && isListening && !sending && !aiTyping && (
            <InterimBubble text={interimText} />
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input bar ── */}
        <div
          className="px-4 py-3 shrink-0 border-t"
          style={{ borderColor: "var(--surface)" }}
        >
          {openWorkspace ? (
            openWorkspace.type === "coding" ? (
              <CodeWorkspace
                language={openWorkspace.language ?? "javascript"}
                onSubmit={handleWorkspaceSubmit}
                onCheckIn={handleWorkspaceCheckIn}
                submitting={workspaceSubmitting}
              />
            ) : (
              <SystemDesignWorkspace
                onSubmit={handleWorkspaceSubmit}
                onCheckIn={handleWorkspaceCheckIn}
                submitting={workspaceSubmitting}
              />
            )
          ) : voiceMode ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <button
                onClick={() => {
                  if (isListening) {
                    // Manual stop — send whatever was captured so far
                    clearSilenceTimer();
                    const finalText = interimText.trim();
                    shouldListenRef.current = true;
                    stopListening();
                    if (finalText) handleSend(finalText);
                  } else if (!sending && !aiTyping && !isAiSpeaking && !timeUp) {
                    shouldListenRef.current = true;
                    startListening();
                  }
                }}
                disabled={sending || aiTyping || isAiSpeaking || timeUp}
                className="w-16 h-16 rounded-full flex items-center justify-center transition-transform disabled:opacity-40"
                style={{
                  background: isListening ? "var(--danger)" : "var(--accent)",
                  boxShadow: isListening
                    ? "0 0 0 8px rgba(239,68,68,0.15)"
                    : "0 0 0 8px rgba(99,102,241,0.15)",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 1.5a2 2 0 0 0-2 2v5a2 2 0 0 0 4 0v-5a2 2 0 0 0-2-2Z"
                    stroke={isListening ? "#fff" : "var(--accent-ink)"}
                    strokeWidth="1.4"
                  />
                  <path
                    d="M4 7.5v1a4 4 0 0 0 8 0v-1M8 12.5v2M6 14.5h4"
                    stroke={isListening ? "#fff" : "var(--accent-ink)"}
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <p className="text-xs text-center" style={{ color: "var(--ink-faint)" }}>
                {isAiSpeaking
                  ? "AI is speaking…"
                  : isListening
                  ? "Listening — pause when you're done answering"
                  : sending || aiTyping
                  ? "Waiting for AI…"
                  : "Tap the mic to answer by speaking"}
              </p>
            </div>
          ) : (
            <>
              <div
                className="flex items-end gap-3 rounded-xl px-4 py-3"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border-mid)",
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
                  placeholder={
                    timeUp
                      ? "Time's up — wrapping up your interview…"
                      : "Type your answer… (Enter to send, Shift+Enter for newline)"
                  }
                  disabled={sending || aiTyping || timeUp}
                  className="flex-1 resize-none bg-transparent text-sm leading-relaxed disabled:opacity-50"
                  style={{
                    color: "var(--ink)",
                    outline: "none",
                    boxShadow: "none",
                    border: "none",
                    caretColor: "var(--accent)",
                  }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || sending || aiTyping || timeUp}
                  className="shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition-opacity disabled:opacity-30"
                  style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
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
            </>
          )}
          <p className="text-center text-xs mt-2" style={{ color: "var(--ink-faint)" }}>
            {timeUp
              ? "Time's up — your interview is being scored…"
              : secondsLeft !== null
              ? `${formatCountdown(secondsLeft)} left · AI is evaluating your answers in real time`
              : `AI is evaluating your answers in real time · ${user?.username ?? ""}`}
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