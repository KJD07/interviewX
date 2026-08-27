// src/hooks/useLiveCameraPublisher.ts
// Superuser-opt-in-only (session.live_camera_enabled, set server-side from
// apps.enterprise.Organization.live_camera_enabled — see
// InterviewSessionSerializer): WebRTC-publishes the candidate's existing
// proctoring camera stream so an org member can watch it live on
// /enterprise. A no-op whenever the flag is off, which is every org by
// default — nothing here runs, connects, or captures anything extra in
// that case.
//
// Deliberately lightweight even when enabled: this only opens one small
// WebSocket to wait for a viewer. No video encoding/streaming happens (no
// RTCPeerConnection, no addTrack) until a viewer actually joins and asks
// for an offer — so an org whose live view nobody is watching pays no
// meaningful CPU/network cost beyond that idle socket.
"use client";

import { useEffect, useRef } from "react";
import { tokens } from "@/lib/api";
import type { InterviewSession } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

function wsUrl(sessionId: number, role: "publish" | "view") {
  const base = API_URL.replace(/^http/, "ws");
  const access = tokens.getAccess() ?? "";
  return `${base}/ws/enterprise/live/${sessionId}/?role=${role}&token=${encodeURIComponent(access)}`;
}

export function useLiveCameraPublisher(session: InterviewSession | null, stream: MediaStream | null) {
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    const enabled = !!session?.live_camera_enabled && session.status === "in_progress" && !!stream;
    if (!enabled) return;

    let cancelled = false;
    let ws: WebSocket | null = null;

    const cleanupPeer = () => {
      pcRef.current?.close();
      pcRef.current = null;
    };

    const connect = () => {
      ws = new WebSocket(wsUrl(session!.id, "publish"));

      ws.onmessage = async (evt) => {
        if (cancelled || !ws) return;
        const msg = JSON.parse(evt.data);

        if (msg.type === "view-left") {
          cleanupPeer();
          return;
        }

        if (msg.type === "answer" && pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          return;
        }

        if (msg.type === "ice-candidate" && pcRef.current && msg.candidate) {
          try {
            await pcRef.current.addIceCandidate(msg.candidate);
          } catch {
            // benign — a late/duplicate candidate
          }
          return;
        }

        // A viewer connected and is asking for a fresh offer.
        if (msg.type === "viewer-join") {
          cleanupPeer();
          const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
          pcRef.current = pc;
          stream!.getTracks().forEach((track) => pc.addTrack(track, stream!));
          pc.onicecandidate = (e) => {
            if (e.candidate) ws?.send(JSON.stringify({ type: "ice-candidate", candidate: e.candidate }));
          };
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ws.send(JSON.stringify({ type: "offer", sdp: offer }));
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      ws?.close();
      cleanupPeer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.live_camera_enabled, session?.status, stream]);
}
