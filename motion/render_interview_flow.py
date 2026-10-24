#!/usr/bin/env python3
"""Motion graphic of the EvaluLabs candidate interview flow.

Renders a 1920x1080 h264 video:
  python3 motion/render_interview_flow.py
  python3 motion/render_interview_flow.py stills 2 8 18
"""

import math
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
FPS = 30

PAGE = (242, 240, 234)
PAGE_DEEP = (232, 228, 218)
INK = (12, 12, 11)
DIM = (84, 83, 75)
FAINT = (139, 138, 129)
WHITE = (255, 252, 247)
CARD = (255, 253, 250)
LINE = (226, 222, 212)
SHADOW = (214, 210, 200)
RED = (176, 52, 42)
RED_DEEP = (145, 38, 32)
GREEN = (22, 130, 78)
GREEN_SOFT = (226, 240, 230)
LAVENDER = (216, 204, 238)
PINK_BG = (250, 232, 230)
PINK_INK = (164, 64, 58)
EDITOR = (22, 22, 24)
EDITOR_BAR = (32, 32, 36)
CHROME = (28, 27, 32)

AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
HELV = "/System/Library/Fonts/HelveticaNeue.ttc"
MENLO = "/System/Library/Fonts/Menlo.ttc"

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "Evalulabs-interview-flow.mp4"


def font(path, size, index):
    return ImageFont.truetype(path, size, index=index)


F = {
    "hero": font(AVENIR, 78, 8),
    "h1": font(AVENIR, 40, 8),
    "h2": font(AVENIR, 32, 2),
    "h3": font(AVENIR, 26, 2),
    "title": font(AVENIR, 22, 2),
    "rail": font(HELV, 18, 10),
    "body": font(HELV, 22, 0),
    "body_m": font(HELV, 22, 10),
    "small": font(HELV, 18, 0),
    "small_m": font(HELV, 18, 10),
    "tiny": font(HELV, 15, 10),
    "tiny_r": font(HELV, 15, 0),
    "caption": font(HELV, 22, 0),
    "ui": font(HELV, 16, 10),
    "ui_r": font(HELV, 16, 0),
    "code": font(MENLO, 22, 0),
    "code_b": font(MENLO, 22, 1),
    "logo": font(AVENIR, 18, 2),
    "big_num": font(AVENIR, 28, 2),
    "timer": font(HELV, 16, 10),
    "score": font(AVENIR, 28, 8),
}


def clamp(v, a=0.0, b=1.0):
    return a if v < a else b if v > b else v


def lerp(a, b, t):
    return a + (b - a) * t


