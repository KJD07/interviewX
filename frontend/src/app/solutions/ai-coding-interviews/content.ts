export const PATH = "/solutions/ai-coding-interviews";

export const TITLE = "AI Coding Interviews";

export const DESCRIPTION =
  "How EvaluLabs runs coding and system-design rounds inside an AI interview: an in-session editor, several languages, and grading by the interviewer rather than a hidden test runner.";

export const SECTIONS = [
  {
    heading: "How does AI coding assessment work?",
    paragraphs: [
      "When a question is a coding problem, EvaluLabs opens an editor inside the interview. You write in that editor — Monaco, or a plain text area if the editor does not load — and send the code to the AI interviewer. The interviewer can also see check-ins of in-progress code, so it can ask about an approach before you submit.",
      "Supported editor languages are JavaScript, TypeScript, Python, Java, C++, and Go. System-design questions use a written workspace instead of the code editor. The end-of-session rubric still scores communication, technical depth, problem solving, and overall.",
      "EvaluLabs does not run your code against a hidden unit-test suite. Grading is the AI interviewer’s reading of what you wrote and how you explained it.",
    ],
    steps: [
      "The interviewer asks a coding or system-design question from the round’s bank.",
      "You edit in the workspace and can submit, or keep typing while check-ins go to the interviewer.",
      "Follow-up questions stay in the same chat transcript.",
      "When the session ends, the transcript — including the code you sent — is part of what gets scored.",
    ],
  },
  {
    heading: "Where coding rounds show up",
    paragraphs: [
      "Practice interviews use coding prompts when the company or skill round is a coding or system-design round. Enterprise interviews use them when the uploaded bank marks a question that way.",
      "Example: a candidate practising a Python round writes a function in the editor, submits it, and answers a follow-up about edge cases. The score afterwards reflects that exchange. It is an illustration of the flow, not a sample result.",
    ],
  },
];

export const FAQS = [
  {
    question: "Does EvaluLabs automatically run test cases on my code?",
    answer:
      "No. There is no separate code judge. The AI interviewer reads the submission and the conversation, then the end-of-session rubric scores the transcript.",
  },
  {
    question: "Can I talk through a coding answer instead of only typing?",
    answer:
      "Yes. Voice mode still runs during the session. The editor is for the code itself; spoken explanation is transcribed into the same transcript.",
  },
];
