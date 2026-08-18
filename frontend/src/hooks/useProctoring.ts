// src/hooks/useProctoring.ts
// Enterprise-only proctoring: activates a hidden webcam feed for sessions
// started via an org candidate invite (session.is_proctored, set server-side
// from apps.enterprise.OrgCandidateInvite — see InterviewSessionSerializer)
// and records a short clip only around flagged moments, never continuously.
// A no-op for every consumer interview.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { interviews, InterviewSession, ProctoringEventType } from "@/lib/api";

const RECORD_MS = 15_000; // 15s clip captured from the moment a violation is flagged
const FACE_CHECK_INTERVAL_MS = 2000;
const FACE_CONFIRM_STREAK = 3; // require 3 consecutive same-count checks before flagging
const DEVTOOLS_CHECK_INTERVAL_MS = 2000;
const DEVTOOLS_THRESHOLD_PX = 160;
const PHONE_CHECK_INTERVAL_MS = 2000;
const PHONE_CONFIDENCE_THRESHOLD = 0.6;
const PHONE_CONFIRM_STREAK = 2; // require 2 consecutive positive checks before flagging
const PHONE_REFLAG_COOLDOWN_MS = 15_000; // don't re-flag the same held-up phone every 2s
const MAX_VIOLATIONS = 5; // interview auto-ends once this many violations are flagged
const WARNING_DISPLAY_MS = 5000;
const DISCONNECT_GRACE_SECONDS = 10; // time to reconnect the camera before auto-end
const RECONNECT_POLL_MS = 1500;

const VIOLATION_WARNING_TEXT: Partial<Record<ProctoringEventType, string>> = {
  no_face: "No face detected — please stay visible on camera.",
  multiple_faces: "Multiple people detected in frame.",
  gaze_away: "Please keep your eyes on the screen.",
  tab_switch: "Tab switch / window change detected.",
  low_light: "Camera view is obscured or too dark.",
  phone_detected: "A phone or device was detected on camera.",
  other: "Suspicious activity detected.",
};