def ease_out(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ease_in_out(t):
    t = clamp(t)
    return 4 * t * t * t if t < 0.5 else 1 - ((-2 * t + 2) ** 3) / 2


def ease_out_back(t):
    t = clamp(t)
    c1 = 1.45
    c3 = c1 + 1
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2


def seg(t, start, dur):
    return clamp((t - start) / dur) if dur else 1.0


def wrap(text, fnt, max_w):
    words = text.split()
    lines, cur = [], ""
    for word in words:
        trial = word if not cur else f"{cur} {word}"
        if fnt.getlength(trial) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines or [""]


def text_block(d, text, fnt, x, y, max_w, fill, lh=None):
    lh = lh or int(fnt.size * 1.38)
    lines = wrap(text, fnt, max_w)
    for i, line in enumerate(lines):
        d.text((x, y + i * lh), line, font=fnt, fill=fill)
    return len(lines) * lh


def rounded(d, box, r, fill, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def shadow_card(d, box, r, fill=CARD, shadow=SHADOW):
    x0, y0, x1, y1 = box
    rounded(d, (x0, y0 + 8, x1, y1 + 9), r, shadow)
    rounded(d, box, r, fill)


def pill(d, box, label, fnt, fg, bg=None, outline=None):
    rounded(d, box, (box[3] - box[1]) / 2, bg or WHITE, outline=outline, width=1 if outline else 0)
    d.text(((box[0] + box[2]) / 2, (box[1] + box[3]) / 2), label, font=fnt, fill=fg, anchor="mm")


def logo_mark(d, x, y, s=36):
    rounded(d, (x, y, x + s, y + s), int(s * 0.28), INK)
    size = max(10, int(s * 0.38))
    fnt = font(AVENIR, size, 2)
    d.text((x + s / 2, y + s / 2 + 1), "eL", font=fnt, fill=PAGE, anchor="mm")


def cursor(d, x, y, scale=1.0):
    pts = [(0, 0), (0, 22), (5.5, 16.5), (10, 26), (14, 24), (9, 15), (17, 14.5)]

    def shift(dx, dy, col):
        d.polygon([(x + dx + px * scale, y + dy + py * scale) for px, py in pts], fill=col)

    shift(1.5, 2, WHITE)
    shift(0, 0, INK)


def click_ring(d, x, y, p):
    if p <= 0 or p >= 1:
        return
    r = 6 + p * 28
    width = 3
    # Fake a fading ring by lightening toward the page color.
    col = tuple(int(lerp(c, PAGE[i], p)) for i, c in enumerate(INK))
    d.ellipse((x - r, y - r, x + r, y + r), outline=col, width=width)


RAIL = [("01", "Invite"), ("02", "Agree"), ("03", "Speak"), ("04", "Code"), ("05", "Proctor")]


def draw_rail(d, active, appear=1.0):
    pw, ph, gap = 196, 46, 14
    total = len(RAIL) * pw + (len(RAIL) - 1) * gap
    x = (W - total) / 2
    y = 32
    n = appear * len(RAIL)
    for i, (num, name) in enumerate(RAIL):
        local = clamp(n - i)
        if local <= 0:
            continue
        shift = (1 - ease_out(local)) * 16
        box = (x, y + shift, x + pw, y + ph + shift)
        on = i == active
        if on:
            rounded(d, box, 23, INK)
            label, col = f"{num}   {name}", PAGE
        else:
            rounded(d, box, 23, WHITE, outline=LINE, width=1)
            label, col = f"{num}   {name}", DIM
        d.text(((box[0] + box[2]) / 2, (box[1] + box[3]) / 2), label, font=F["rail"], fill=col, anchor="mm")
        x += pw + gap


def caption(d, text, alpha_t=1.0):
    if alpha_t <= 0.02:
        return
    col = tuple(int(lerp(PAGE[i], DIM[i], alpha_t)) for i in range(3))
    d.text((W / 2, 1024), text, font=F["caption"], fill=col, anchor="mm")


def new_frame():
    im = BG.copy()
    return im, ImageDraw.Draw(im)


def progress(d, t, dur):
    d.rectangle((0, H - 6, W * clamp(t / dur), H), fill=INK)


def make_bg():
    im = Image.new("RGB", (W, H), PAGE)
    d = ImageDraw.Draw(im)
    d.ellipse((-320, -280, 720, 740), fill=(236, 233, 224))
    d.ellipse((1240, 640, 2140, 1320), fill=PAGE_DEEP)
    d.ellipse((1460, -260, 2060, 320), fill=(255, 253, 248))
    return im


BG = make_bg()

# ---------------------------------------------------------------------------
# Scenes
# ---------------------------------------------------------------------------

def scene_title(t, dur):
    im, d = new_frame()
    p = ease_out(seg(t, 0.15, 0.7))
    yoff = (1 - p) * 28
    logo_mark(d, W / 2 - 22, 300 + yoff, 44)
    d.text((W / 2, 390 + yoff), "EvaluLabs", font=F["hero"], fill=INK, anchor="mm")
    sub_p = ease_out(seg(t, 0.7, 0.6))
    d.text(
        (W / 2, 470),
        "Give the interview",
        font=F["h2"],
        fill=tuple(int(lerp(PAGE[i], DIM[i], sub_p)) for i in range(3)),
        anchor="mm",
    )
    # Five beats stagger in as the spine of the film.
    labels = ["Invite", "Agree", "Speak", "Code", "Proctor"]
    fnt = F["title"]
    widths = [fnt.getlength(s) for s in labels]
    arrow_w = 36
    total = sum(widths) + arrow_w * (len(labels) - 1)
    x = (W - total) / 2
    y = 548
    for i, (label, w) in enumerate(zip(labels, widths)):
        lp = ease_out(seg(t, 1.35 + i * 0.28, 0.45))
        col = tuple(int(lerp(PAGE[i2], INK[i2], lp)) for i2 in range(3))
        d.text((x, y + (1 - lp) * 10), label, font=fnt, fill=col, anchor="lt")
        x += w
        if i < len(labels) - 1:
            ac = tuple(int(lerp(PAGE[i2], FAINT[i2], lp)) for i2 in range(3))
            ax = x + 14
            ay = y + 14 + (1 - lp) * 10
            d.polygon([(ax, ay - 5), (ax + 8, ay), (ax, ay + 5)], fill=ac)
            x += arrow_w
    note_p = ease_out(seg(t, 3.3, 0.5))
    d.text(
        (W / 2, 660),
        "From the mailbox to a scored technical screen.",
        font=F["small"],
        fill=tuple(int(lerp(PAGE[i], FAINT[i], note_p)) for i in range(3)),
        anchor="mm",
    )
    return im


LINK_BLUE = (26, 111, 214)


def scene_email(t, dur):
    """The opened invite. Nothing else — no steps, no interview chrome."""
    im, d = new_frame()
    rise = ease_out_back(seg(t, 0.0, 0.28))
    sheet = (80, 28 + (1 - rise) * 36, 1840, 1052)
    shadow_card(d, sheet, 18, fill=WHITE)
    x = 168
    d.text((x, 108), "You're invited to interview with Personal", font=F["h2"], fill=INK)
    # Small mailbox tag, the way the message arrives.
    tag = "Inbox"
    tw = F["tiny"].getlength(tag)
    rounded(d, (x + 760, 112, x + 760 + tw + 22, 140), 6, (232, 236, 244))
    d.text((x + 771, 118), tag, font=F["tiny"], fill=(70, 100, 160))

    d.ellipse((x, 188, x + 56, 244), fill=(66, 133, 244))
    d.text((x + 28, 216), "E", font=F["title"], fill=WHITE, anchor="mm")
    d.text((x + 72, 192), "EvaluLabs", font=F["body_m"], fill=INK)
    d.text((x + 72 + F["body_m"].getlength("EvaluLabs") + 10, 194), "<no-reply@evalulabs.com>", font=F["small"], fill=DIM)
    d.text((x + 72, 222), "to me", font=F["tiny_r"], fill=FAINT)
    d.text((1540, 200), "Fri 4 Sept, 17:20", font=F["small"], fill=FAINT, anchor="rt")

    y = 300
    d.text((x, y), "Hi,", font=F["body"], fill=INK)
    y += 56
    h = text_block(
        d,
        "Personal has invited you to complete an interview for Software Engineer — Technical Screen.",
        F["body"],
        x,
        y,
        1100,
        INK,
    )
    y += h + 28
    d.text((x, y), "Start your interview here:", font=F["body"], fill=INK)
    link = "https://www.evalulabs.com/enterprise/invite/…"
    lw = F["body_m"].getlength(link)
    y += 40
    d.text((x, y), link, font=F["body_m"], fill=LINK_BLUE)
    d.line((x, y + 28, x + lw, y + 28), fill=LINK_BLUE, width=2)

    click_p = seg(t, 1.15, 0.42)
    if click_p > 0:
        tx, ty = x + lw * 0.45, y + 14
        u = ease_out(min(1, click_p / 0.7))
        cursor(d, lerp(x + lw + 180, tx, u), lerp(y + 160, ty, u))
        if click_p > 0.72:
            click_ring(d, tx, ty, (click_p - 0.72) / 0.28)

    y += 64
    text_block(
        d,
        "This link expires on 2026-09-11 17:20 UTC and can only be used by the email address it was sent to.",
        F["body"],
        x,
        y,
        1100,
        INK,
        lh=32,
    )
    y += 88
    d.text((x, y), "— EvaluLabs", font=F["body"], fill=INK)

    # Reply / Forward, so the frame reads as the message itself.
    by = y + 78
    for i, label in enumerate(("Reply", "Forward")):
        bw = 148
        bx = x + i * 164
        rounded(d, (bx, by, bx + bw, by + 48), 24, WHITE, outline=LINE, width=2)
        d.text((bx + bw / 2, by + 24), label, font=F["small_m"], fill=DIM, anchor="mm")
    return im


CONSENT_STEPS = [
    "Find a quiet, well-lit space free of distractions — treat this like the real thing.",
    "Once started, the interview can't be paused. Set aside the full session length before you begin.",
    "Answer as you naturally would — no notes, no searching, no outside help.",
    "You can type or speak your answers. The interviewer adapts follow-ups to what you say.",
    "At the end you get scored feedback — communication, technical, problem-solving, overall.",
]


def scene_consent(t, dur):
    im, d = new_frame()
    draw_rail(d, 1)
    appear = ease_out(seg(t, 0.05, 0.5))
    card_w, card_h = 860, 760
    x0 = (W - card_w) / 2
    y0 = 112 + (1 - appear) * 30
    shadow_card(d, (x0, y0, x0 + card_w, y0 + card_h), 28)
    d.text((W / 2, y0 + 36), "Before you begin", font=F["h2"], fill=INK, anchor="mt")
    d.text(
        (W / 2, y0 + 78),
        "This interview is part of your employer's hiring process.",
        font=F["tiny_r"],
        fill=FAINT,
        anchor="mt",
    )

    y = y0 + 118
    shown = t * 3.6
    for i, step in enumerate(CONSENT_STEPS):
        sp = ease_out(clamp(shown - i * 0.28))
        if sp <= 0:
            continue
        cy = y + (1 - sp) * 12
        circle = (x0 + 36, cy, x0 + 68, cy + 32)
        rounded(d, circle, 16, INK if sp > 0.8 else LINE)
        d.text((x0 + 52, cy + 16), str(i + 1), font=F["ui"], fill=PAGE if sp > 0.8 else WHITE, anchor="mm")
        text_block(d, step, F["small"], x0 + 84, cy + 2, card_w - 120, INK, lh=24)
        y += 78

    y = y0 + 524
    d.line((x0 + 36, y, x0 + card_w - 36, y), fill=LINE, width=1)
    cam_p = ease_out(seg(t, 0.65, 0.22))
    if cam_p > 0:
        col = tuple(int(lerp(CARD[i], INK[i], cam_p)) for i in range(3))
        dim = tuple(int(lerp(CARD[i], DIM[i], cam_p)) for i in range(3))
        d.text((x0 + 36, y + 20), "Camera & microphone required", font=F["body_m"], fill=col)
        d.text(
            (x0 + 36, y + 54),
            "Both must be on before the interview can start.",
            font=F["tiny_r"],
            fill=dim,
        )

    pressed = seg(t, 2.05, 0.12)
    granted = ease_out(seg(t, 2.22, 0.2))
    btn_w, btn_h = 420, 56
    bx = W / 2 - btn_w / 2
    by = y0 + card_h - 88 + (3 if pressed > 0.2 and granted < 0.2 else 0)
    btn = (bx, by, bx + btn_w, by + btn_h)
    rounded(d, btn, 28, INK)
    label = "Grant access & start interview"
    d.text((W / 2, by + btn_h / 2), label, font=F["small_m"], fill=PAGE, anchor="mm")

    # Cursor
    cp = seg(t, 1.55, 0.48)
    if 0 < cp < 1 or (granted < 0.15 and cp >= 1):
        tx, ty = W / 2 + 40, by + btn_h / 2 + 6
        u = ease_out(min(1, cp / 0.72))
        cx = lerp(W / 2 + 280, tx, u)
        cy = lerp(by + 160, ty, u)
        cursor(d, cx, cy)
        if cp > 0.75:
            click_ring(d, W / 2, by + btn_h / 2, (cp - 0.75) / 0.25)

    if granted > 0:
        # Two status chips rise over the button's lower area — sit just above the button.
        chips = [("Camera on", granted), ("Microphone on", ease_out(seg(t, 2.38, 0.18)))]
        cw, ch, gap = 210, 40, 12
        total = cw * 2 + gap
        sx = W / 2 - total / 2
        sy = by - 64
        for i, (name, gp) in enumerate(chips):
            if gp <= 0:
                continue
            shift = (1 - gp) * 10
            box = (sx + i * (cw + gap), sy + shift, sx + i * (cw + gap) + cw, sy + ch + shift)
            rounded(d, box, 20, GREEN_SOFT)
            d.ellipse((box[0] + 16, box[1] + 15, box[0] + 26, box[1] + 25), fill=GREEN)
            d.text((box[0] + 36, (box[1] + box[3]) / 2), name, font=F["ui"], fill=GREEN, anchor="lm")

    caption(d, "They agree to the rules, then grant the camera and microphone.", 1)
    return im


AI_Q1 = (
    "Hello, I am Alex from Personal. I will be conducting your Technical Screen today. "
    "First question: explain the difference between a process and a thread."
)
ANSWER = (
    "A process is an independent program with its own memory and resources. "
    "A thread is a lightweight unit of execution inside that process — threads share the process's memory."
)


def interview_header(d, t, right_mode="voice", banner=None):
    y = 118
    logo_mark(d, 72, y, 36)
    d.text((118, y + 6), "EvaluLabs", font=F["title"], fill=INK)
    d.text((250, y + 10), "Session #55", font=F["ui_r"], fill=FAINT)
    d.ellipse((360, y + 14, 372, y + 26), fill=GREEN)
    d.text((380, y + 8), "Live", font=F["ui"], fill=INK)
    if not banner:
        remain = 47 * 60 + 1 - t
        m, s = divmod(max(0, int(remain)), 60)
        d.text((430, y + 8), f"{m}:{s:02d}", font=F["timer"], fill=DIM)
        d.text((510, y + 8), "Full-screen", font=F["ui_r"], fill=FAINT)

    if banner:
        fnt = F["ui"]
        tw = fnt.getlength(banner)
        bw = tw + 44
        bx = (W - bw) / 2
        # Nudge right if it would cover the session cluster; the real UI centers it.
        rounded(d, (bx, y - 2, bx + bw, y + 40), 20, RED)
        d.text((W / 2, y + 19), banner, font=fnt, fill=WHITE, anchor="mm")

    items = []
    if right_mode == "voice":
        items = [("AI voice on", "ghost"), ("Answering by voice", "black"), ("End interview", "pink")]
    elif right_mode == "muted":
        items = [("AI voice muted", "ghost"), ("Answer by voice", "ghost"), ("End interview", "pink")]
    elif right_mode == "end":
        items = [("End interview", "pink")]
    x = W - 64
    for label, style in reversed(items):
        tw = F["ui"].getlength(label)
        w = tw + 32
        h = 38
        x -= w
        box = (x, y, x + w, y + h)
        if style == "black":
            rounded(d, box, 19, INK)
            fg = PAGE
        elif style == "pink":
            rounded(d, box, 19, PINK_BG, outline=(236, 196, 190), width=1)
            fg = PINK_INK
        else:
            rounded(d, box, 19, WHITE, outline=LINE, width=1)
            fg = DIM
        d.text((x + w / 2, y + h / 2), label, font=F["ui"], fill=fg, anchor="mm")
        x -= 10


def bubble(d, text, x, y, max_w, fill, text_fill, anchor="left", typed=1.0):
    shown = text if typed >= 1 else text[: max(0, int(len(text) * typed))]
    if not shown:
        return (x, y, x, y)
    fnt = F["small"]
    lines = wrap(shown, fnt, max_w - 40)
    lh = 26
    h = 28 + len(lines) * lh
    w = max(fnt.getlength(line) for line in lines) + 40
    w = min(max_w, max(w, 180))
    if anchor == "right":
        box = (x - w, y, x, y + h)
    else:
        box = (x, y, x + w, y + h)
    shadow_card(d, box, 18, fill=fill, shadow=(230, 226, 218) if fill == WHITE else (206, 196, 220))
    for i, line in enumerate(lines):
        d.text((box[0] + 20, box[1] + 16 + i * lh), line, font=fnt, fill=text_fill)
    return box


def mic_glyph(d, cx, cy, color):
    d.rounded_rectangle((cx - 8, cy - 20, cx + 8, cy), radius=8, fill=color)
    d.arc((cx - 15, cy - 10, cx + 15, cy + 14), 0, 180, fill=color, width=3)
    d.line((cx, cy + 14, cx, cy + 22), fill=color, width=3)
    d.line((cx - 10, cy + 22, cx + 10, cy + 22), fill=color, width=3)


def waveform(d, cx, cy, t, live=1.0):
    n = 27
    span = n * 8
    for i in range(n):
        phase = t * 7.5 + i * 0.55
        amp = (6 + 20 * abs(math.sin(phase)) * (0.45 + 0.55 * abs(math.sin(i * 0.7)))) * live
        x = cx - span / 2 + i * 8
        rounded(d, (x, cy - amp, x + 4, cy + amp), 2, INK)


def face_card(d, box, state, t):
    """state: present | noface | phone | away"""
    shadow_card(d, box, 18, fill=EDITOR)
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2 + 4
    d.text((x0 + 16, y0 + 14), "Session camera", font=F["tiny"], fill=(180, 178, 170))
    if state == "present":
        bob = math.sin(t * 2.2) * 3
        d.ellipse((cx - 28, cy - 62 + bob, cx + 28, cy - 6 + bob), fill=(232, 196, 170))
        d.pieslice((cx - 58, cy - 8 + bob, cx + 58, cy + 86 + bob), 200, 340, fill=(196, 198, 206))
        d.ellipse((cx - 12, cy - 40 + bob, cx - 5, cy - 33 + bob), fill=INK)
        d.ellipse((cx + 6, cy - 40 + bob, cx + 13, cy - 33 + bob), fill=INK)
        d.arc((cx - 10, cy - 28 + bob, cx + 10, cy - 14 + bob), 20, 160, fill=(160, 100, 90), width=2)
    elif state == "noface":
        d.rounded_rectangle((cx - 46, cy - 40, cx + 46, cy + 28), radius=10, outline=(120, 118, 112), width=2)
        d.line((cx - 22, cy - 18, cx + 22, cy + 14), fill=RED, width=4)
        d.line((cx + 22, cy - 18, cx - 22, cy + 14), fill=RED, width=4)
        d.text((cx, y1 - 36), "No face", font=F["small_m"], fill=(230, 140, 130), anchor="mm")
    elif state == "phone":
        bob = math.sin(t * 2.2) * 2
        d.ellipse((cx - 46, cy - 58 + bob, cx - 6, cy - 18 + bob), fill=(232, 196, 170))
        d.pieslice((cx - 78, cy - 16 + bob, cx + 4, cy + 64 + bob), 200, 340, fill=(196, 198, 206))
        px, py = cx + 8, cy - 48
        d.rounded_rectangle((px, py, px + 36, py + 64), radius=6, fill=(248, 246, 240), outline=RED, width=3)
        d.rounded_rectangle((px + 5, py + 8, px + 31, py + 48), radius=2, fill=(186, 206, 220))
        d.ellipse((px + 14, py + 52, px + 22, py + 60), fill=RED)
        d.text((cx, y1 - 36), "Phone in frame", font=F["small_m"], fill=(230, 140, 130), anchor="mm")
    else:
        d.rounded_rectangle((cx - 70, cy - 36, cx + 70, cy + 28), radius=8, outline=(90, 88, 84), width=2)
        d.text((cx, cy - 4), "Window hidden", font=F["small_m"], fill=(180, 178, 170), anchor="mm")
    # REC dot
    pulse = 0.45 + 0.55 * abs(math.sin(t * 4))
    rc = tuple(int(lerp(80, 220, pulse)) for _ in range(1))
    d.ellipse((x1 - 58, y0 + 14, x1 - 48, y0 + 24), fill=(220, int(60 + 40 * pulse), 50))
    d.text((x1 - 42, y0 + 12), "REC", font=F["tiny"], fill=(220, 90, 80))


def scene_voice(t, dur):
    im, d = new_frame()
    draw_rail(d, 2)
    interview_header(d, t, "voice")
    q_p = ease_out(seg(t, 0.0, 0.2))
    if q_p > 0:
        # Avatar
        d.ellipse((72, 196, 108, 232), fill=INK)
        d.text((90, 214), "AI", font=F["tiny"], fill=PAGE, anchor="mm")
        qbox = bubble(d, AI_Q1, 120, 188 + (1 - q_p) * 16, 860, WHITE, INK)
        d.text((120, qbox[3] + 10), "04:45 pm", font=F["tiny_r"], fill=FAINT)

    speak = seg(t, 0.45, 2.5)
    if speak > 0:
        typed = ease_in_out_clamp(speak)
        box = bubble(d, ANSWER, W - 360, 390, 720, LAVENDER, INK, anchor="right", typed=typed)
        # Keep a little time label under the bubble once it exists.
        if typed > 0.08:
            d.text((W - 360, box[3] + 8), "Speaking", font=F["tiny"], fill=FAINT, anchor="rm")

    # Mic + waveform once the answer starts.
    mic_p = ease_out(seg(t, 0.35, 0.18))
    if mic_p > 0:
        cx, cy = W / 2 - 80, 900
        r = 34
        # Soft pulse rings drawn as expanding outlines.
        for k in range(3):
            phase = (t * 0.9 + k / 3) % 1
            rr = r + 8 + phase * 26
            col = tuple(int(lerp(PINK_INK[i], PAGE[i], phase)) for i in range(3))
            d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), outline=col, width=2)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=RED)
        mic_glyph(d, cx, cy - 2, WHITE)
        d.text((cx, cy + r + 28), "Listening — pause when you're done", font=F["tiny_r"], fill=DIM, anchor="mt")
        if speak > 0:
            waveform(d, cx + 220, cy, t, live=clamp(speak * 2))

    face_card(d, (W - 340, 720, W - 80, 960), "present", t)
    caption(d, "Alex asks. The candidate answers by speaking.", 1)
    return im


