import { ATS_FREE_DAILY_LIMIT, ATS_UNLIMITED_LABEL, PLANS } from "@/lib/plans";

/** Visible homepage FAQ copy. JSON-LD on the server page must use this same list. */
export const HOME_FAQS = [
  {
    question: "What is EvaluLabs?",
    answer:
      "EvaluLabs is a free candidate portal for job seekers. It builds your profile from your resume, shows live jobs ranked by how well they match you, checks your resume against any job like an applicant tracking system (ATS), helps you apply and track applications, and lets you practise with role-specific questions and full AI mock interviews. Hiring teams use EvaluLabs Enterprise to screen candidates.",
  },
  {
    question: "Is EvaluLabs free?",
    answer: `Yes. Everything for candidates is free, with no card needed: live jobs, the application tracker, role practice, ${PLANS.max.monthlyLimit} AI mock interviews a month with full scoring and insights, and ${ATS_FREE_DAILY_LIMIT} ATS resume checks a day. The only paid option is ${ATS_UNLIMITED_LABEL} at ₹${PLANS.pro.priceRupees} a month, which removes the daily ATS check limit.`,
  },
  {
    question: "Where do the jobs on EvaluLabs come from?",
    answer:
      "Jobs come straight from more than 1,100 companies' own public career boards (Greenhouse, Lever, Ashby, SmartRecruiters, Workday, Keka and Freshteam), plus two remote-job feeds. The list refreshes every few hours, closed roles disappear, and postings older than 60 days are removed. Roles in India or open to India are shown first, with a Worldwide option.",
  },
  {
    question: "How does the EvaluLabs ATS resume check work?",
    answer:
      "Pick a job and upload, paste or reuse your profile resume. EvaluLabs scores it against the posting on skills and keywords, experience, job title, education and resume structure, then lists which keywords you match, which are only implied, which are missing, and what to add. Requirements count more than nice-to-haves.",
  },
  {
    question: "Can EvaluLabs apply to jobs for me?",
    answer:
      "No. Applications are submitted on the company's own site. The apply kit puts your details next to the form as copy-ready fields (and can float on top of the page while you fill it in), then records the application in your tracker so you can follow its status.",
  },
  {
    question: "Where do EvaluLabs interview questions come from?",
    answer:
      "Company questions are contributed by people who work at the company or interviewed there recently. Every contributor is verified with a company email address or an offer letter before their questions enter the bank, so nothing in it is scraped or invented. Role practice adds skill-based tracks and HR questions for each job you track.",
  },
  {
    question: "How does EvaluLabs score an interview?",
    answer:
      "Each AI mock interview is graded against an anchored 0–10 rubric across communication, technical depth, problem solving and an overall score, with written feedback and topic-level insights. The rubric is deliberately strict: vague or blank answers score low, so the number is a signal you can actually track over time.",
  },
  {
    question: "Can I practise by speaking instead of typing?",
    answer:
      "Yes. Voice mode lets you answer out loud. EvaluLabs transcribes what you say in real time and the interviewer responds conversationally, which is closer to a real panel than typing answers.",
  },
  {
    question: "Does EvaluLabs work for colleges and companies?",
    answer:
      "Yes. Colleges can sponsor a plan for everyone on their email domain. Hiring teams use EvaluLabs Enterprise to invite candidates, run structured AI interviews from their own question bank, and review scored reports, with optional camera proctoring. Visit evalulabs.com/enterprise to learn more.",
  },
  {
    question: "Is EvaluLabs related to Evalulab, the cosmetics testing lab?",
    answer:
      "No. EvaluLabs (evalulabs.com) is a candidate portal and AI interview platform. Evalulab is a separate, unrelated clinical testing company in Montreal.",
  },
];
