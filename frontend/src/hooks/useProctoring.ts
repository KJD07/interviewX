// src/hooks/useProctoring.ts
// Enterprise-only proctoring: activates a hidden webcam feed for sessions
// started via an org candidate invite (session.is_proctored, set server-side
// from apps.enterprise.OrgCandidateInvite — see InterviewSessionSerializer)
// and records a short clip only around flagged moments, never continuously.
// A no-op for every consumer interview.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { interviews, InterviewSession, ProctoringEventType } from "@/lib/api";

const RECORD_MS = 10_000;
const FACE_CHECK_INTERVAL_MS = 2000;
const FACE_CONFIRM_STREAK = 3; // require 3 consecutive same-count checks before flagging
const DEVTOOLS_CHECK_INTERVAL_MS = 2000;
const DEVTOOLS_THRESHOLD_PX = 160;

export function useProctoring(session: InterviewSession | null) {
  const enabled = !!session?.is_proctored && session.status === "in_progress";

  const [consentNeeded, setConsentNeeded] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isRecordingRef = useRef(false);
  const faceStreakRef = useRef({ count: -1, streak: 0 });
  const modelsLoadedRef = useRef(false);

  useEffect(() => {
    if (enabled && !consentGiven) setConsentNeeded(true);
  }, [enabled, consentGiven]);

  // Reports one flagged moment. If a live camera stream is available and
  // nothing is already recording, captures a short clip around the moment;
  // otherwise (camera denied/unsupported, or a recording already in
  // flight) just logs the event with no clip — never overlaps recordings.
  const report = useCallback(
    (event_type: ProctoringEventType, opts?: { confidence?: number; note?: string }) => {
      if (!session) return;
      const stream = streamRef.current;
      if (!stream || isRecordingRef.current || typeof MediaRecorder === "undefined") {
        interviews.reportProctoringEvent(session.id, event_type, opts).catch(() => {});
        return;
      }
      try {
        const chunks: BlobPart[] = [];
        const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {
          isRecordingRef.current = false;
          const blob = new Blob(chunks, { type: "video/webm" });
          interviews.reportProctoringEvent(session.id, event_type, { ...opts, clip: blob }).catch(() => {});
        };
        isRecordingRef.current = true;
        recorder.start();
        window.setTimeout(() => {
          if (recorder.state !== "inactive") recorder.stop();
        }, RECORD_MS);
      } catch {
        isRecordingRef.current = false;
        interviews.reportProctoringEvent(session.id, event_type, opts).catch(() => {});
      }
    },
    [session]
  );

  // Camera access — only after explicit consent. A denied/unsupported
  // camera degrades gracefully: one log entry, interview proceeds as normal.
  useEffect(() => {
    if (!enabled || !consentGiven) return;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        await video.play().catch(() => {});
        videoRef.current = video;
      } catch {
        report("other", { note: "camera_unavailable" });
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      videoRef.current = null;
    };
  }, [enabled, consentGiven, report]);

  // No-face / multiple-faces detection via face-api's tiny face detector,
  // polled against the hidden video element. Requires FACE_CONFIRM_STREAK
  // consecutive checks at the same face count before flagging, so a single
  // bad frame (blink, momentary occlusion) doesn't fire a false positive.
  useEffect(() => {
    if (!enabled || !consentGiven) return;
    let cancelled = false;
    let intervalId: number | undefined;

    (async () => {
      const faceapi = await import("@vladmandic/face-api");
      if (!modelsLoadedRef.current) {
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        modelsLoadedRef.current = true;
      }
      if (cancelled) return;

      intervalId = window.setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;
        try {
          const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());
          const count = detections.length;
          const streak = faceStreakRef.current;
          if (count === streak.count) {
            streak.streak += 1;
          } else {
            streak.count = count;
            streak.streak = 1;
          }
          if (streak.streak === FACE_CONFIRM_STREAK) {
            if (count === 0) report("no_face", { confidence: 0.8 });
            else if (count > 1) report("multiple_faces", { confidence: 0.8 });
          }
        } catch {
          // transient detection failure — next tick retries
        }
      }, FACE_CHECK_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [enabled, consentGiven, report]);

  // Tab switch / minimized window. Independent of the existing
  // fullscreen-exit grace-period warning elsewhere on the interview page —
  // this only logs for org-proctored sessions and doesn't touch that UX.
  useEffect(() => {
    if (!enabled || !consentGiven) return;
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") report("tab_switch");
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [enabled, consentGiven, report]);

  // Pasting into the page (most likely an answer field) mid-interview.
  useEffect(() => {
    if (!enabled || !consentGiven) return;
    const handlePaste = () => report("other", { note: "paste" });
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [enabled, consentGiven, report]);

  // Devtools-open heuristic: a large, sustained gap between outer and inner
  // window dimensions (docked devtools panel). Not foolproof, but catches
  // the common case without any extra permissions.
  useEffect(() => {
    if (!enabled || !consentGiven) return;
    let wasOpen = false;
    const check = () => {
      const isOpen =
        window.outerWidth - window.innerWidth > DEVTOOLS_THRESHOLD_PX ||
        window.outerHeight - window.innerHeight > DEVTOOLS_THRESHOLD_PX;
      if (isOpen && !wasOpen) report("other", { note: "devtools" });
      wasOpen = isOpen;
    };
    const intervalId = window.setInterval(check, DEVTOOLS_CHECK_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [enabled, consentGiven, report]);

  return {
    // True only while an org-proctored session is waiting on the
    // candidate's explicit go-ahead to turn the camera on.
    consentNeeded: consentNeeded && !consentGiven,
    acceptConsent: () => {
      setConsentGiven(true);
      setConsentNeeded(false);
    },
    // Declining just means proctoring never activates for this candidate —
    // same as a denied browser permission prompt, the interview itself
    // proceeds unaffected.
    declineConsent: () => setConsentNeeded(false),
  };
}
