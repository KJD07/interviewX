"""
Static question library for role-based practice (careers/role_practice.py).

Fills the gaps the question bank (company rows + the curated skill bank in
apps/companies/skill_bank.py) leaves: role-fit questions every candidate is
asked, extra coding problems, and questions for non-engineering roles
(product, design, sales, marketing, HR, finance, operations, QA) that have no
skill track. Pure local data: serving and scoring these costs nothing.

Each entry's `key` is its stable public id ("lib:<key>"); never rename one.
"""

from __future__ import annotations


def Q(key, question, answer, kind="other"):
    return {"key": key, "question_type": kind, "question_text": question, "ideal_answer": answer}


def Code(key, question, answer, language, starter=""):
    return {"key": key, "question_type": "coding", "question_text": question, "ideal_answer": answer,
            "language": language, "starter_code": starter}


def Behavioral(key, question, answer):
    return Q(key, question, answer, "behavioral")


def Design(key, question, answer):
    return Q(key, question, answer, "system_design")


# Asked in almost every interview, whatever the role.
ROLE_FIT = [
    Behavioral("fit-why-role", "Why are you a good fit for this role?",
               "Map the job's top requirements to your evidence: name two or three skills the posting asks for and "
               "back each with a specific project or result with numbers. Mention what you would learn quickly, and "
               "close with why the role matches your goals. Stay specific to this job, not generic."),
    Behavioral("fit-first-90", "What would you focus on in your first 90 days?",
               "First 30 days: learn the product, codebase or processes, the team and its goals, and meet "
               "stakeholders. Days 30-60: take ownership of a small, real deliverable and ship it. Days 60-90: "
               "drive a larger piece of work, suggest one improvement backed by what you observed, and agree on "
               "success metrics with your manager."),
    Behavioral("fit-deadline", "Tell me about a time you had to deliver under a tight deadline.",
               "STAR: the situation and deadline, how you prioritised scope (must-have versus nice-to-have), "
               "communicated risk early to stakeholders, broke work into steps and maybe asked for help, the result "
               "delivered on time with measurable impact, and what you learned about planning."),
    Behavioral("fit-questions", "Do you have any questions for us?",
               "Always ask two or three thoughtful questions: what success looks like in the first six months, the "
               "team's biggest current challenge, how work is planned and reviewed, growth and learning "
               "opportunities. Avoid asking only about salary or leave; show curiosity about the work."),
]