def ease_in_out_clamp(t):
    t = clamp(t)
    return 4 * t * t * t if t < 0.5 else 1 - ((-2 * t + 2) ** 3) / 2


AI_Q2 = "That makes sense. Next question: write a function to reverse a linked list."

# (color, text) tokens. Colors set below.
KW = (198, 176, 255)
NAME = (255, 214, 140)
PLAIN = (236, 234, 228)
CMT = (140, 158, 130)

CODE_LINES = [
    [(CMT, "// reverse a singly linked list")],
    [(KW, "function "), (NAME, "reverseList"), (PLAIN, "(head) {")],
    [(KW, "  let "), (PLAIN, "prev = "), (KW, "null"), (PLAIN, ";")],
    [(KW, "  let "), (PLAIN, "curr = head;")],
    [(KW, "  while "), (PLAIN, "(curr) {")],
    [(KW, "    const "), (PLAIN, "next = curr.next;")],
    [(PLAIN, "    curr.next = prev;")],
    [(PLAIN, "    prev = curr;")],
    [(PLAIN, "    curr = next;")],
    [(PLAIN, "  }")],
    [(KW, "  return "), (PLAIN, "prev;")],
    [(PLAIN, "}")],
]


def code_char_count():
    return sum(len(tok) for line in CODE_LINES for _, tok in line) + len(CODE_LINES) - 1


