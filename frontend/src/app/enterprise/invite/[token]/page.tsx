"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { organizations, ApiError } from "@/lib/api";

// Candidate-facing entry point for an org's proctored/real interview invite.
// Starting the session reuses interviews.start()'s exact counterpart on the
// backend (see apps.enterprise.views.OrgInviteStartView) and then hands off
// to the SAME /interview/[sessionId] chat page every consumer session
// uses — nothing about the interview flow itself is different here.
//
// Camera/mic access is probed here, BEFORE organizations.invites.start() is
// ever called — start() is what creates the InterviewSession, marks the
// invite STARTED, and consumes the org's candidate_quota, so a permission
// failure must happen before that call, not after. This keeps a denied/
// unavailable camera from burning the invite: the link stays PENDING and
// usable again later (different device/browser) if access can't be granted
// here.
type Step = "loading" | "ready" | "requesting_media" | "starting" | "error";

export default function InviteStartPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && user && step === "loading") setStep("ready");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const beginInterview = async () => {
    setError("");
    setStep("requesting_media");
    try {
      // Only probing that permission can be granted — this stream isn't
      // kept around. The interview page's own proctoring hook requests its
      // own camera stream once the session actually starts.
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setError(
        "This interview requires camera and microphone access. Please allow both and try again, or reopen this link on a device/browser where you can grant permission — this link stays valid until it expires."
      );
      setStep("error");
      return;
    }

    setStep("starting");
    try {
      const res = await organizations.invites.start(params.token);
      router.replace(`/interview/${res.session_id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not start this interview.");
      setStep("error");
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--page)" }}>
        <div className="w-full max-w-sm text-center">
          {step === "loading" && <p style={{ color: "var(--ink-dim)" }}>Loading…</p>}

          {step === "ready" && (
            <div
              className="rounded-xl p-6 fade-up"
              style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
            >
              <h2 className="font-display text-base font-bold mb-2" style={{ color: "var(--ink)" }}>
                This interview is proctored
              </h2>
              <p className="text-sm mb-6" style={{ color: "var(--ink-dim)" }}>
                As part of this employer&apos;s hiring process, this interview requires camera
                and microphone access. Your camera captures a short clip only around moments
                flagged as unusual (e.g. losing focus, no face visible, another person or a
                phone appearing on camera) — it does not record continuously. If access can&apos;t
                be granted, the interview won&apos;t start and this link stays usable — you can
                try again later or on another device.
              </p>
              <button
                onClick={beginInterview}
                className="w-full py-2.5 rounded-full text-sm font-semibold transition-opacity"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                Grant access & start interview
              </button>
            </div>
          )}

          {(step === "requesting_media" || step === "starting") && (
            <p style={{ color: "var(--ink-dim)" }}>
              {step === "requesting_media"
                ? "Requesting camera & microphone access…"
                : "Starting your interview…"}
            </p>
          )}

          {step === "error" && (
            <div
              className="rounded-xl p-6 fade-up"
              style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
            >
              <p className="text-sm mb-4" style={{ color: "var(--danger)" }}>
                {error}
              </p>
              <button
                onClick={beginInterview}
                className="w-full py-2.5 rounded-full text-sm font-semibold transition-opacity"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