# Extra coding problems for engineering roles (the DSA skill track has more).
ENGINEERING_CODING = [
    Code("code-valid-parentheses",
         "Given a string containing only ()[]{} characters, return whether the brackets are valid (every opener is "
         "closed by the same type, in the correct order).",
         "Use a stack: push each opening bracket; for a closing bracket, the stack must be non-empty and its top must "
         "be the matching opener, so pop it, else return false. At the end the stack must be empty. O(n) time, O(n) "
         "space.",
         "python", "def is_valid(s: str) -> bool:\n    pass\n"),
    Code("code-merge-intervals",
         "Given a list of intervals [start, end], merge all overlapping intervals and return the result.",
         "Sort the intervals by start. Walk through them keeping a merged list: if the current interval's start is "
         "less than or equal to the last merged end, extend that end to max(end, current end); otherwise append the "
         "interval. Sorting dominates: O(n log n) time.",
         "python", "def merge(intervals: list[list[int]]) -> list[list[int]]:\n    pass\n"),
    Code("code-reverse-linked-list",
         "Reverse a singly linked list and return the new head.",
         "Iterate with three pointers: prev = None, curr = head. In a loop, save next = curr.next, point curr.next "
         "to prev, then advance prev = curr and curr = next. Return prev. O(n) time and O(1) space; a recursive "
         "version uses O(n) stack.",
         "python",
         "class ListNode:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        self.next = next\n\n"
         "def reverse_list(head: ListNode | None) -> ListNode | None:\n    pass\n"),
    Code("code-top-k-frequent",
         "Given an integer array and k, return the k most frequent elements.",
         "Count frequencies with a hash map (Counter). Then either keep a min-heap of size k over (count, value) "
         "pairs for O(n log k), or bucket sort: bucket index = frequency, scan buckets from high to low until k "
         "elements are collected, O(n) time.",
         "python", "def top_k_frequent(nums: list[int], k: int) -> list[int]:\n    pass\n"),
    Code("code-binary-search",
         "Given a sorted array and a target, return the target's index or -1, in O(log n) time.",
         "Binary search: low = 0, high = n - 1; while low <= high compute mid = low + (high - low) // 2; if "
         "nums[mid] equals target return mid, if it is smaller move low = mid + 1, else high = mid - 1. Return -1. "
         "O(log n) time, O(1) space; avoid overflow and off-by-one errors.",
         "python", "def search(nums: list[int], target: int) -> int:\n    pass\n"),
    Code("code-lru-cache",
         "Design an LRU cache with get(key) and put(key, value), both O(1), evicting the least recently used key "
         "when capacity is exceeded.",
         "Combine a hash map from key to node with a doubly linked list ordered by recency. get moves the node to "
         "the front (most recent) and returns its value. put updates or inserts at the front, and when size exceeds "
         "capacity removes the tail node and deletes its key from the map. In Python, OrderedDict with "
         "move_to_end and popitem(last=False) does the same.",
         "python",
         "class LRUCache:\n    def __init__(self, capacity: int):\n        pass\n\n    def get(self, key: int) -> int:\n"
         "        pass\n\n    def put(self, key: int, value: int) -> None:\n        pass\n"),
]

SQL_CODING = [
    Code("sql-second-highest-salary",
         "Write a SQL query to find the second highest distinct salary from an employees(id, name, salary) table, "
         "returning NULL if there is none.",
         "SELECT MAX(salary) FROM employees WHERE salary < (SELECT MAX(salary) FROM employees). Alternatives: "
         "SELECT DISTINCT salary ORDER BY salary DESC LIMIT 1 OFFSET 1 wrapped in a subquery so it returns NULL, or "
         "DENSE_RANK() OVER (ORDER BY salary DESC) and filter rank = 2.",
         "sql", "-- employees(id, name, salary)\nSELECT\n"),
    Code("sql-top-customers",
         "Given orders(id, customer_id, amount, created_at), return the top 5 customers by total spend in the last "
         "30 days.",
         "SELECT customer_id, SUM(amount) AS total FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' "
         "GROUP BY customer_id ORDER BY total DESC LIMIT 5. Filter with WHERE before grouping; use HAVING only for "
         "conditions on the aggregate.",
         "sql", "-- orders(id, customer_id, amount, created_at)\nSELECT\n"),
]

