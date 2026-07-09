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
      style={{
        background: low ? "rgba(239,68,68,0.12)" : "var(--accent-glow)",
        color: low ? "var(--danger)" : "var(--accent)",
      }}
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
        <div
          className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
          style={
            isUser
              ? {
                  background: "var(--accent)",
                  color: "var(--ink)",
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
      style={{ background: "rgba(15,23,42,0.85)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-6 fade-up"
        style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
      >
        <h2 className="text-base font-bold mb-2" style={{ color: "var(--ink)" }}>
          End interview?
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--ink-dim)" }}>
          The AI will score your performance and generate feedback. You won't be able to continue after this.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded text-sm font-semibold transition-opacity disabled:opacity-40"
            style={{ background: "var(--border-mid)", color: "var(--ink)" }}
          >
            Keep going
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded text-sm font-semibold transition-opacity disabled:opacity-40"
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

const SILENCE_MS = 1600; // pause length that triggers auto-send in voice mode

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
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [timeUp, setTimeUp] = useState(false);

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
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef("");
  const voiceModeRef = useRef(false); // mirrors voiceMode for use inside async callbacks
  const shouldListenRef = useRef(false); // whether we *want* to be listening right now

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
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || sending || aiTyping || timeUp) return;

      const userMsg: Message = { role: "user", text, ts: new Date().toISOString() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setInterimText("");
      setSending(true);
      setAiTyping(true);

      if (textareaRef.current) textareaRef.current.style.height = "auto";

      try {
        const res = await interviews.chat(sessionId, text);
        const aiMsg: Message = {
          role: "ai",
          text: res.ai_message,
          ts: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMsg]);

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
        textareaRef.current?.focus();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input, sending, aiTyping, timeUp, sessionId, ttsSupported]
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
    window.speechSynthesis.cancel(); // stop anything currently playing

    const utter = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) utter.voice = voice;
    utter.rate = 1;
    utter.pitch = 1;

    utter.onstart = () => setIsAiSpeaking(true);
    utter.onend = () => {
      setIsAiSpeaking(false);
      // Resume hands-free listening once the AI stops talking
      if (voiceModeRef.current && shouldListenRef.current && !timeUp) {
        startListening();
      }
    };
    utter.onerror = () => {
      setIsAiSpeaking(false);
      if (voiceModeRef.current && shouldListenRef.current && !timeUp) {
        startListening();
      }
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

  const stopListening = () => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null; // avoid auto-restart loop on manual stop
        recognitionRef.current.stop();
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

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
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
      } else if (err === "no-speech") {
        // Harmless — just restart if we still want to be listening
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
        {/* ── Header ── */}
        <header
          className="flex items-center justify-between px-5 py-3.5 shrink-0 border-b gap-2"
          style={{ borderColor: "var(--surface)" }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-base font-bold tracking-tight" style={{ color: "var(--ink)" }}>
              InterviewX
            </span>
            <span
              className="hidden sm:block text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: "var(--accent-glow)", color: "var(--accent)" }}
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
          </div>

          <div className="flex items-center gap-2">
            {/* Voice mode toggle */}
            <button
              onClick={toggleVoiceMode}
              disabled={!micSupported || !ttsSupported}
              title={
                !micSupported || !ttsSupported
                  ? "Voice not supported in this browser — try Chrome or Edge"
                  : voiceMode
                  ? "Switch back to text mode"
                  : "Switch to voice mode"
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-opacity disabled:opacity-30"
              style={
                voiceMode
                  ? { background: "var(--accent)", color: "var(--ink)" }
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
              className="px-3.5 py-1.5 rounded text-xs font-semibold transition-opacity"
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
            <div className="flex justify-center mt-12">
              <p className="text-sm" style={{ color: "var(--ink-faint)" }}>
                Loading interview…
              </p>
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
          {voiceMode ? (
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
                    stroke="var(--ink)"
                    strokeWidth="1.4"
                  />
                  <path
                    d="M4 7.5v1a4 4 0 0 0 8 0v-1M8 12.5v2M6 14.5h4"
                    stroke="var(--ink)"
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
                  className="shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold transition-opacity disabled:opacity-30"
                  style={{ background: "var(--accent)", color: "var(--ink)" }}
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
