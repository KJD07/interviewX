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
MODEL = "openai/gpt-4o-mini"
TIMEOUT = 30  # seconds


def chat_completion(messages: list[dict[str, str]]) -> str:
    """
    Send a list of {"role": ..., "content": ...} messages to OpenRouter.
    Returns the assistant's reply text.
    Raises RuntimeError on API errors.
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
        "model": MODEL,
        "messages": messages,
        "max_tokens": 1024,
        "temperature": 0.7,
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

    return f"""You are a real human interviewer named Alex at {company_name}, conducting a {round_title} interview for the {role_title} role.

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
) -> list[dict[str, str]]:
    """
    Build the messages list for a feedback/scoring pass after the interview ends.
    Returns messages ready to pass to chat_completion().
    """
    transcript_text = "\n".join(
        f"{turn['role'].upper()}: {turn['text']}" for turn in transcript
    )
    q_block = "\n".join(
        f"{i+1}. [{q['question_type']}] {q['question_text']} | Ideal: {q.get('ideal_answer','N/A')}"
        for i, q in enumerate(questions)
    )

    system = """You are an expert interview evaluator. You will receive an interview transcript and return ONLY a JSON object — no markdown, no preamble, no explanation outside the JSON.

Required JSON shape:
{
  "communication": <integer 1-10>,
  "technical": <integer 1-10>,
  "problem_solving": <integer 1-10>,
  "overall": <integer 1-10>,
  "feedback": "<2-4 sentence plain-text summary of strengths and areas to improve>"
}"""

    user = f"""Company: {company_name}
Role: {role_title}
Round: {round_title}

Questions asked (with ideal answers):
{q_block}

Transcript:
{transcript_text}

Score and give feedback."""

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]