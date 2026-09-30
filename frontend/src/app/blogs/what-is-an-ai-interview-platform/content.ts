export const PATH = "/blogs/what-is-an-ai-interview-platform";

export const TITLE = "What Is an AI Interview Platform?";

export const DESCRIPTION =
  "An AI interview platform runs a timed interview in software: a question bank, follow-ups, and a written score. EvaluLabs uses that loop for candidate practice and for hiring-team screening.";

export const SECTIONS = [
  {
    heading: "What is an AI interview platform?",
    paragraphs: [
      "An AI interview platform runs interview rounds in software, so a human panel is not required for every first conversation. On EvaluLabs that means a timed session: the interviewer asks from a question bank, follows up, and produces a written score at the end.",
      "Candidates use it to practise. Hiring teams use the same loop for screening, with their own questions and invite links. Coding and system-design prompts open an editor inside the session; the AI grades what you submit. It does not run a hidden unit-test suite.",
    ],
  },
  {
    heading: "What is an AI interviewer?",
    paragraphs: [
      "The AI interviewer is the model that asks the questions, follows up, and keeps pressure on during the session. When a company tone is configured, it uses that tone — formal, casual, or aggressive — instead of a single generic voice.",
      "In voice mode it transcribes what you say and replies in the conversation. At the end it grades the transcript against a fixed 0–10 rubric. Blank or “I don’t know” answers are scored low on purpose.",
    ],
  },
  {
    heading: "Who is EvaluLabs for?",
    paragraphs: [
      "EvaluLabs is for candidates preparing for interviews and for hiring teams or colleges that want a structured first round. Individuals practise against company and skill banks. Organizations screen with enterprise invites.",
      "Example: a candidate rehearsing a technical round picks a company, answers out loud, and leaves with rubric scores. A hiring manager uploads a question file, sends invite links, and reads the same kind of score report. Those are product flows, not measured outcomes.",
    ],
  },
];

export const FAQS: { question: string; answer: string }[] = [];