def draw_code(d, x, y, nchars, caret=True):
    fnt = F["code"]
    lh = 32
    remaining = nchars
    for li, line in enumerate(CODE_LINES):
        if remaining <= 0:
            break
        cx = x
        # line number
        d.text((x - 36, y + li * lh), str(li + 1), font=F["tiny_r"], fill=(110, 108, 102))
        for color, tok in line:
            if remaining <= 0:
                break
            take = tok if remaining >= len(tok) else tok[:remaining]
            d.text((cx, y + li * lh), take, font=fnt, fill=color)
            cx += fnt.getlength(take)
            remaining -= len(take)
        remaining -= 1  # newline
        if remaining <= 0:
            if caret:
                d.rectangle((cx + 3, y + li * lh + 4, cx + 6, y + li * lh + 24), fill=(242, 240, 234))
            break
    else:
        pass


def scene_code(t, dur):
    im, d = new_frame()
    draw_rail(d, 3)
    interview_header(d, t + 40, "muted")
    q_p = ease_out(seg(t, 0.0, 0.18))
    d.ellipse((72, 196, 108, 232), fill=INK)
    d.text((90, 214), "AI", font=F["tiny"], fill=PAGE, anchor="mm")
    if q_p > 0:
        bubble(d, AI_Q2, 120, 188 + (1 - q_p) * 14, 980, WHITE, INK)

    rise = ease_out_back(seg(t, 0.18, 0.32))
    ex, ey = 120, lerp(1040, 400, rise)
    ew, eh = W - 240, 530
    if rise > 0.02:
        rounded(d, (ex, ey + 8, ex + ew, ey + eh + 8), 20, (40, 38, 34))
        rounded(d, (ex, ey, ex + ew, ey + eh), 20, EDITOR)
        # top bar
        d.text((ex + 24, ey + 16), "Code editor  ·  javascript", font=F["ui"], fill=(210, 208, 200))
        d.text((ex + ew - 24, ey + 16), "Write just the function", font=F["tiny_r"], fill=(140, 138, 130), anchor="ra")
        d.line((ex, ey + 48, ex + ew, ey + 48), fill=(48, 48, 52), width=1)

        total = code_char_count()
        typed = ease_out(seg(t, 0.48, 2.45))
        nchars = int(total * typed)
        if nchars > 0:
            draw_code(d, ex + 64, ey + 68, nchars, caret=typed < 0.992 and int(t * 3) % 2 == 0)

        # Submit
        submit_hot = seg(t, 3.2, 0.16)
        sw, sh = 180, 46
        sx, sy = ex + ew - sw - 22, ey + eh - sh - 18
        bg = tuple(int(lerp(255, 242, submit_hot)) for _ in range(1))
        # white button going slightly warm isn't the brand — black button.
        fill = INK if submit_hot < 0.5 else (40, 38, 34)
        rounded(d, (sx, sy, sx + sw, sy + sh), 23, WHITE if submit_hot < 0.85 else (230, 228, 220))
        d.text((sx + sw / 2, sy + sh / 2), "Submit code", font=F["ui"], fill=INK, anchor="mm")

        cp = seg(t, 3.05, 0.4)
        if cp > 0:
            u = ease_out(min(1, cp / 0.7))
            cx = lerp(sx + sw + 80, sx + sw / 2 + 10, u)
            cy = lerp(sy + 120, sy + sh / 2 + 8, u)
            cursor(d, cx, cy)
            if cp > 0.72:
                click_ring(d, sx + sw / 2, sy + sh / 2, (cp - 0.72) / 0.28)

    caption(d, "A coding question opens the editor. They type the function.", 1)
    return im


