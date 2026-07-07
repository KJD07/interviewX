"""
OpenRouter client — Phase 5.
Wraps the OpenRouter chat completions endpoint (OpenAI-compatible).
Model: openai/gpt-4o-mini
"""

import json
import os
from typing import Any

import httpx

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"
TIMEOUT = 30  # seconds


def chat_completion(
    messages: list[dict[str, str]],
    model: str = MODEL,
    max_tokens: int = 1024,
    temperature: float = 0.7,
) -> str:
    """
    Send a list of {"role": ..., "content": ...} messages to OpenRouter.
    Returns the assistant's reply text.
    Raises RuntimeError on API errors.

    `model` defaults to the standard interview model, but callers (e.g. the
    question-sourcing pipeline) can pass a web-search-enabled model such as
    "openai/gpt-4o-mini:online".
    """
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set.")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://interviewx.dev",  # required by OpenRouter
        "X-Title": "InterviewX",
    }

    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    try:
        response = httpx.post(
            OPENROUTER_API_URL,
            headers=headers,
            json=payload,
            timeout=TIMEOUT,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(
            f"OpenRouter returned {exc.response.status_code}: {exc.response.text}"
        ) from exc
    except httpx.RequestError as exc:
        raise RuntimeError(f"Network error calling OpenRouter: {exc}") from exc

    data: dict[str, Any] = response.json()
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError) as exc:
        raise RuntimeError(f"Unexpected OpenRouter response shape: {data}") from exc


def build_interview_system_prompt(
    company_name: str,
    company_tone: str,
    role_title: str,
    round_title: str,
    questions: list[dict],
    is_skill: bool = False,
) -> str:
    q_block = "\n".join(
        f"{i+1}. [{q['question_type']}] {q['question_text']}"
        for i, q in enumerate(questions)
    )

    tone_instructions = {
        "formal": (
            "You are professional, precise, and measured. Use complete sentences. "
            "Maintain a serious, respectful demeanour throughout. No jokes or small talk."
        ),
        "casual": (
            "You are relaxed and conversational — like a senior engineer having a coffee chat. "
            "Use natural language, contractions, the occasional 'yeah' or 'got it'. "
            "Make the candidate feel at ease, but still push them when answers are thin."
        ),
        "aggressive": (
            "You are a tough, no-nonsense interviewer. You challenge every weak answer. "
            "You don't accept vague responses — you push back hard. Think: FAANG-style pressure interview. "
            "You're not rude, but you are relentless and demanding."
        ),
    }

    tone_desc = tone_instructions.get(
        company_tone.lower(),
        f"Your tone is {company_tone}. Stay consistent with it throughout."
    )

    intro = (
        f"You are a real human interviewer named Alex, conducting a focused skill-assessment "
        f"interview on {company_name} ({round_title} — {role_title} track)."
        if is_skill
        else f"You are a real human interviewer named Alex at {company_name}, conducting a {round_title} interview for the {role_title} role."
    )

    return f"""{intro}

## Your personality
{tone_desc}

## How you interview
- Ask questions ONE AT A TIME, strictly in the order listed below.
- After the candidate answers, do ONE of the following — choose based on answer quality:
  a) If the answer is strong and complete: give a brief natural reaction ("Got it", "That makes sense", "Nice") then move to the next question.
  b) If the answer is vague, too short, or unconvincing: DO NOT move on. Press them. Use follow-ups like:
     - "Can you walk me through a specific example of that?"
     - "That's a bit general — can you be more concrete?"
     - "Interesting, but how did you actually handle X in that situation?"
     - "I'm not fully convinced — can you elaborate on that?"
     - "What would you have done differently?"
  c) If they say they don't know: don't just accept it. Prompt them to reason through it:
     - "Take a guess — how would you approach it?"
     - "What do you know that might be relevant here?"
     - "Walk me through your thinking even if you're unsure."
- Stay on the same question until you get a satisfactory answer OR the candidate has made 2-3 genuine attempts. Only then move on.
- Never give lengthy mid-interview feedback or reveal scoring.
- React like a human — vary your responses, don't use the same filler phrase every time.
- After the final question is done, say exactly: "That wraps up the interview. Thanks for your time today."

## Questions to cover (in order)
{q_block}

## Start
Introduce yourself briefly as Alex from {company_name}, mention the round, and ask question 1. Keep the intro to 2-3 sentences max."""


