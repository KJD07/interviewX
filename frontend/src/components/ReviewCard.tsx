"use client";
import { useEffect, useState } from "react";
import { reviews, ApiError } from "@/lib/api";

interface ReviewCardProps {
  sessionId: number;
  // Called once we know whether the card will show, so the parent can
  // decide whether to also show the real-interview-report modal.
  onResolved?: (willShow: boolean) => void;
}

const DISMISS_KEY = "ix_review_dismissed_at_count";

// Inline review prompt shown on the results page for paid-plan users,
// once every 10 completed interviews. Dismissing it hides it until the
// next milestone (next multiple of 10); submitting hides it forever
// (enforced both here and server-side via a one-review-per-user constraint).
export default function ReviewCard({ sessionId, onResolved }: ReviewCardProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    reviews
      .promptStatus()
      .then((res) => {
        setCompletedCount(res.completed_count);

        if (!res.show) {
          onResolved?.(false);
          return;
        }

        const dismissedAt = localStorage.getItem(DISMISS_KEY);
        if (dismissedAt === String(res.completed_count)) {
          // Already dismissed at this exact milestone — stay hidden until
          // the next multiple of 10 is reached.
          onResolved?.(false);
          return;
        }

        setVisible(true);
        onResolved?.(true);
      })
      .catch(() => onResolved?.(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible || dismissed) return null;

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(completedCount));
    setDismissed(true);
  }

  async function handleSubmit() {
    if (rating === 0) {
      setError("Pick a star rating first.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await reviews.submit({ rating, comment, session: sessionId });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not submit review.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div
        className="rounded-xl px-6 py-4 text-sm"
        style={{
          background: "var(--surface)",
          border: "0.5px solid var(--border)",
          color: "var(--ink-dim)",
        }}
      >
        Thanks for the feedback.
      </div>
    );
  }

  return (
    <div
      className="rounded-xl px-6 py-5"
      style={{ background: "var(--surface)", border: "0.5px solid var(--border)" }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
            Rate your mock interview experience
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-dim)" }}>
            You've completed {completedCount} interviews — your feedback helps other users.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-sm leading-none"
          style={{ color: "var(--ink-faint)" }}
        >
          ✕
        </button>
      </div>

      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            style={{
              fontSize: 26,
              lineHeight: 1,
              color: n <= (hoverRating || rating) ? "#f59e0b" : "var(--border-mid)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="What stood out? (optional)"
        rows={3}
        className="w-full rounded-lg px-3 py-2 text-sm resize-none"
        style={{
          background: "var(--surface-2)",
          border: "0.5px solid var(--border)",
          color: "var(--ink)",
        }}
      />

      {error && (
        <p className="text-xs mt-2" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={handleDismiss}
          className="text-xs font-medium px-3.5 py-2 rounded-lg"
          style={{ border: "0.5px solid var(--border-mid)", color: "var(--ink-dim)" }}
        >
          Maybe later
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="text-xs font-medium px-4 py-2 rounded-lg"
          style={{
            background: "var(--accent)",
            color: "var(--accent-ink)",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Submitting..." : "Submit review"}
        </button>
      </div>
    </div>
  );
}
