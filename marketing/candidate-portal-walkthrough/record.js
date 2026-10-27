// Screen-records the candidate portal walkthrough against the running app.
//
//   node record.js <vo-dir> <out-dir>
//
// Needs Xvfb, ffmpeg and playwright, the app on BASE (default http://localhost:3000)
// and a freshly reset demo user (reset_demo_user.py). Each scene's actions are timed
// against its voiceover clip (<vo-dir>/<scene id>.mp3, tightened by tighten.sh); action
// times are written against the scene's `authored` length and stretched to the real
// clip. A scene without a clip yet runs for its `line` at the tightened reading pace. Writes <out-dir>/screen.mkv plus
// <out-dir>/timeline.json (scene start times, seconds after the sync flash).
// STOP_AFTER=<scene id> ends the run after that scene (for checking one scene).
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:3000';
const API = process.env.API || 'http://localhost:8000';
const EMAIL = 'aarav.sharma@example.com';
const PASSWORD = 'DemoPass#2026';
const RESUME = path.join(__dirname, 'Aarav_Sharma_Resume.pdf');
const ANSWERS = JSON.parse(fs.readFileSync(path.join(__dirname, 'practice_answers.json'), 'utf8'));
const DISPLAY = ':99';
const W = 1920, H = 1080, SCALE = 4 / 3; // 1440x810 CSS px, rendered at 1080p
const LEAD = 0.05, TAIL = 0.15;            // silence before/after each clip — keep it brisk
// A scene without a clip yet runs at its line's expected length at the tightened pace
// (tighten.sh: short pauses, 1.10x) — about 3.25 words a second.
const WORDS_PER_SEC = 3.25;

const [voDir = 'vo', outDir = 'out'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clipLength = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

// ---- in-page overlays: cursor, click rings, step chip, title cards, sync flash ----
const overlays = () => {
  const css = `
    ::-webkit-scrollbar{display:none} html{scrollbar-width:none}
    #__cur{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;will-change:transform}
    #__cur svg{display:block;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))}
    .__ring{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #9DBA1E;
      background:rgba(216,250,75,.35);z-index:2147483646;pointer-events:none;animation:__ring .55s ease-out forwards}
    @keyframes __ring{from{transform:scale(.25);opacity:1}to{transform:scale(1.25);opacity:0}}
    #__chip{position:fixed;top:22px;right:28px;z-index:2147483640;display:flex;align-items:center;gap:12px;
      padding:10px 18px 10px 12px;border-radius:999px;background:#0C0C0B;color:#F2F0EA;pointer-events:none;
      font:600 15px/1 'Bricolage Grotesque',system-ui,sans-serif;letter-spacing:-.01em;box-shadow:0 12px 32px rgba(12,12,11,.25);
      opacity:0;transform:translateY(-10px);transition:opacity .45s ease,transform .45s ease}
    #__chip.on{opacity:1;transform:none}
    #__chip b{font:700 11px/1 ui-monospace,'JetBrains Mono',monospace;letter-spacing:.14em;color:#0C0C0B;background:#D8FA4B;
      padding:6px 9px;border-radius:999px}
    #__card{position:fixed;inset:0;z-index:2147483645;background:#0C0C0B;color:#F2F0EA;display:flex;flex-direction:column;
      align-items:center;justify-content:center;text-align:center;transition:opacity .9s ease;pointer-events:none}
    #__card .brand{display:flex;align-items:center;gap:14px;font:600 30px 'Bricolage Grotesque',system-ui,sans-serif;letter-spacing:-.02em}
    #__card .brand img{width:52px;height:52px;border-radius:12px}
    #__card h1{margin:34px 0 0;font:800 78px/1.02 'Bricolage Grotesque',system-ui,sans-serif;letter-spacing:-.045em;max-width:1100px}
    #__card h1 em{font-style:normal;color:#D8FA4B}
    #__card p{margin:28px 0 0;font:600 14px ui-monospace,'JetBrains Mono',monospace;letter-spacing:.2em;color:#D8FA4B;text-transform:uppercase}
    #__card .url{margin-top:44px;font:600 22px 'Bricolage Grotesque',system-ui,sans-serif;color:#F2F0EA;opacity:.85}
    #__sync{position:fixed;inset:0;z-index:2147483647;background:#FF00FF}`;
  const install = () => {
    if (document.getElementById('__cur')) return;
    const st = document.createElement('style');
    st.textContent = css;
    document.documentElement.appendChild(st);
    const c = document.createElement('div');
    c.id = '__cur';
    c.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 2v17.2l4.6-4.3 3.1 6.8 2.9-1.3-3.1-6.7h6.3z" fill="#0C0C0B" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(c);
    const p = window.__curPos || { x: -200, y: -200 };
    c.style.transform = `translate(${p.x - 5}px,${p.y - 2.5}px)`;
  };
  document.addEventListener('mousemove', (e) => {
    window.__curPos = { x: e.clientX, y: e.clientY };
    const c = document.getElementById('__cur');
    if (c) c.style.transform = `translate(${e.clientX - 5}px,${e.clientY - 2.5}px)`;
  }, true);
  document.addEventListener('mousedown', (e) => {
    const r = document.createElement('div');
    r.className = '__ring';
    r.style.left = e.clientX + 'px';
    r.style.top = e.clientY + 'px';
    document.documentElement.appendChild(r);
    setTimeout(() => r.remove(), 650);
  }, true);
  // Chrome shows the hovered link's URL in a status bubble; park the href while hovered.
  // Next.js <Link> navigates from its props, so clicks still work.
  document.addEventListener('mouseover', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    a.dataset.parkedHref = a.getAttribute('href');
    a.removeAttribute('href');
    a.addEventListener('mouseleave', () => { a.setAttribute('href', a.dataset.parkedHref); }, { once: true });
  }, true);
  // Keep "Open application form" from navigating away mid-recording; React's onClick still runs.
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[target=_blank]');
    if (a) e.preventDefault();
  }, true);
  window.__chip = (step, text) => {
    let el = document.getElementById('__chip');
    if (!el) { el = document.createElement('div'); el.id = '__chip'; document.documentElement.appendChild(el); }
    el.innerHTML = (step ? `<b>${step}</b>` : '') + text;
    requestAnimationFrame(() => el.classList.add('on'));
  };
  window.__chipOff = () => { const el = document.getElementById('__chip'); if (el) el.classList.remove('on'); };
  window.__card = (html, visible) => {
    let el = document.getElementById('__card');
    if (!el) { el = document.createElement('div'); el.id = '__card'; document.documentElement.appendChild(el); }
    el.innerHTML = html;
    el.style.transition = visible ? 'none' : '';
    el.style.opacity = visible ? '1' : '0';
    void el.offsetWidth;
    el.style.transition = '';
  };
  window.__cardFade = (to) => { const el = document.getElementById('__card'); if (el) el.style.opacity = String(to); };
  window.__sync = (on) => {
    let el = document.getElementById('__sync');
    if (on && !el) { el = document.createElement('div'); el.id = '__sync'; document.documentElement.appendChild(el); }
    if (!on && el) el.remove();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
};

