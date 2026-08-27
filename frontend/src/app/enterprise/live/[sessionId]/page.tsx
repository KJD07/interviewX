"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import { tokens } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

type ViewState = "connecting" | "waiting" | "live" | "ended" | "denied" | "error";

function wsUrl(sessionId: number) {
  const base = API_URL.replace(/^http/, "ws");
  const access = tokens.getAccess() ?? "";
  return `${base}/ws/enterprise/live/${sessionId}/?role=view&token=${encodeURIComponent(access)}`;
}

const STATE_COPY: Record<ViewState, string> = {
  connecting: "Connecting…",
  waiting: "Waiting for the candidate's camera to come online…",
  live: "Live",
  ended: "This live view has ended.",
  denied: "You don't have permission to watch this session, or live viewing isn't enabled for this org.",
  error: "Couldn't connect. Retrying…",
};

export default function LiveCameraViewPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = Number(params.sessionId);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<ViewState>("connecting");
  // Some mobile browsers still refuse programmatic play() even on a muted
  // video (no direct user gesture on this call) — surfaced as a black
  // frame with `state` already "live". Falls back to a manual tap.
  const [needsTap, setNeedsTap] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let ws: WebSocket | null = null;
    let pc: RTCPeerConnection | null = null;

    const connect = () => {
      setState("connecting");
      setNeedsTap(false);
      ws = new WebSocket(wsUrl(sessionId));

      ws.onopen = () => {
        if (cancelled) return;
        setState("waiting");
        ws?.send(JSON.stringify({ type: "viewer-join" }));
      };

      ws.onclose = (evt) => {
        if (cancelled) return;
        if (evt.code === 4401 || evt.code === 4403) {
          setState("denied");
          return;
        }
        setState((s) => (s === "live" ? "ended" : s));
      };

      ws.onerror = () => {
        if (!cancelled) setState("error");
      };

      ws.onmessage = async (msgEvt) => {
        if (cancelled) return;
        const msg = JSON.parse(msgEvt.data);

        if (msg.type === "publish-left") {
          pc?.close();
          pc = null;
          setState("ended");
          return;
        }

        if (msg.type === "ice-candidate" && pc && msg.candidate) {
          try {
            await pc.addIceCandidate(msg.candidate);
          } catch {
            // benign — a late/duplicate candidate
          }
          return;
        }

        if (msg.type === "offer") {
          pc?.close();
          pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
          pc.ontrack = (e) => {
            const video = videoRef.current;
            if (video) {
              video.srcObject = e.streams[0];
              video.play().catch(() => setNeedsTap(true));
            }
            setState("live");
          };
          pc.onicecandidate = (e) => {
            if (e.candidate) ws?.send(JSON.stringify({ type: "ice-candidate", candidate: e.candidate }));
          };
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws?.send(JSON.stringify({ type: "answer", sdp: answer }));
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      ws?.close();
      pc?.close();
    };
  }, [sessionId]);

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="min-h-screen" style={{ background: "var(--page)" }}>
          <main className="max-w-3xl mx-auto px-6 py-10 fade-up">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--ink-faint)" }}>
              Enterprise · Live candidate view
            </p>
            <h1 className="font-display text-2xl font-bold mb-6" style={{ color: "var(--ink)" }}>
              Session #{sessionId}
            </h1>

            <div
              className="rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(28,26,22,0.06)]"
              style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
            >
              <div className="relative aspect-video" style={{ background: "#111" }}>
                {/* No audio track is ever published (the candidate's camera
                    capture is video-only), so muting costs nothing and is
                    required for autoplay to reliably start on mobile
                    browsers — an unmuted <video> is the classic cause of a
                    "connected but black" live view. */}
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
                {state === "live" && needsTap && (
                  <button
                    onClick={() => {
                      videoRef.current?.play().then(() => setNeedsTap(false)).catch(() => {});
                    }}
                    className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white"
                    style={{ background: "rgba(0,0,0,0.5)" }}
                  >
                    Tap to play
                  </button>
                )}
                {state !== "live" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-sm text-white/80">{STATE_COPY[state]}</p>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 flex items-center gap-2" style={{ borderTop: "1px solid var(--border)" }}>
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: state === "live" ? "var(--success)" : "var(--ink-faint)" }}
                />
                <span className="text-sm" style={{ color: "var(--ink-dim)" }}>{STATE_COPY[state]}</span>
              </div>
            </div>

            <p className="text-xs mt-4" style={{ color: "var(--ink-faint)" }}>
              This stream is peer-to-peer and never recorded or stored — closing this page ends it.
            </p>
          </main>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
