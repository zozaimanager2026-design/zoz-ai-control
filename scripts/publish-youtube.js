const fs = require('fs');
const https = require('https');
const path = require('path');

const file = process.argv[2];
if (!file || !fs.existsSync(file)) throw new Error('video_file_missing');
const required = ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'];
for (const key of required) if (!process.env[key]) throw new Error(`${key}_missing`);
const brief = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'episode-001-free-autonomous.json'), 'utf8'));

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve({ data, headers: res.headers });
        else reject(new Error(`http_${res.statusCode}:${data.error?.message || data.raw || 'request_failed'}`));
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  const tokenBody = new URLSearchParams({ client_id: process.env.YOUTUBE_CLIENT_ID, client_secret: process.env.YOUTUBE_CLIENT_SECRET, refresh_token: process.env.YOUTUBE_REFRESH_TOKEN, grant_type: 'refresh_token' }).toString();
  const token = (await request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(tokenBody) } }, tokenBody)).data;
  const metadata = JSON.stringify({ snippet: { title: brief.title, description: brief.description, tags: brief.tags, categoryId: '28' }, status: { privacyStatus: 'public', selfDeclaredMadeForKids: false } });
  const stat = fs.statSync(file);
  const init = await request({ hostname: 'www.googleapis.com', path: '/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable', method: 'POST', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': stat.size, 'Content-Length': Buffer.byteLength(metadata) } }, metadata);
  const location = init.headers.location;
  if (!location) throw new Error('youtube_resumable_location_missing');
  const result = await new Promise((resolve, reject) => {
    const req = https.request(location, { method: 'PUT', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'video/mp4', 'Content-Length': stat.size } }, res => {
      const chunks=[]; res.on('data', c=>chunks.push(c)); res.on('end', ()=>{ const text=Buffer.concat(chunks).toString(); let data; try{data=JSON.parse(text)}catch{data={raw:text}}; if(res.statusCode>=200&&res.statusCode<300) resolve(data); else reject(new Error(`youtube_upload_${res.statusCode}:${data.error?.message||data.raw||''}`)); });
    });
    req.on('error', reject); fs.createReadStream(file).pipe(req);
  });
  console.log(JSON.stringify({ ok: true, stage: 'published', videoId: result.id, url: `https://www.youtube.com/watch?v=${result.id}`, title: brief.title }));
})().catch(error => { console.error(JSON.stringify({ ok: false, stage: 'publish_failed', reason: error.message })); process.exit(1); });
