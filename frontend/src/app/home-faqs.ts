/** Visible homepage FAQ copy. JSON-LD on the server page must use this same list. */
export const HOME_FAQS = [
  {
    question: "Where do EvaluLabs interview questions come from?",
    answer:
      "Questions are contributed by people who work at the company or interviewed there recently. Every contributor is verified with a company email address or an offer letter before their questions enter the bank, so nothing in it is scraped or invented.",
  },
  {
    question: "Is EvaluLabs free?",
    answer:
      "Yes. The free plan includes a monthly allowance of AI mock interviews with scoring and feedback, and needs no card to start. Paid plans add detailed insights, topic-level breakdowns and higher monthly limits.",
  },
  {
    question: "How is EvaluLabs different from other AI interview tools?",
    answer:
      "Most tools generate plausible-sounding questions from a model. EvaluLabs runs sessions from a verified question bank tied to specific companies and roles, and the AI interviewer adopts that company's interviewing tone, so the pressure and the follow-ups match what you will actually face.",
  },
  {
    question: "Can I practise by speaking instead of typing?",
    answer:
      "Yes. Voice mode lets you answer out loud. EvaluLabs transcribes what you say in real time and the interviewer responds conversationally, which is closer to a real panel than typing answers.",
  },
  {
    question: "How does EvaluLabs score an interview?",
    answer:
      "Each session is graded against an anchored 0–10 rubric across communication, technical depth, problem solving and an overall score. The rubric is deliberately strict: vague or blank answers score low, so the number is a signal you can actually track. Paid plans also receive topic-level insights.",
  },
  {
    question: "Does EvaluLabs work for colleges and companies?",
    answer:
      "Yes. Institutional sponsorships grant a full plan to everyone on a given email domain, with a per-cycle interview limit the sponsor sets. Students sign up with their college address and the plan attaches automatically.",
  },
  {
    question: "How can companies hire with EvaluLabs?",
    answer:
      "EvaluLabs Enterprise gives hiring teams a dashboard to invite candidates, run structured AI interviews from your own question bank, and review scored reports in one place. Enterprise invites can require camera proctoring. Visit evalulabs.com/enterprise to learn more.",
  },
  {
    question: "Is EvaluLabs related to Evalulab, the cosmetics testing lab?",
    answer:
      "No. EvaluLabs (evalulabs.com) is an AI interview and candidate assessment platform. Evalulab is a separate, unrelated clinical testing company in Montreal.",
  },
];

/** Direct answers rendered as headings above the accordion. Included in FAQPage JSON-LD. */
export const HOME_AEO = [
  {
    question: "What is EvaluLabs?",
    answer:
      "EvaluLabs is an AI interview and candidate assessment platform. Candidates pick a company or skill and sit a session with an AI interviewer that uses a verified question bank. Hiring teams use the enterprise workspace to invite candidates, run interviews from their own bank, and review rubric scores.",
    detail:
      "A practice session starts when you choose a company, role, and round. The interviewer chats with you — by text or by voice — and the session ends with scores for communication, technical depth, problem solving, and overall.",
  },
  {
    question: "What is an AI interview platform?",
    answer:
      "An AI interview platform runs interview rounds in software, so a human panel is not required for every first conversation. On EvaluLabs that means a timed session: the interviewer asks from a question bank, follows up, and produces a written score at the end.",
    detail:
      "Candidates use it to practise. Hiring teams use the same loop for screening, with their own questions and invite links. Coding and system-design prompts open an editor inside the session; the AI grades what you submit. It does not run a hidden unit-test suite.",
  },
  {
    question: "What is an AI interviewer?",
    answer:
      "The AI interviewer is the model that asks the questions, follows up, and keeps pressure on during the session. When a company tone is configured, it uses that tone — formal, casual, or aggressive — instead of a single generic voice.",
    detail:
      "In voice mode it transcribes what you say and replies in the conversation. At the end it grades the transcript against a fixed 0–10 rubric. Blank or “I don’t know” answers are scored low on purpose.",
  },
  {
    question: "Who is EvaluLabs for?",
    answer:
      "EvaluLabs is for candidates preparing for interviews and for hiring teams or colleges that want a structured first round. Individuals practise against company and skill banks. Organizations screen with enterprise invites.",
    detail:
      "Example: a candidate rehearsing a technical round picks a company, answers out loud, and leaves with rubric scores. A hiring manager uploads a question file, sends invite links, and reads the same kind of score report. Those are product flows, not measured outcomes.",
  },
];