def scene_proctor(t, dur):
    im, d = new_frame()
    draw_rail(d, 4)
    # Three beats.
    if t < 1.65:
        state, banner = "noface", "No face detected — please stay visible on camera. This moment is being recorded."
        beat = 0
    elif t < 3.3:
        state, banner = "phone", "A phone or device was detected on camera. This moment is being recorded."
        beat = 1
    else:
        state, banner = "away", "Tab switch / window change detected. This moment is being recorded."
        beat = 2

    interview_header(d, t + 80, "end", banner=banner)

    d.ellipse((72, 210, 108, 246), fill=INK)
    d.text((90, 228), "AI", font=F["tiny"], fill=PAGE, anchor="mm")
    bubble(
        d,
        "Hello, I am Alex from Personal. Let us begin with the first question: explain the difference between a process and a thread.",
        120,
        204,
        780,
        WHITE,
        INK,
    )

    cam = (1160, 360, 1720, 730)
    face_card(d, cam, state, t)

    labels = ["Face leaves the frame", "A phone comes into view", "They leave full screen"]
    d.text(((cam[0] + cam[2]) / 2, cam[3] + 18), labels[beat], font=F["small_m"], fill=INK, anchor="mt")

    if beat == 2:
        dim = Image.new("RGB", (W, H), (28, 26, 24))
        im = Image.blend(im, dim, 0.42)
        d = ImageDraw.Draw(im)
        # Redraw the rail and caption later; modal sits in the dim.
        mw, mh = 560, 280
        mx, my = (W - mw) / 2, (H - mh) / 2 - 10
        pop = ease_out_back(seg(t, 3.3, 0.22))
        my = my + (1 - pop) * 24
        shadow_card(d, (mx, my, mx + mw, my + mh), 22)
        d.text((W / 2, my + 40), "Come back to continue", font=F["h3"], fill=RED, anchor="mt")
        # Countdown inside the copy.
        left = 6 if t < 3.7 else 4 if t < 4.15 else 3
        msg = f"You exited full-screen mode. Return to full-screen within {left}s or the interview will end automatically."
        text_block(d, msg, F["small"], mx + 48, my + 92, mw - 96, DIM, lh=26)
        bw, bh = 320, 52
        bx, by = W / 2 - bw / 2, my + mh - 80
        hot = seg(t, 4.35, 0.14)
        rounded(d, (bx, by + (2 if hot > 0.4 else 0), bx + bw, by + bh + (2 if hot > 0.4 else 0)), 26, INK)
        d.text((W / 2, by + bh / 2 + (2 if hot > 0.4 else 0)), "I'm back — resume", font=F["small_m"], fill=PAGE, anchor="mm")
        cp = seg(t, 4.05, 0.38)
        if cp > 0 and t < 4.55:
            u = ease_out(min(1, cp / 0.7))
            cursor(d, lerp(bx + bw + 120, W / 2 + 20, u), lerp(by + 140, by + bh / 2 + 6, u))
            if cp > 0.72:
                click_ring(d, W / 2, by + bh / 2, (min(1, cp) - 0.72) / 0.28)
        if t > 4.55:
            # Cover the modal with a confirmation chip once they resume.
            im, d = new_frame()
            draw_rail(d, 4)
            interview_header(d, t + 80, "voice")
            d.ellipse((72, 210, 108, 246), fill=INK)
            d.text((90, 228), "AI", font=F["tiny"], fill=PAGE, anchor="mm")
            bubble(d, "Good — you're back on camera and in full screen. Let's continue.", 120, 204, 820, WHITE, INK)
            face_card(d, (1160, 360, 1720, 730), "present", t)
            chip_w = 420
            rounded(d, ((W - chip_w) / 2, 800, (W + chip_w) / 2, 852), 26, GREEN_SOFT)
            d.text((W / 2, 826), "Back in full screen. Interview resumed.", font=F["small_m"], fill=GREEN, anchor="mm")

    caption(d, "Proctoring flags a missing face, a phone, or leaving the screen.", 1)
    return im


