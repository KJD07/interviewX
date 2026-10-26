const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const [,, html, mode, out, ...rest] = process.argv;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + path.resolve(html));
  await page.evaluate(async () => { const L=[]; for (const f of ['Bricolage Grotesque','Instrument Sans','JetBrains Mono']) for (const w of [400,500,600,700,800]) L.push(document.fonts.load(`${w} 40px "${f}"`)); await Promise.all(L); await document.fonts.ready; });
  await page.waitForTimeout(800);
  const ok = await page.evaluate(() => ['Bricolage Grotesque','Instrument Sans','JetBrains Mono'].map(f => document.fonts.check(`700 40px "${f}"`)));
  console.error('fonts', ok);
  if (mode === 'stills') {
    for (const t of rest) {
      await page.evaluate(t => seek(t), parseFloat(t));
      await page.screenshot({ path: `${out}/still_${t}.png` });
    }
  } else {
    const fps = 30, dur = parseFloat(rest[0]);
    const ff = spawn('ffmpeg', ['-y','-loglevel','error','-f','image2pipe','-framerate',String(fps),'-c:v','png','-i','-','-c:v','libx264','-preset','slow','-crf','16','-pix_fmt','yuv420p',out], { stdio: ['pipe','inherit','inherit'] });
    const n = Math.round(fps * dur);
    for (let i = 0; i < n; i++) {
      await page.evaluate(t => seek(t), i / fps);
      const buf = await page.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 150 === 0) console.error('frame', i, '/', n);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close();
})();