const brand = `<div class="brand"><img src="${BASE}/icon.png" alt="">EvaluLabs</div>`;
const INTRO = `${brand}<h1>The candidate portal,<br><em>step by step</em></h1><p>Live jobs · ATS check · Apply kit · Tracker · Practice</p>`;
const OUTRO = `${brand}<h1>Find the job. Beat the ATS.<br><em>Ace the interview.</em></h1><p>Free candidate portal · AI mock interviews</p><div class="url">evalulabs.com</div>`;

(async () => {
  // ---- browser on a virtual display, captured with x11grab ----
  const xvfb = global.xvfb = spawn('Xvfb', [DISPLAY, '-screen', '0', `${W}x${H}x24`, '-nolisten', 'tcp'], { stdio: 'ignore' });
  await sleep(800);
  // An --app window has no tab strip or address bar; its size is in CSS px, so 1440x810 fills the 1080p display.
  const profileDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'walkthrough-'));
  const ctx = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: null,
    env: { ...process.env, DISPLAY },
    args: [`--app=${BASE}/login`, `--window-size=${W / SCALE},${H / SCALE}`, '--window-position=0,0',
           `--force-device-scale-factor=${SCALE}`, '--no-first-run', '--disable-features=Translate'],
  });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await ctx.addInitScript(overlays);
  const page = ctx.pages()[0] || await ctx.waitForEvent('page');

  // Sign in before the camera rolls (through the API, so no browser password prompt);
  // the walkthrough starts on the dashboard.
  page.setDefaultTimeout(12000);
  const post = (url, body, token) => fetch(API + url, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => r.json());
  const { access, refresh } = await post('/api/auth/login/', { email: EMAIL, password: PASSWORD });
  const me = await post('/api/auth/me/', null, access);
  await page.goto(`${BASE}/login`);
  await page.evaluate(([a, r, u]) => {
    localStorage.setItem('ix_access', a);
    localStorage.setItem('ix_refresh', r);
    localStorage.setItem('ix_user', u);
  }, [access, refresh, JSON.stringify(me)]);
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  await page.waitForLoadState('networkidle');
  await page.evaluate((h) => window.__card(h, true), INTRO);
  await page.evaluate(() => document.fonts.ready);
  await sleep(1200);

  // ---- cursor + interaction helpers ----
  let cur = { x: 1500, y: 900 };
  let pace = 1; // the current scene's stretch; movement speeds up with the read
  await page.mouse.move(cur.x, cur.y);
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const moveTo = async (x, y, ms = 700) => {
    ms *= pace;
    const s = { ...cur }, t0 = Date.now();
    for (;;) {
      const k = Math.min(1, (Date.now() - t0) / ms), e = ease(k);
      await page.mouse.move(s.x + (x - s.x) * e, s.y + (y - s.y) * e);
      if (k >= 1) break;
      await sleep(12);
    }
    cur = { x, y };
  };
  const center = async (loc, fx = 0.5, fy = 0.5) => {
    const b = await loc.boundingBox();
    if (!b) throw new Error('not visible: ' + loc);
    return { x: b.x + b.width * fx, y: b.y + b.height * fy };
  };
  const hover = async (loc, ms = 700, fx, fy) => { const p = await center(loc, fx, fy); await moveTo(p.x, p.y, ms); };
  const click = async (loc, ms = 700, fx, fy) => {
    await hover(loc, ms, fx, fy);
    await sleep(140);
    await page.mouse.down();
    await sleep(80);
    await page.mouse.up();
  };
  // Cosmetic pointing: if the element isn't there (live data varies), log it and carry on.
  const soft = async (fn) => { try { await fn(); } catch (e) { console.error('  skipped:', e.message.split('\n')[0]); } };
  const type = (text, delay = 55) => page.keyboard.type(text, { delay: Math.round(delay * pace) });
  const scrollBy = (dy, ms = 1000) => page.evaluate(([dy, ms]) => new Promise((res) => {
    const s = window.scrollY, t0 = performance.now();
    const f = (t) => {
      const k = Math.min(1, (t - t0) / ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      window.scrollTo(0, s + dy * e);
      if (k < 1) requestAnimationFrame(f); else res();
    };
    requestAnimationFrame(f);
  }), [dy, ms * pace]);
  const scrollTo = async (loc, top = 120, ms = 1000) => { const b = await loc.boundingBox(); await scrollBy(b.y - top, ms); };
  const chip = async (step, text, ms = 3000) => {
    await page.evaluate(([s, t]) => window.__chip(s, t), [step, text]);
    setTimeout(() => page.evaluate(() => window.__chipOff()).catch(() => {}), ms);
  };
  const nav = (name) => page.locator('aside, nav').getByRole('link', { name, exact: true }).first();
  const firstCard = () => page.locator('li.ui-card').first();

  // ---- scenes: action times are seconds into the scene's voiceover ----
  const SCENES = [
    { id: 's01_intro', authored: 11.89,
      line: "Here's a quick walkthrough of the EvaluLabs candidate portal. It's everything you need for your job search, from finding the right role to acing the interview, and it's free. Let's take a look.", run: async ({ at }) => {
      await at(4.6); await page.evaluate(() => window.__cardFade(0));
      await at(5.6); await moveTo(900, 520, 1100);
      await at(8.6); await soft(() => hover(page.getByRole('heading', { name: 'Dashboard' }), 900));
    } },
    { id: 's02_dashboard', authored: 7.2,
      line: "After you sign in, you land on your dashboard. Start with your profile, because everything else builds on it.", run: async ({ at }) => {
      await at(0.2); await soft(() => hover(page.getByText('Mock interview', { exact: true }), 700));
      await at(1.4); await soft(() => hover(page.getByText('Typed practice', { exact: true }), 600));
      await at(2.4); await soft(() => hover(page.getByText('Live jobs', { exact: true }).last(), 600));
      await at(3.6); await click(nav('Profile'), 900);
      await page.waitForURL(/profile/);
    } },
    { id: 's03_profile', authored: 15.31,
      line: "Upload your resume once, as a PDF or Word file. EvaluLabs reads it and fills in your whole profile: contact details, skills, experience, education and projects. Anything it missed, you can edit right in place.", run: async ({ at }) => {
      await chip('STEP 1', 'Build your profile from your resume');
      await at(0.4); await soft(() => hover(page.getByText('Upload your resume', { exact: true }), 800));
      await at(1.4);
      const chooser = page.waitForEvent('filechooser');
      await click(page.getByText('Upload your resume', { exact: true }), 200);
      await (await chooser).setFiles(RESUME);
      await page.getByText('Profile filled in from your resume').waitFor({ timeout: 15000 });
      await at(4.0); await scrollTo(page.getByRole('heading', { name: 'Basic details' }), 40, 1300);
      await at(6.4); await scrollTo(page.getByRole('heading', { name: 'Skills' }), 60, 1200);
      await at(7.8); await scrollTo(page.getByRole('heading', { name: 'Experience' }), 40, 1100);
      await at(9.0); await scrollTo(page.getByRole('heading', { name: 'Education' }), 40, 1000);
      await at(10.0); await scrollTo(page.getByRole('heading', { name: 'Projects' }), 140, 900);
      await at(11.2); await scrollTo(page.getByRole('heading', { name: 'Basic details' }), 40, 1100);
      await at(12.3); await click(page.getByLabel('Current location'), 700);
      await type('Bengaluru, India', 50);
      await at(14.4); await click(page.getByRole('button', { name: 'Save profile' }), 800);
    } },
    { id: 's04_prefs', authored: 13.17,
      line: "Next, open Job preferences. Add the roles you're targeting, the cities you want to work in, and whether you prefer remote, hybrid or on-site. Together with your skills, these drive your job matches.", run: async ({ at }) => {
      await chip('STEP 2', 'Tell it what you want');
      await at(0.1); await scrollBy(-(await page.evaluate(() => window.scrollY)), 800);
      await at(0.9); await click(page.getByRole('button', { name: 'Job preferences' }), 800);
      const roles = page.getByPlaceholder('e.g. Backend Engineer');
      await at(2.3); await click(roles, 700);
      await type('Backend Engineer'); await page.keyboard.press('Enter');
      await type('Python Developer'); await page.keyboard.press('Enter');
      await at(5.6); await click(page.getByPlaceholder('e.g. Bengaluru'), 600);
      await type('Bengaluru'); await page.keyboard.press('Enter');
      await at(7.7); await click(page.getByRole('button', { name: 'Remote', exact: true }), 600);
      await at(8.5); await click(page.getByRole('button', { name: 'Hybrid', exact: true }), 500);
      await at(10.8); await click(page.getByRole('button', { name: 'Save preferences' }), 800);
    } },
    { id: 's05_jobs', authored: 19.6,
      line: "Now head to Live jobs. These are real openings, pulled straight from company career pages and refreshed every five hours, with India first. Because your profile is set up, every job is ranked by how well it matches you. And you can filter by role, location, work mode or experience at any time.", run: async ({ at }) => {
      await at(0.4); await click(nav('Live jobs'), 900);
      await page.waitForURL(/jobs/);
      await chip('STEP 3', 'Live jobs, ranked for you');
      await firstCard().getByText(/% match/).waitFor({ timeout: 20000 });
      await at(2.8); await soft(() => hover(page.getByText(/open roles from/), 900, 0.3));
      await at(6.4); await soft(() => hover(page.getByRole('button', { name: 'India & remote-friendly' }), 800));
      await at(8.4); await scrollTo(firstCard(), 150, 1400);
      await at(10.3); await soft(() => hover(firstCard().getByText(/% match/), 800));
      await at(12.0); await soft(() => hover(page.locator('li.ui-card').nth(1).getByText(/% match/), 700));
      await at(13.9); await scrollTo(page.getByPlaceholder(/Job titles, skills or companies/), 200, 1000);
      await at(15.0); await soft(() => hover(page.getByPlaceholder(/Job titles, skills or companies/), 600, 0.25));
      await at(15.9); await soft(() => hover(page.getByPlaceholder(/Locations/), 600, 0.3));
      await at(16.8); await soft(() => hover(page.getByRole('button', { name: 'Hybrid', exact: true }), 600));
      await at(17.7); await soft(() => hover(page.getByLabel('Maximum years of experience'), 700, 0.5));
    } },
    { id: 's06_ats', authored: 13.32,
      line: "Open a job to read the full description, then run a free ATS check against your resume. In seconds, you get a score out of a hundred, the keywords you already match, the ones you're missing, and clear tips to improve.", run: async ({ at }) => {
      await chip('STEP 4', 'Check your ATS score');
      await at(0.1); await scrollTo(firstCard(), 24, 1000);
      await at(1.2); await click(firstCard().getByRole('button', { name: 'Details & ATS' }), 800);
      await page.getByText('About the role').first().waitFor();
      await at(2.6); await soft(() => hover(page.getByText('About the role').first(), 700, 0.5, 4));
      const check = page.getByRole('button', { name: 'Check ATS score' });
      await at(3.6); await click(check, 800);
      await page.getByText('ATS score', { exact: true }).waitFor({ timeout: 20000 });
      await at(5.6); await soft(() => hover(page.getByText('ATS score', { exact: true }), 700, -2));
      await at(7.0); await scrollTo(page.getByText('ATS score', { exact: true }), 150, 1100);
      await at(8.3); await soft(() => hover(page.getByText('Matched', { exact: true }).locator('xpath=following-sibling::*[1]'), 700, 0.15));
      await at(9.7); await soft(() => hover(page.getByText(/^Missing —/).first().locator('xpath=following-sibling::*[1]'), 700, 0.2));
      await at(11.4); await soft(() => hover(page.getByText('How to improve', { exact: true }).locator('xpath=following-sibling::*[1]'), 800, 0.4, 0.2));
    } },
    { id: 's07_apply', authored: 20.4,
      line: "Save jobs you want to come back to. When you're ready, hit Apply. The apply kit lays out your details as copy-ready fields, so filling in the company's form takes seconds. You can even float it next to the form. Open the application form, and the job is tracked for you automatically.", run: async ({ at }) => {
      await chip('STEP 5', 'Save, then apply with the apply kit');
      await at(0.1); await scrollTo(firstCard(), 24, 900);
      await at(1.0); await click(firstCard().getByRole('button', { name: /Save/ }), 700);
      await at(3.6); await click(firstCard().getByRole('button', { name: /Apply/ }), 800);
      await page.getByText('Open application form ↗').waitFor();
      await at(5.6); await soft(() => hover(page.getByText('Full name', { exact: true }), 700));
      await at(6.6); await click(page.getByRole('button', { name: 'Copy', exact: true }).first(), 600);
      await at(8.0); await click(page.getByRole('button', { name: 'Copy', exact: true }).nth(3), 700);
      await at(11.4); await soft(() => hover(page.getByRole('button', { name: /Float this panel/ }), 800));
      await at(14.0); await click(page.getByText('Open application form ↗'), 800);
      await at(15.6);
      if (await page.getByRole('button', { name: 'Close' }).isVisible()) await click(page.getByRole('button', { name: 'Close' }), 700);
      await at(17.0); await soft(() => hover(firstCard().getByText('Applied ✓'), 800));
    } },
    { id: 's08_tracker', authored: 10.2,
      line: "Every application lands in your tracker. Update the status as you move from applied, to interviewing, to offer, and keep notes on dates and contacts.", run: async ({ at }) => {
      await at(0.2); await click(nav('Profile'), 800);
      await page.waitForURL(/profile/);
      await chip('STEP 6', 'Track every application');
      await at(1.4); await click(page.getByRole('button', { name: 'Applications' }), 700);
      const status = page.locator('select').first();
      await status.waitFor();
      await at(3.2); await soft(() => hover(page.getByText('APPLIED', { exact: true }).or(page.getByText('Applied', { exact: true })).first(), 700));
      await at(4.6); await soft(() => hover(status, 700));
      await status.selectOption('interviewing');
      await at(7.0); await click(page.getByPlaceholder(/Notes/), 700);
      await type('Recruiter call Thu 11am · Priya (TA)', 40);
    } },
    { id: 's09_practice', authored: 18.9,
      line: "Then get ready for the interview. Practice builds a question set for every role you've applied to, with coding, technical, system design and behavioral questions drawn from that job's skills. Type your answer, and get an instant score, the ideas you didn't cover, and an ideal answer to compare against.", run: async ({ at }) => {
      await at(0.2); await click(page.locator('a[href^="/practice?app="]').first(), 800);
      await page.waitForURL(/practice/);
      await chip('STEP 7', 'Practice for that exact role');
      await page.getByText('Covers').waitFor({ timeout: 20000 });
      await at(3.0); await soft(() => hover(page.getByText('Covers'), 800, 4));
      await at(5.0); await soft(() => hover(page.getByRole('button', { name: /^Coding/ }), 600));
      await at(6.0); await soft(() => hover(page.getByRole('button', { name: /^Technical/ }), 500));
      await at(7.0); await soft(() => hover(page.getByRole('button', { name: /^System design/ }), 500));
      await at(8.0); await soft(() => hover(page.getByRole('button', { name: /^Behavioral/ }), 500));
      await at(9.2); await click(page.getByRole('button', { name: /^System design/ }), 600);
      // Type the prepared answer for whichever system design question is showing (practice_answers.json).
      const shown = await page.locator('p.font-display').filter({ hasText: /^Design / }).first().innerText();
      const prepared = ANSWERS.find((a) => shown.startsWith(a.question)) || ANSWERS[0];
      await at(10.6); await click(page.getByPlaceholder(/Type your answer/), 500);
      await type(prepared.answer, 4);
      await at(14.6); await click(page.getByRole('button', { name: 'Validate answer' }), 700);
      await page.getByText('YOUR SCORE', { exact: true }).or(page.getByText('Your score', { exact: true })).first().waitFor({ timeout: 15000 });
      await at(15.8); await scrollBy(330, 1000);
      await at(16.9); await soft(() => hover(page.getByText("Ideas you didn't cover"), 700, 0.5));
      await at(18.0); await click(page.getByText('Show ideal answer'), 700);
    } },
    { id: 's10_outro', authored: 12.0,
      line: "And when you're ready for the real thing, start a full AI mock interview from your dashboard. That's the EvaluLabs candidate portal. Find the job. Beat the ATS. Ace the interview.", run: async ({ at }) => {
      await at(0.3); await click(nav('Dashboard'), 900);
      await page.waitForURL(/dashboard/);
      await at(2.4); await soft(() => hover(page.getByRole('link', { name: /Start interview/ }).or(page.getByRole('button', { name: /Start interview/ })).first(), 900));
      await at(4.6); await page.evaluate((h) => { window.__card(h, false); requestAnimationFrame(() => window.__cardFade(1)); }, OUTRO);
      await at(5.4); await page.evaluate(() => { document.getElementById('__cur').style.opacity = '0'; });
    } },
  ];

  for (const s of SCENES) {
    const f = path.join(voDir, `${s.id}.mp3`);
    s.vo = fs.existsSync(f) ? f : null;
    s.dur = s.vo ? clipLength(f) : s.line.split(/\s+/).length / WORDS_PER_SEC;
  }

  const ff = global.ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'x11grab', '-draw_mouse', '0', '-framerate', '30',
    '-video_size', `${W}x${H}`, '-i', `${DISPLAY}.0`, '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '10',
    '-pix_fmt', 'yuv444p', path.join(outDir, 'screen.mkv')], { stdio: ['pipe', 'inherit', 'inherit'] });
  await sleep(1500);
  // Magenta flash marks t=0: the first frame after it is the start of the edit.
  await page.evaluate(() => window.__sync(true));
  await sleep(400);
  await page.evaluate(() => window.__sync(false));
  const t0 = Date.now();

  const timeline = [];
  for (const s of SCENES) {
    const start = Date.now();
    const stretch = s.dur / s.authored;
    pace = Math.min(1, stretch);
    const at = async (t) => { const w = start + (LEAD + t * stretch) * 1000 - Date.now(); if (w > 0) await sleep(w); };
    timeline.push({ id: s.id, start: (start - t0) / 1000, vo: s.vo, dur: s.dur, voiced: !!s.vo });
    console.error(`${s.id} @ ${((start - t0) / 1000).toFixed(2)}s (${s.dur.toFixed(2)}s${s.vo ? '' : ', no clip yet'})`);
    await s.run({ at });
    if (process.env.STOP_AFTER === s.id) break;
    const over = (Date.now() - start) / 1000 - (LEAD + s.dur + TAIL);
    if (over > 0) console.error(`  ${s.id} actions ran ${over.toFixed(2)}s past its clip`);
    await at((s.dur + TAIL) / stretch);
  }
  await sleep(1200);
  const total = (Date.now() - t0) / 1000;
  fs.writeFileSync(path.join(outDir, 'timeline.json'), JSON.stringify({ total, scenes: timeline }, null, 2));

  ff.stdin.write('q');
  await new Promise((r) => ff.on('close', r));
  await ctx.close();
  fs.rmSync(profileDir, { recursive: true, force: true });
  xvfb.kill();
})().catch((e) => {
  console.error(e);
  if (global.ff) global.ff.kill('SIGINT');
  if (global.xvfb) global.xvfb.kill();
  setTimeout(() => process.exit(1), 1500);
});