export function useProctoring(session: InterviewSession | null) {
  const enabled = !!session?.is_proctored && session.status === "in_progress";

  const [consentNeeded, setConsentNeeded] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [violationCount, setViolationCount] = useState(0);
  // Camera access is mandatory for a proctored interview — set when the
  // candidate declines consent, when getUserMedia fails (denied/no
  // device/unsupported browser), or when the camera disconnects mid-
  // interview and doesn't reconnect within the grace period. The caller
  // should end the interview when this becomes true; there's no
  // "continue without camera" path. `blockedReason` carries a
  // caller-facing explanation of which of those happened.
  const [blocked, setBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState("");
  // Seconds left to reconnect the camera after a mid-interview disconnect,
  // or null when no disconnect grace period is active.
  const [disconnectSecondsLeft, setDisconnectSecondsLeft] = useState<number | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isRecordingRef = useRef(false);
  const faceStreakRef = useRef({ count: -1, streak: 0 });
  const modelsLoadedRef = useRef(false);
  const phoneModelRef = useRef<import("@tensorflow-models/coco-ssd").ObjectDetection | null>(null);
  const phoneStreakRef = useRef(0);
  const lastPhoneFlagRef = useRef(0);
  const violationCountRef = useRef(0);
  const limitReachedRef = useRef(false);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const disconnectActiveRef = useRef(false);
  const disconnectCountdownRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const reconnectPollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const blockInterview = useCallback((reason: string) => {
    setBlockedReason(reason);
    setBlocked(true);
  }, []);

  useEffect(() => {
    if (enabled && !consentGiven) setConsentNeeded(true);
  }, [enabled, consentGiven]);

  // Reports one flagged moment. If a live camera stream is available and
  // nothing is already recording, captures a short clip around the moment;
  // otherwise (camera denied/unsupported, or a recording already in
  // flight) just logs the event with no clip — never overlaps recordings.
  const report = useCallback(
    (event_type: ProctoringEventType, opts?: { confidence?: number; note?: string; silent?: boolean }) => {
      if (!session) return;

      // Silent events (e.g. camera permission denied) are logged but don't
      // count as a cheating violation and don't surface a warning.
      if (!opts?.silent && !limitReachedRef.current) {
        violationCountRef.current += 1;
        setViolationCount(violationCountRef.current);

        setWarning(VIOLATION_WARNING_TEXT[event_type] ?? "Suspicious activity detected.");
        if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = setTimeout(() => setWarning(null), WARNING_DISPLAY_MS);

        if (violationCountRef.current >= MAX_VIOLATIONS) {
          limitReachedRef.current = true;
        }
      }

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

  // Camera access — only after explicit consent. Required for a proctored
  // interview: a denied/unsupported camera logs one event and sets
  // `blocked`, which the caller uses to end the interview.
  //
  // Also handles a mid-interview disconnect (camera unplugged, OS revokes
  // permission, device sleeps, etc.): each track fires "ended" when that
  // happens. That's treated as one flagged violation (counts toward the
  // 5-violation limit) plus a DISCONNECT_GRACE_SECONDS window to plug the
  // camera back in — polling for a fresh stream every RECONNECT_POLL_MS —
  // before falling back to ending the interview like any other blocked
  // state.
  useEffect(() => {
    if (!enabled || !consentGiven) return;
    let cancelled = false;

    const clearDisconnectTimers = () => {
      if (disconnectCountdownRef.current) clearInterval(disconnectCountdownRef.current);
      if (reconnectPollRef.current) clearInterval(reconnectPollRef.current);
      disconnectCountdownRef.current = undefined;
      reconnectPollRef.current = undefined;
      disconnectActiveRef.current = false;
      setDisconnectSecondsLeft(null);
    };

    const attachStream = (stream: MediaStream) => {
      streamRef.current = stream;
      stream.getVideoTracks().forEach((track) => {
        track.onended = handleDisconnect;
      });
      const video = videoRef.current ?? document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      videoRef.current = video;
      return video.play().catch(() => {});
    };

    function handleDisconnect() {
      if (cancelled || disconnectActiveRef.current) return;
      disconnectActiveRef.current = true;
      streamRef.current = null;

      // No live stream left to pull a clip from — logged without one.
      report("other", { note: "camera_disconnected" });

      let secondsLeft = DISCONNECT_GRACE_SECONDS;
      setDisconnectSecondsLeft(secondsLeft);
      disconnectCountdownRef.current = setInterval(() => {
        secondsLeft -= 1;
        setDisconnectSecondsLeft(Math.max(secondsLeft, 0));
      }, 1000);

      reconnectPollRef.current = setInterval(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          clearDisconnectTimers();
          await attachStream(stream);
        } catch {
          // still disconnected — next poll retries
        }
      }, RECONNECT_POLL_MS);

      setTimeout(() => {
        if (cancelled || !disconnectActiveRef.current) return;
        clearDisconnectTimers();
        blockInterview("Your camera disconnected and didn't reconnect in time.");
      }, DISCONNECT_GRACE_SECONDS * 1000);
    }

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        await attachStream(stream);
      } catch {
        // Camera access is required for a proctored interview — a
        // denied/unsupported camera can't be logged as a clip-bearing
        // violation (there's no stream to record from), but it must still
        // block the interview rather than silently continuing without it.
        report("other", { note: "camera_unavailable", silent: true });
        if (!cancelled) blockInterview("Camera access could not be verified.");
      }
    })();

    return () => {
      cancelled = true;
      clearDisconnectTimers();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      videoRef.current = null;
    };
  }, [enabled, consentGiven, report, blockInterview]);

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

  // Phone/device-in-frame detection via TensorFlow.js's coco-ssd object
  // detector, polled against the same hidden video element as face
  // detection. Requires PHONE_CONFIRM_STREAK consecutive positive checks
  // before flagging (a phone glimpsed for one frame while, say, adjusting a
  // desk item shouldn't trigger), and a cooldown after flagging so a phone
  // left in view doesn't spam a new violation/clip every 2s.
  useEffect(() => {
    if (!enabled || !consentGiven) return;
    let cancelled = false;
    let intervalId: number | undefined;

    (async () => {
      const [tf, coco] = await Promise.all([import("@tensorflow/tfjs"), import("@tensorflow-models/coco-ssd")]);
      await tf.ready();
      if (!phoneModelRef.current) {
        phoneModelRef.current = await coco.load({ base: "lite_mobilenet_v2" });
      }
      if (cancelled) return;

      intervalId = window.setInterval(async () => {
        const video = videoRef.current;
        const model = phoneModelRef.current;
        if (!video || !model || video.readyState < 2) return;
        try {
          const predictions = await model.detect(video);
          const phoneSeen = predictions.some(
            (p) => p.class === "cell phone" && p.score >= PHONE_CONFIDENCE_THRESHOLD
          );

          if (!phoneSeen) {
            phoneStreakRef.current = 0;
            return;
          }
          phoneStreakRef.current += 1;
          if (phoneStreakRef.current < PHONE_CONFIRM_STREAK) return;

          const now = Date.now();
          if (now - lastPhoneFlagRef.current < PHONE_REFLAG_COOLDOWN_MS) return;
          lastPhoneFlagRef.current = now;
          phoneStreakRef.current = 0;

          const best = predictions
            .filter((p) => p.class === "cell phone")
            .reduce((max, p) => (p.score > max.score ? p : max));
          report("phone_detected", { confidence: best.score });
        } catch {
          // transient detection failure — next tick retries
        }
      }, PHONE_CHECK_INTERVAL_MS);
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

  useEffect(() => {
    return () => {
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, []);

  return {
    // True only while an org-proctored session is waiting on the
    // candidate's explicit go-ahead to turn the camera on.
    consentNeeded: consentNeeded && !consentGiven,
    acceptConsent: () => {
      setConsentGiven(true);
      setConsentNeeded(false);
    },
    // Camera access is mandatory for a proctored interview — declining
    // blocks the interview rather than letting it continue without a
    // camera. The caller is responsible for actually ending the session.
    declineConsent: () => {
      setConsentNeeded(false);
      blockInterview("Camera access was declined.");
    },
    // Non-blocking on-screen notice for the most recent flagged violation;
    // clears itself after WARNING_DISPLAY_MS.
    warning,
    violationCount,
    // Once MAX_VIOLATIONS flagged moments have been recorded, the caller
    // should end the interview automatically.
    limitReached: violationCount >= MAX_VIOLATIONS,
    // True once consent was declined, the camera couldn't be accessed, or
    // it disconnected mid-interview and didn't reconnect in time — the
    // caller should end the interview automatically. blockedReason is a
    // caller-facing explanation of which case happened.
    blocked,
    blockedReason,
    // Non-null while a mid-interview camera disconnect's reconnection grace
    // period is counting down; the caller can surface this as a countdown
    // banner distinct from the (self-dismissing) violation `warning` above.
    disconnectSecondsLeft,
  };
}