def build_feedback_prompt(
    transcript: list[dict],
    company_name: str,
    role_title: str,
    round_title: str,
    questions: list[dict],
    detailed: bool = False,
    engagement_summary: str = "",
) -> list[dict[str, str]]:
    """
    Build the messages list for a feedback/scoring pass after the interview ends.
    Returns messages ready to pass to chat_completion().

    `detailed=True` (paid plans only) asks the model for an additional
    topic-level breakdown and improvement areas, which costs a few more
    output tokens. `detailed=False` (free plan) keeps the response lean —
    just the four scores and a short summary — to keep free interviews cheap.

    `engagement_summary` (optional) is a short, deterministically-computed
    string describing how much the candidate actually engaged (word counts,
    number of blank/"I don't know" answers, etc.) so the model has hard
    numbers to anchor against instead of guessing leniently from vibes.
    """
    transcript_text = "\n".join(
        f"{turn['role'].upper()}: {turn['text'] if turn['text'].strip() else '[NO ANSWER GIVEN]'}"
        for turn in transcript
    )
    q_block = "\n".join(
        f"{i+1}. [{q['question_type']}] {q['question_text']} | Ideal: {q.get('ideal_answer','N/A')}"
        for i, q in enumerate(questions)
    )

    base_shape = """{
  "communication": <integer 0-10>,
  "technical": <integer 0-10>,
  "problem_solving": <integer 0-10>,
  "overall": <integer 0-10>,
  "feedback": "<2-4 sentence plain-text summary of strengths and areas to improve, referencing specific moments from the transcript>"
}"""

    detailed_shape = """{
  "communication": <integer 0-10>,
  "technical": <integer 0-10>,
  "problem_solving": <integer 0-10>,
  "overall": <integer 0-10>,
  "feedback": "<2-4 sentence plain-text summary of strengths and areas to improve, referencing specific moments from the transcript>",
  "topics": [
    {"name": "<short topic/skill name, e.g. 'System Design', 'SQL Joins', 'Communication clarity'>", "score": <integer 0-10>, "note": "<1 sentence on performance for this topic, citing what was or wasn't said>"}
  ],
  "improvement_areas": [
    {"area": "<specific weak area>", "suggestion": "<1-2 sentence actionable suggestion to improve it>"}
  ]
}"""

    system = f"""You are a strict, no-nonsense senior hiring panel evaluator for {company_name}. You will receive an interview transcript and return ONLY a JSON object — no markdown, no preamble, no explanation outside the JSON.

## Your grading philosophy
You are NOT a friendly coach trying to make the candidate feel good. You are a precise evaluator whose scores directly affect a hiring decision. Being generous or "rounding up out of politeness" is a failure on your part — it misleads the candidate about their real readiness. Score exactly what you observe, nothing more.

## Hard anchoring rubric (apply this literally, per question and overall)
- 0: No answer at all, a blank/empty response, or completely off-topic content with zero relevant substance.
- 1-2: Candidate said something but it shows no real understanding — e.g. "I don't know", a one-word non-answer, or a guess with no reasoning that happens to be wrong.
- 3-4: A weak attempt — some relevant words/concepts appear, but the answer is mostly incorrect, extremely shallow, or so vague it could apply to any question.
- 5-6: A partial answer — gets some genuinely correct/relevant substance across, but has clear gaps, imprecision, or missing depth an average competent candidate would include.
- 7-8: A solid, mostly correct and reasonably complete answer with only minor gaps or missed nuance.
- 9-10: An excellent, precise, well-structured answer that a strong hire would give — correct, complete, and clearly communicated.

## Critical rules — do not violate these
- A blank answer, "[NO ANSWER GIVEN]", "I don't know" with no follow-up reasoning, "pass"/"skip", or one-line non-attempts MUST score 0-2 on every dimension that question touches. NEVER default to a "neutral" middle score like 5 or 6 just because you lack information — lack of information about a skill means the candidate did not demonstrate it, which scores low, not average.
- The "overall" score must be consistent with the per-question performance across the WHOLE transcript. If the majority of questions received no real answer, overall must be in the 0-2 range even if one question was answered reasonably.
- Do not give credit for confidence, politeness, or effort alone — only for actual demonstrated correctness/relevance.
- Base every score strictly on what is literally present in the transcript below. Do not assume unstated competence.

Required JSON shape:
{detailed_shape if detailed else base_shape}"""

    if detailed:
        system += "\n\nFor \"topics\", identify 3-6 distinct topics/skills actually covered in the transcript (draw from the questions asked) and score each using the same rubric above — a topic that was never actually answered scores 0-2, not a moderate score. For \"improvement_areas\", give 2-4 concrete, specific areas the candidate should focus on next, based on where they were weakest or silent."

    engagement_block = f"\nCandidate engagement stats (computed, not opinion — use these to sanity-check your scores):\n{engagement_summary}\n" if engagement_summary else ""

    user = f"""Company: {company_name}
Role: {role_title}
Round: {round_title}

Questions asked (with ideal answers):
{q_block}
{engagement_block}
Transcript:
{transcript_text}

Score strictly according to the rubric and rules above, then give feedback."""

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]