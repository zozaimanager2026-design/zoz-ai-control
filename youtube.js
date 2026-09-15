const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

const YOUTUBE_UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status';

function youtubeConfigured() {
  return Boolean(process.env.YOUTUBE_ACCESS_TOKEN);
}

async function uploadYouTubeVideo({ filePath, title, description = '', tags = [], categoryId = '22', privacyStatus = 'private' }) {
  if (!youtubeConfigured()) return { ok: false, status: 503, error: 'youtube_access_token_missing' };
  if (!filePath) return { ok: false, status: 400, error: 'youtube_file_path_required' };
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return { ok: false, status: 404, error: 'youtube_video_file_not_found' };
  const stat = fs.statSync(resolved);
  const metadata = { snippet: { title: String(title || path.basename(resolved)), description: String(description), categoryId: String(categoryId), ...(Array.isArray(tags) && tags.length ? { tags } : {}) }, status: { privacyStatus: String(privacyStatus || 'private') } };
  const boundary = `zoz-youtube-${Date.now().toString(16)}`;
  const head = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: video/*\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const stream = Readable.toWeb(fs.createReadStream(resolved));
  const body = new ReadableStream({
    async start(controller) {
      controller.enqueue(new Uint8Array(head));
      const reader = stream.getReader();
      try {
        for (;;) { const { value, done } = await reader.read(); if (done) break; controller.enqueue(value); }
        controller.enqueue(new Uint8Array(tail));
        controller.close();
      } catch (e) { controller.error(e); }
    }
  });
  const response = await fetch(YOUTUBE_UPLOAD_URL, { method: 'POST', headers: { Authorization: `Bearer ${process.env.YOUTUBE_ACCESS_TOKEN}`, 'Content-Type': `multipart/related; boundary=${boundary}`, 'Content-Length': String(head.length + stat.size + tail.length) }, body, duplex: 'half' });
  const text = await response.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 500) }; }
  return { ok: response.ok, status: response.status, videoId: data?.id || null, data: response.ok ? { id: data?.id, status: data?.status } : undefined, error: response.ok ? null : 'youtube_upload_rejected' };
}

async function getYouTubeVideoStatus(videoId) {
  if (!youtubeConfigured()) return { ok: false, status: 503, error: 'youtube_access_token_missing' };
  if (!videoId) return { ok: false, status: 400, error: 'youtube_video_id_required' };
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status,processingDetails&id=${encodeURIComponent(videoId)}`, { headers: { Authorization: `Bearer ${process.env.YOUTUBE_ACCESS_TOKEN}` } });
  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: 'youtube_status_check_failed' };
  const item = data?.items?.[0];
  return { ok: Boolean(item), videoId, privacyStatus: item?.status?.privacyStatus || null, uploadStatus: item?.status?.uploadStatus || null, processingStatus: item?.processingDetails?.processingStatus || null, publicUrl: item ? `https://www.youtube.com/watch?v=${videoId}` : null };
}

module.exports = { youtubeConfigured, uploadYouTubeVideo, getYouTubeVideoStatus };
