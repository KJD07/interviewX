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
export default function InviteStartPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (authLoading || !user || starting) return;
    setStarting(true);
    organizations.invites
      .start(params.token)
      .then((res) => router.replace(`/interview/${res.session_id}`))
      .catch((err) => {
        setError(err instanceof ApiError ? err.detail : "Could not start this interview.");
        setStarting(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--page)" }}>
        <div className="text-center max-w-md">
          {error ? (
            <p style={{ color: "var(--danger)" }}>{error}</p>
          ) : (
            <p style={{ color: "var(--ink-dim)" }}>Starting your interview…</p>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
