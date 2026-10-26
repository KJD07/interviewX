# Candidate portal explainer video (38s)

Rendered output lives in `frontend/public/videos/`:
`candidate-portal.mp4` (H.264/AAC, 1080p30), `candidate-portal.webm` (VP9/Opus),
`candidate-portal-poster.jpg`.

Embed:

```html
<video controls playsinline preload="metadata" poster="/videos/candidate-portal-poster.jpg">
  <source src="/videos/candidate-portal.webm" type="video/webm" />
  <source src="/videos/candidate-portal.mp4" type="video/mp4" />
</video>
```

## Voiceover (ElevenLabs, voice "Kyle", eleven_v4) — `vo.mp3`

> Job hunting shouldn't feel like guesswork. Meet the EvaluLabs candidate portal.
> Upload your resume once, and your profile builds itself. Explore forty-five
> thousand live jobs from over eleven hundred company boards, India first, ranked
> by how well you match. Run a free ATS check on any role, and see exactly which
> keywords you're missing. Apply faster with a copy-ready apply kit, and track
> every application in one place. Then practice the exact questions that role is
> likely to ask, and sharpen up with AI mock interviews. EvaluLabs. Get prepared.
> Get hired.

## Re-rendering

`index.html` is a deterministic animation: `seek(t)` sets every element for time
`t`, with scene times matched to the voiceover (which starts at 0.4s). From this
directory:

```bash
node render.js index.html full silent.mp4 38          # needs playwright + ffmpeg
node render.js index.html stills . 9.5 18 30          # preview single frames
ffmpeg -i vo.mp3 -af "adelay=400|400,loudnorm=I=-16:TP=-1.5:LRA=11,apad" -t 38 -ar 48000 vo_mix.wav
ffmpeg -i silent.mp4 -i vo_mix.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 20 \
  -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart -shortest candidate-portal.mp4
```

Company names in the mock UI (Nimbus Pay, Kite Labs, Cloudnine, Orbit Analytics)
and the candidate (Aarav Sharma) are placeholders.
