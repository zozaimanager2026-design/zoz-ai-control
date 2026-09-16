const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const briefPath = path.join(root, 'content', 'episode-001-free-autonomous.json');
const outDir = path.join(root, 'artifacts', 'episode-001');
const brief = JSON.parse(fs.readFileSync(briefPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/,/g, '\\,');
const wrap = (text, width = 42) => {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines.join('\n');
};

const narration = String(brief.narration || '').split(/\n{2,}/).map(x => x.trim()).filter(Boolean);
const sceneCount = Math.max(brief.scenes.length, narration.length);
const sceneFiles = [];

for (let i = 0; i < sceneCount; i++) {
  const text = narration[i % narration.length];
  const wav = path.join(outDir, `scene-${String(i + 1).padStart(2, '0')}.wav`);
  const mp4 = path.join(outDir, `scene-${String(i + 1).padStart(2, '0')}.mp4`);
  execFileSync('espeak-ng', ['-v', 'ar', '-s', '145', '-p', '35', '-w', wav, text], { stdio: 'inherit' });
  const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', wav], { encoding: 'utf8' }).trim()) + 0.25;
  const heading = brief.scenes[i % brief.scenes.length];
  const body = wrap(text);
  const filter = [
    `drawtext=text='${esc('ZOZ AI')}' :x=70:y=55:fontsize=30:fontcolor=white`,
    `drawtext=text='${esc(heading)}':x=(w-text_w)/2:y=170:fontsize=42:fontcolor=white:borderw=2:bordercolor=black`,
    `drawtext=text='${esc(body)}':x=90:y=(h-text_h)/2:fontsize=30:line_spacing=14:fontcolor=white:borderw=2:bordercolor=black:box=1:boxcolor=black@0.35:boxborderw=24`,
    `drawtext=text='${esc(`${i + 1} / ${sceneCount}`)}':x=(w-text_w-70):y=h-70:fontsize=24:fontcolor=white`
  ].join(',');
  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=0x0B1020:s=1920x1080:r=30', '-i', wav, '-t', String(seconds), '-vf', filter, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', mp4], { stdio: 'inherit' });
  sceneFiles.push(mp4);
}

const concat = path.join(outDir, 'concat.txt');
fs.writeFileSync(concat, sceneFiles.map(x => `file '${x.replace(/'/g, "'\\''")}'`).join('\n'));
const final = path.join(outDir, 'zoz-ai-episode-001.mp4');
execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', concat, '-c', 'copy', final], { stdio: 'inherit' });
console.log(JSON.stringify({ ok: true, output: final, title: brief.title, targetSeconds: brief.targetSeconds, mode: 'free-independent' }));