def scene_end(t, dur):
    im, d = new_frame()
    p = ease_out(seg(t, 0.1, 0.5))
    d.text((W / 2, 230 + (1 - p) * 20), "Then the session is scored.", font=F["h1"], fill=INK, anchor="mm")
    d.text(
        (W / 2, 290),
        "Communication, technical, problem-solving, and overall — with areas to improve.",
        font=F["small"],
        fill=DIM,
        anchor="mm",
    )
    cards = [
        ("Communication", "How clearly the answer landed"),
        ("Technical", "Depth on process and thread"),
        ("Problem-solving", "Reversing the list, in code"),
        ("Overall", "The screen, taken together"),
    ]
    cw, ch, gap = 360, 210, 24
    total = 4 * cw + 3 * gap
    x = (W - total) / 2
    y = 348
    for i, (title, sub) in enumerate(cards):
        ip = ease_out(seg(t, 0.08 + i * 0.08, 0.2))
        if ip <= 0:
            x += cw + gap
            continue
        yy = y + (1 - ip) * 24
        shadow_card(d, (x, yy, x + cw, yy + ch), 22)
        d.text((x + 28, yy + 26), f"0{i + 1}", font=F["tiny"], fill=FAINT)
        d.text((x + 28, yy + 54), title, font=F["h3"], fill=INK)
        d.text((x + 28, yy + 100), sub, font=F["small"], fill=DIM)
        fill_p = ease_out(seg(t, 0.35, 0.4))
        bar_y = yy + 162
        rounded(d, (x + 28, bar_y, x + cw - 28, bar_y + 8), 4, LINE)
        mw = (cw - 56) * fill_p * (0.72 + 0.06 * i)
        if mw > 2:
            rounded(d, (x + 28, bar_y, x + 28 + mw, bar_y + 8), 4, INK)
        x += cw + gap

    end_p = ease_out(seg(t, 0.85, 0.25))
    if end_p > 0:
        col = tuple(int(lerp(PAGE[i], INK[i], end_p)) for i in range(3))
        logo_mark(d, W / 2 - 18, 680, 36)
        d.text((W / 2, 752), "EvaluLabs", font=F["h2"], fill=col, anchor="mm")
        d.text((W / 2, 800), "evalulabs.com", font=F["small"], fill=FAINT, anchor="mm")
    caption(d, "The interview closes with a score across four areas.", ease_out(seg(t, 0.3, 0.4)))
    return im