# Role families without a skill track get their own questions.
FAMILY_QUESTIONS = {
    "product": [
        Q("pm-prioritise", "How do you prioritise features on a roadmap?",
          "Start from the product goal and metrics. Gather inputs from users, data, sales and engineering. Score "
          "options with a framework such as RICE (reach, impact, confidence, effort) or value versus effort, weigh "
          "strategic bets and dependencies, then communicate the trade-offs and what you are not doing and why."),
        Q("pm-metric-drop", "A key metric (say daily active users) dropped 15% last week. How do you investigate?",
          "Clarify the metric definition and confirm the data is correct (tracking or logging bugs). Segment the "
          "drop by platform, region, app version, user cohort and acquisition channel. Check internal changes "
          "(releases, experiments, outages) and external factors (seasonality, competitors). Form hypotheses, "
          "validate with data, then fix and monitor."),
        Q("pm-improve-product", "Pick a product you use daily. How would you improve it?",
          "Define the product and its users, pick one user segment and their pain point, explain why it matters, "
          "brainstorm solutions, prioritise one with reasoning, describe how you would build an MVP and measure "
          "success with clear metrics, and mention risks and trade-offs."),
        Q("pm-success-metrics", "How would you define success metrics for a new feature?",
          "Tie metrics to the feature's goal: a primary north-star or success metric (adoption, conversion, "
          "retention), supporting metrics, and guardrail metrics that must not get worse (latency, churn, "
          "support tickets). Set baselines and targets and validate with an A/B test where possible."),
    ],
    "design": [
        Q("ux-process", "Walk me through your design process.",
          "Understand the problem and users through research and interviews, define the problem and success "
          "criteria, explore ideas with sketches and wireframes, prototype, run usability testing, iterate on "
          "feedback, hand off to engineering with a design system and specs, and measure impact after launch."),
        Q("ux-feedback", "How do you handle feedback from stakeholders you disagree with?",
          "Listen to understand the underlying goal, ask why, bring user research and data rather than opinion, "
          "propose options or a quick test (prototype or A/B test), and agree on criteria. Stay collaborative and "
          "focused on user outcomes."),
        Q("ux-accessibility", "How do you make a design accessible?",
          "Follow WCAG: sufficient colour contrast, not relying on colour alone, readable type sizes, clear focus "
          "states and keyboard navigation, labels for forms and alt text for images, adequate touch targets, and "
          "testing with screen readers and real users."),
        Q("ux-portfolio", "Present a portfolio project and the impact it had.",
          "State the problem and constraints, your role, research insights, key design decisions and the "
          "alternatives you rejected, how you validated with users, and the measurable outcome (conversion, task "
          "time, satisfaction). Be honest about trade-offs."),
    ],
    "sales": [
        Q("sales-sell-pen", "Sell me this pen.",
          "Do not start with features. Ask questions to discover the buyer's needs (when they write, what matters "
          "to them), then position the pen's benefits against those needs, handle objections, create urgency and "
          "close by asking for the sale."),
        Q("sales-objection", "How do you handle a prospect who says your product is too expensive?",
          "Acknowledge the concern, ask questions to understand the real objection and budget, reframe price as "
          "value and return on investment with numbers or a case study, compare total cost to alternatives, "
          "offer options (tiers, phased rollout), and confirm next steps."),
        Q("sales-pipeline", "How do you build and manage your sales pipeline?",
          "Define the ideal customer profile, generate leads through prospecting, referrals and inbound, qualify "
          "with BANT or MEDDIC, track every stage in a CRM, follow up consistently, forecast from conversion "
          "rates, and focus time on deals most likely to close."),
        Q("sales-target-missed", "Tell me about a quarter you missed your target. What did you do?",
          "Own it, analyse why with data (pipeline coverage, conversion, deal size), describe the actions you "
          "took (more prospecting, better qualification, coaching), and the result in the next quarter."),
    ],
    "marketing": [
        Q("mkt-campaign", "Walk me through a marketing campaign you ran and its results.",
          "Goal and target audience, the channels chosen and why, budget, messaging and creative, how you measured "
          "it (CTR, conversion, CAC, ROI), the results with numbers, and what you learned or optimised through "
          "A/B testing."),
        Q("mkt-launch", "How would you plan the launch of a new product?",
          "Research the target audience and positioning, set goals and KPIs, plan pre-launch (teasers, waitlist), "
          "launch across owned, earned and paid channels, coordinate with sales and product, then measure and "
          "iterate after launch."),
        Q("mkt-metrics", "Which metrics matter most for digital marketing, and why?",
          "Depends on the funnel stage: reach and impressions for awareness, CTR and engagement for interest, "
          "conversion rate and cost per acquisition for conversion, plus customer lifetime value, retention and "
          "ROI or ROAS overall. Track them against a goal, not in isolation."),
        Q("mkt-seo", "How would you improve organic traffic for a website?",
          "Keyword research around user intent, high-quality content that answers those queries, on-page SEO "
          "(titles, meta descriptions, headings, internal links), technical SEO (speed, mobile, crawlability, "
          "sitemaps), backlinks from relevant sites, and tracking rankings and conversions in analytics."),
    ],
    "hr": [
        Q("hr-hiring-process", "How would you design a hiring process for a new role?",
          "Work with the hiring manager to define the role and must-have skills, write an inclusive job "
          "description, source candidates through multiple channels, screen consistently, use structured "
          "interviews with a scoring rubric, give candidates a good experience and timely feedback, and track "
          "time-to-hire and quality of hire."),
        Q("hr-conflict", "Two employees escalate a conflict to you. How do you handle it?",
          "Listen to each side privately and confidentially, gather facts, stay neutral, check policy, bring them "
          "together to agree on a solution focused on behaviours and shared goals, document it, and follow up. "
          "Escalate if it involves harassment or misconduct."),
        Q("hr-retention", "How would you reduce employee attrition?",
          "Analyse data from exit interviews and surveys to find the causes, then act on them: fair compensation, "
          "career growth paths, manager training, recognition, flexibility and engagement programmes. Track "
          "retention and engagement metrics over time."),
    ],
    "finance": [
        Q("fin-three-statements", "Explain how the three financial statements are linked.",
          "Net income from the income statement flows into retained earnings on the balance sheet and is the "
          "starting point of the cash flow statement. Non-cash items like depreciation are added back, working "
          "capital changes adjust cash, and the ending cash on the cash flow statement equals cash on the balance "
          "sheet."),
        Q("fin-valuation", "How would you value a company?",
          "Use several methods: discounted cash flow (project free cash flows and discount at WACC plus a "
          "terminal value), comparable company multiples (EV/EBITDA, P/E), and precedent transactions. Compare "
          "the ranges and explain the assumptions driving them."),
        Q("fin-working-capital", "What is working capital and why does it matter?",
          "Working capital is current assets minus current liabilities (receivables, inventory, payables). It "
          "measures short-term liquidity; managing it well (faster collections, inventory control, payment terms) "
          "frees up cash for operations and growth."),
    ],
    "operations": [
        Q("ops-process-improve", "Tell me about a process you improved.",
          "STAR: the inefficient process and its cost, how you measured it, the root cause analysis, the change "
          "you made (automation, standardisation, removing steps), how you got buy-in, and the measurable "
          "result such as time or cost saved."),
        Q("ops-kpis", "Which KPIs would you track to run an operations team?",
          "Throughput and turnaround time, SLA adherence, quality or error rate, cost per unit or order, capacity "
          "utilisation, and customer satisfaction. Review them regularly and act on trends."),
        Q("ops-escalation", "A major customer escalation lands on your desk. What do you do?",
          "Acknowledge quickly, understand the impact, own the communication, gather facts, fix the immediate "
          "issue with the right teams, keep the customer updated, then do a root cause analysis and put "
          "preventive measures in place."),
    ],
    "qa": [
        Q("qa-test-login", "How would you test a login page?",
          "Functional cases: valid login, invalid password or user, empty fields, password reset, lockout after "
          "failed attempts, remember me. Non-functional: security (SQL injection, XSS, password masking, HTTPS, "
          "rate limiting), usability, accessibility, cross-browser and mobile, and performance under load. "
          "Automate the regression cases."),
        Q("qa-bug-report", "What makes a good bug report?",
          "A clear title, steps to reproduce, expected versus actual result, environment (browser, OS, build), "
          "severity and priority, and evidence such as screenshots, logs or video. It should be reproducible by "
          "anyone."),
        Q("qa-automation", "What would you automate, and what would you keep manual?",
          "Automate stable, repetitive, high-value tests: regression, smoke, API and data-driven tests run in CI. "
          "Keep exploratory, usability and one-off tests manual. Follow the test pyramid: many unit tests, fewer "
          "integration tests, few end-to-end UI tests."),
    ],
}

ALL = ROLE_FIT + ENGINEERING_CODING + SQL_CODING + [q for qs in FAMILY_QUESTIONS.values() for q in qs]
BY_KEY = {q["key"]: q for q in ALL}
assert len(BY_KEY) == len(ALL), "duplicate practice library key"
