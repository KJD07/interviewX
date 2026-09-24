export const PATH = "/solutions/interview-proctoring";

export const TITLE = "Interview Proctoring";

export const DESCRIPTION =
  "Camera proctoring on EvaluLabs enterprise invites: required camera, face and phone checks, tab switches, paste detection, short violation clips, and live viewing for the hiring team.";

export const SECTIONS = [
  {
    heading: "How does interview proctoring work?",
    paragraphs: [
      "Proctoring applies to enterprise interview invites, not to ordinary practice sessions. The candidate must allow the camera. If access is denied, or the camera stays disconnected past a grace period, the interview is blocked.",
      "During the session EvaluLabs watches for a missing face, more than one face, a phone in the frame, and tab or window visibility changes. Paste events and a devtools-dock size heuristic are logged as suspicious activity. Each violation can store a short clip of about 15 seconds. A cap on violations ends the session automatically. The organization can also watch a live camera feed while the candidate is in the round.",
      "Gaze-away detection and low-light detection are not active violation types.",
    ],
    steps: [
      "The hiring team sends an enterprise invite with proctoring enabled.",
      "The candidate joins and grants camera access before the interview continues.",
      "Violations are recorded against that session, with a short clip where the check produces one.",
      "Reviewers see the flags on the hiring workspace, and can open the live camera view during the round.",
    ],
  },
  {
    heading: "What proctoring is not",
    paragraphs: [
      "It does not replace the score. Communication, technical depth, problem solving, and overall still come from the transcript rubric. Proctoring is a separate integrity layer on the enterprise invite.",
      "Example: a campus drive sends proctored links. A candidate who switches tabs is flagged, a short clip is stored, and the reviewer can watch the camera live. The score report is still the rubric on what was said and submitted.",
    ],
  },
];

export const FAQS = [
  {
    question: "Is proctoring on for practice interviews?",
    answer:
      "No. Camera proctoring runs on enterprise invites. Practising on a company or skill round does not turn those checks on.",
  },
  {
    question: "What does the hiring team see?",
    answer:
      "Violation flags, short clips of about 15 seconds, and a live camera view while the candidate is in the round. The scored report is still produced from the interview transcript.",
  },
];