SCENES = [
    (3.4, scene_email),
    (3.3, scene_consent),
    (4.2, scene_voice),
    (4.2, scene_code),
    (5.6, scene_proctor),
    (2.6, scene_end),
]

# Zooms are punches on the action, then straight back out. No slow drift.
CAMERAS = [
    [
        (0.00, 1.00, 0.50, 0.42),
        (1.05, 1.00, 0.50, 0.42),
        (1.28, 1.50, 0.32, 0.46),
        (2.85, 1.50, 0.32, 0.46),
        (3.10, 1.00, 0.50, 0.42),
    ],
    [
        (0.00, 1.00, 0.50, 0.50),
        (1.70, 1.00, 0.50, 0.50),
        (1.92, 1.46, 0.50, 0.74),
        (2.85, 1.46, 0.50, 0.74),
        (3.10, 1.00, 0.50, 0.55),
    ],
    [(0.0, 1.00, 0.50, 0.45), (4.2, 1.00, 0.50, 0.45)],
    [
        (0.00, 1.00, 0.50, 0.50),
        (3.15, 1.00, 0.50, 0.50),
        (3.38, 1.40, 0.78, 0.76),
        (3.95, 1.40, 0.78, 0.76),
        (4.15, 1.00, 0.50, 0.55),
    ],
    [
        (0.00, 1.00, 0.50, 0.40),
        (0.08, 1.22, 0.52, 0.30),
        (0.70, 1.22, 0.52, 0.30),
        (0.92, 1.00, 0.50, 0.42),
        (1.65, 1.00, 0.50, 0.42),
        (1.78, 1.22, 0.66, 0.48),
        (2.45, 1.22, 0.66, 0.48),
        (2.68, 1.00, 0.50, 0.45),
        (3.30, 1.00, 0.50, 0.45),
        (3.48, 1.28, 0.48, 0.48),
        (4.35, 1.28, 0.48, 0.48),
        (4.58, 1.00, 0.50, 0.45),
    ],
    [(0.0, 1.00, 0.50, 0.48), (2.6, 1.00, 0.50, 0.48)],
]
DURATION = sum(d for d, _ in SCENES)
FADE = 0.18


