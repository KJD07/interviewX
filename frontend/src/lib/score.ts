export type ScoreTone = "good" | "mid" | "low" | "none";

/** The >=7 good / >=5 mid / else low ternary, previously re-implemented
 *  8x across dashboard/progress/results with two different greens and
 *  two different ambers for the same meaning. This is the one place. */
export const scoreTone = (v?: number | null): ScoreTone =>
  v === undefined || v === null ? "none" : v >= 7 ? "good" : v >= 5 ? "mid" : "low";

export const SCORE_TEXT: Record<ScoreTone, string> = {
  good: "text-success",
  mid: "text-warn",
  low: "text-danger",
  none: "text-ink-faint",
};

export const SCORE_BG: Record<ScoreTone, string> = {
  good: "bg-success/10",
  mid: "bg-warn/12",
  low: "bg-danger/10",
  none: "bg-surface-2",
};

export const SCORE_BAR: Record<ScoreTone, string> = {
  good: "bg-success",
  mid: "bg-warn",
  low: "bg-danger",
  none: "bg-ink-faint",
};
