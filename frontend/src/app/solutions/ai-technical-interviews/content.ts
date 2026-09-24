export const PATH = "/solutions/ai-technical-interviews";

export const TITLE = "AI Technical Interviews";

export const DESCRIPTION =
  "How EvaluLabs runs AI technical interviews for practice and for hiring: a session starts, the interviewer chats, and the transcript is scored on a fixed rubric.";

export const SECTIONS = [
  {
    heading: "How does AI technical interviewing work?",
    paragraphs: [
      "An AI technical interview on EvaluLabs is a single session. You, or a candidate you invited, talk with an AI interviewer that asks from a question bank, follows up, and stops when the session ends. The result is a score report, not a live human panel.",
      "Practice sessions use the public company and skill banks, whose questions come from verified employees and recent candidates. Enterprise sessions use the question bank the hiring team uploaded. Nothing is pulled from the public bank unless that team put it there.",
    ],
    steps: [
      "Start: choose a company, role, and round, or open an enterprise invite link. The session is created with a duration between 45 and 60 minutes.",
      "Chat: each answer is appended to the transcript and the interviewer replies. Voice mode transcribes speech. Coding and system-design prompts open a workspace inside the same session.",
      "End: the full transcript is graded on communication, technical depth, problem solving, and an overall score from 0 to 10. Paid practice plans also receive topic-level insights.",
    ],
  },
  {
    heading: "What the score is for",
    paragraphs: [
      "The rubric is strict on purpose. Vague answers and “I don’t know” land in the low end of the scale, so a number can be compared across sessions. It is a screening and practice signal, not a hiring decision by itself.",
      "Example: someone preparing for a backend round picks that role, answers follow-ups out loud, and reads the four scores when the session ends. A recruiter running first rounds sends invite links and reads the same kind of report for each candidate. That is how the product is used, not a measured pass rate.",
    ],
  },
];

export const FAQS = [
  {
    question: "Do technical interviews include coding?",
    answer:
      "Yes, when the round’s question type is coding or system design. Coding opens an in-session editor. System design opens a written workspace. The AI interviewer grades the submission; EvaluLabs does not execute a hidden unit-test suite.",
  },
  {
    question: "Can a company run technical interviews for applicants?",
    answer:
      "Yes. EvaluLabs Enterprise lets a hiring team upload its own questions, invite candidates, and review scored reports. Optional camera proctoring applies to those enterprise invites.",
  },
];
