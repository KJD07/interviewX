# Candidate portal walkthrough video (~2.5 min)

A narrated screen recording of the real candidate portal, step by step: profile from
resume → job preferences → live jobs ranked by match → ATS check → save + apply kit →
application tracker → role practice → mock interviews. (The 38s motion-graphics teaser
is a separate thing, in `../candidate-portal-video/`.)

**Status:** voiceover is incomplete. ElevenLabs keeps disabling the account's free
tier ("unusual activity", likely from the cloud proxy), so only 5 of the 10 scene clips
exist (`vo/`). The video
is published to `frontend/public/videos/` once the other 6 are generated.

## Voiceover (ElevenLabs, voice "Kyle - Engaging, Confident, Authentic", eleven_v4)

One raw clip per scene, saved as `vo/<scene id>.mp3`. The video uses them tightened
for a brisk, pause-free read: `tighten.sh` trims pauses longer than 0.12s to ~0.1s and
speeds the read up 1.10× (pitch preserved), and scenes butt up against each other with
0.2s between them.

| Scene | Clip | Line |
|---|---|---|
| `s01_intro` | ✅ | Here's a quick walkthrough of the EvaluLabs candidate portal. It's everything you need for your job search, from finding the right role to acing the interview, and it's free. Let's take a look. |
| `s02_dashboard` | ✅ | After you sign in, you land on your dashboard. Start with your profile, because everything else builds on it. |
| `s03_profile` | ✅ | Upload your resume once, as a PDF or Word file. EvaluLabs reads it and fills in your whole profile: contact details, skills, experience, education and projects. Anything it missed, you can edit right in place. |
| `s04_prefs` | ✅ | Next, open Job preferences. Add the roles you're targeting, the cities you want to work in, and whether you prefer remote, hybrid or on-site. Together with your skills, these drive your job matches. |
| `s05_jobs` | ⏳ | Now head to Live jobs. These are real openings, pulled straight from company career pages and refreshed every five hours, with India first. Because your profile is set up, every job is ranked by how well it matches you. And you can filter by role, location, work mode or experience at any time. |
| `s06_ats` | ✅ | Open a job to read the full description, then run a free ATS check against your resume. In seconds, you get a score out of a hundred, the keywords you already match, the ones you're missing, and clear tips to improve. |
| `s07_apply` | ⏳ | Save jobs you want to come back to. When you're ready, hit Apply. The apply kit lays out your details as copy-ready fields, so filling in the company's form takes seconds. You can even float it next to the form. Open the application form, and the job is tracked for you automatically. |
| `s08_tracker` | ⏳ | Every application lands in your tracker. Update the status as you move from applied, to interviewing, to offer, and keep notes on dates and contacts. |
| `s09_practice` | ⏳ | Then get ready for the interview. Practice builds a question set for every role you've applied to, with coding, technical, system design and behavioral questions drawn from that job's skills. Type your answer, and get an instant score, the ideas you didn't cover, and an ideal answer to compare against. |
| `s10_outro` | ⏳ | And when you're ready for the real thing, start a full AI mock interview from your dashboard. That's the EvaluLabs candidate portal. Find the job. Beat the ATS. Ace the interview. |

## Recording

`record.js` drives the real app in a Chromium `--app` window on Xvfb (1440×810 CSS px
at 4/3 scale = 1080p, no browser UI) and captures it with ffmpeg `x11grab`. It draws its
own cursor with click rings, step chips and the intro/outro cards, and times each
scene's actions to its clip (a scene with no clip yet uses its `authored` length, and
action times stretch to fit when the real clip is longer or shorter).

Needs the app running locally (frontend on :3000, backend on :8000) with live jobs
swept (`manage.py refresh_jobs`), plus Xvfb, ffmpeg and Playwright. From this directory:

```bash
(cd ../../backend && python manage.py shell < ../marketing/candidate-portal-walkthrough/reset_demo_user.py)  # fresh demo candidate
./tighten.sh vo vo_tight                                    # pause-trimmed, 1.10x clips
node record.js vo_tight out                                 # ~2 min, real time
python3 build.py out walkthrough.mp4 --webm walkthrough.webm --poster walkthrough-poster.jpg
```

Re-run `reset_demo_user.py` before every take — the walkthrough uploads the resume,
saves a job, applies and runs an ATS check, so a reused account starts in the wrong state.
Jobs are live data, so the top match (and its ATS score) can differ between takes.
The practice step types a prepared answer for whichever system design question that
role shows (`practice_answers.json`, each scoring roughly 6.5–8.5/10).

The candidate (Aarav Sharma, `aarav.sharma@example.com`) and the resume
(`Aarav_Sharma_Resume.pdf`, built from `resume.html`) are placeholders.