def interp_cam(t, keys):
    if t <= keys[0][0]:
        return keys[0][1], keys[0][2], keys[0][3]
    for i in range(len(keys) - 1):
        t0, z0, x0, y0 = keys[i]
        t1, z1, x1, y1 = keys[i + 1]
        if t <= t1:
            u = clamp((t - t0) / (t1 - t0)) if t1 > t0 else 1
            p = ease_out(u)
            return lerp(z0, z1, p), lerp(x0, x1, p), lerp(y0, y1, p)
    last = keys[-1]
    return last[1], last[2], last[3]


def zoom_frame(im, z, fx, fy):
    z = max(1.0, z)
    if z <= 1.012:
        return im
    w, h = im.size
    vw, vh = w / z, h / z
    cx = min(max(fx * w, vw / 2), w - vw / 2)
    cy = min(max(fy * h, vh / 2), h - vh / 2)
    a = 1 / z
    # Output pixel maps back into the source, centered on the clamped focus.
    c = cx - w / (2 * z)
    f = cy - h / (2 * z)
    return im.transform(
        (w, h),
        Image.Transform.AFFINE,
        (a, 0, c, 0, a, f),
        resample=Image.Resampling.BICUBIC,
    )


def frame_scene(i, local):
    dur, fn = SCENES[i]
    img = fn(max(0.0, local), dur)
    z, fx, fy = interp_cam(max(0.0, local), CAMERAS[i])
    return zoom_frame(img, z, fx, fy)


def scene_at(t):
    acc = 0.0
    for i, (dur, _fn) in enumerate(SCENES):
        if t < acc + dur or i == len(SCENES) - 1:
            local = t - acc
            img = frame_scene(i, local)
            if i < len(SCENES) - 1 and local > dur - FADE:
                p = ease_out((local - (dur - FADE)) / FADE)
                img2 = frame_scene(i + 1, 0.0)
                img = Image.blend(img, img2, p)
            return img
        acc += dur
    return frame_scene(len(SCENES) - 1, 0.0)


def render_frame(t):
    return scene_at(t)


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "stills":
        times = [float(x) for x in sys.argv[2:]] or [1.5, 4, 8, 14, 18, 24, 32, 40, 48, 55, 62, 70]
        out_dir = ROOT / "motion" / "stills"
        out_dir.mkdir(exist_ok=True)
        for t in times:
            path = out_dir / f"t{t:05.1f}.png"
            render_frame(t).save(path)
            print(path)
        return

    ffmpeg = None
    try:
        import imageio_ffmpeg

        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        ffmpeg = "ffmpeg"

    n = int(DURATION * FPS)
    cmd = [
        ffmpeg,
        "-y",
        "-f",
        "rawvideo",
        "-vcodec",
        "rawvideo",
        "-s",
        f"{W}x{H}",
        "-pix_fmt",
        "rgb24",
        "-r",
        str(FPS),
        "-i",
        "-",
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "18",
        "-movflags",
        "+faststart",
        str(OUT),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        for i in range(n):
            frame = render_frame(i / FPS)
            proc.stdin.write(frame.tobytes())
            if i % FPS == 0:
                print(f"{i // FPS:.0f}s / {DURATION:.0f}s", flush=True)
    finally:
        proc.stdin.close()
        code = proc.wait()
    if code != 0:
        raise SystemExit(code)
    print(OUT)


if __name__ == "__main__":
    main()
