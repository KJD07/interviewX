// Opts out of the root page-transition template. The interview page has a
// fullscreen proctoring overlay and Monaco panes that rely on `position:
// fixed` — a transform on an ancestor (as the root template applies) breaks
// fixed positioning for descendants, so this route gets no wrapper motion.
export default function InterviewTemplate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
