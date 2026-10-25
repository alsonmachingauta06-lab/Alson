import fetch from 'node-fetch';
import yts from 'yt-search';
import { sendInteractive } from '../../lib/sendInteractive.js';

const NEXRAY_MP3 = 'https://api.nexray.web.id/downloader/ytmp3?url=';
const MAX_AUDIO_BYTES = 30 * 1024 * 1024;

function extractYtId(input) {
try {
const url = new URL(
/^https?:///i.test(input) ? input : "https://${input}"
);

const host = url.hostname.replace(/^(www\.|m\.)/, '');
let id = null;

if (host === 'youtu.be') {
  id = url.pathname.split('/').filter(Boolean)[0];
} else if (
  ['youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)
) {
  id = url.searchParams.get('v');
  if (!id) {
    id = url.pathname.match(
      /^\/(?:shorts|embed|v)\/([A-Za-z0-9_-]{11})/
    )?.[1];
  }
}

return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;

} catch {
return null;
}
}

async function getAudioInfo(videoUrl) {
const response = await fetch(
NEXRAY_MP3 + encodeURIComponent(videoUrl),
{
headers: { 'User-Agent': 'Mozilla/5.0' },
timeout: 30000
}
);

if (!response.ok) {
throw new Error("Audio provider HTTP ${response.status}");
}

const data = await response.json();

if (!data?.status || !data?.result?.url) {
throw new Error('Audio provider returned no download URL');
}

return {
url: data.result.url,
title: data.result.title || 'Unknown Song'
};
}

async function downloadAudio(url) {
const response = await fetch(url, {
headers: { 'User-Agent': 'Mozilla/5.0' },
timeout: 90000
});

if (!response.ok) {
throw new Error("Audio download HTTP ${response.status}");
}

const type = (response.headers.get('content-type') || '')
.split(';')[0]
.trim()
.toLowerCase();

if (
!type.startsWith('audio/') &&
!['application/octet-stream', 'binary/octet-stream'].includes(type)
) {
await response.body?.cancel();
throw new Error("Download URL returned non-audio content: ${type || 'unknown'}");
}

const length = Number(response.headers.get('content-length') || 0);

if (length > MAX_AUDIO_BYTES) {
await response.body?.cancel();
throw new Error('Audio exceeds the 30 MB limit');
}

const buffer = Buffer.from(await response.arrayBuffer());

if (buffer.length < 100000) {
throw new Error("Audio file is too small (${buffer.length} bytes)");
}

if (buffer.length > MAX_AUDIO_BYTES) {
throw new Error('Audio exceeds the 30 MB limit');
}

const isMp3 =
buffer.subarray(0, 3).toString() === 'ID3' ||
(buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);

if (!isMp3) {
throw new Error('Downloaded content is not a recognised MP3');
}

return buffer;
}

function cleanFilename(name) {
return String(name || 'Unknown Song')
.replace(/[<>:"/\|?*\x00-\x1f]/g, '_')
.trim()
.slice(0, 150) || 'Unknown Song';
}

export default {
name: 'play',
aliases: ['ply', 'playy', 'pl'],
description: 'Searches YouTube and sends song audio',

run: async (context) => {
const { client, m, text } = context;
let stage = 'song search';

const react = async (emoji) => {
  if (!m.reactKey) return;
  await client.sendMessage(m.chat, {
    react: { text: emoji, key: m.reactKey }
  }).catch(() => {});
};

try {
  const query = String(text || '').trim();

  if (!query) {
    return sendInteractive(
      client,
      m,
      '🎵 Send a song name or YouTube link.\nExample: .play Faded Alan Walker'
    );
  }

  if (query.length > 200) {
    throw new Error('Please use a song title under 200 characters.');
  }

  await react('⌛');

  let videoUrl;
  let filename = 'Unknown Song';
  let thumbnail = '';

  const isUrl = /^https?:\/\/|^www\./i.test(query);

  if (isUrl) {
    const id = extractYtId(query);

    if (!id) {
      throw new Error('Unsupported or invalid YouTube link.');
    }

    videoUrl = `https://www.youtube.com/watch?v=${id}`;
  } else {
    const results = await yts(query);
    const video = results.videos?.[0];

    if (!video?.videoId || !/^[A-Za-z0-9_-]{11}$/.test(video.videoId)) {
      throw new Error('No matching YouTube video was found.');
    }

    videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
    filename = video.title || filename;
    thumbnail = video.thumbnail || '';
  }

  console.log(`[PLAY] Found video; starting provider lookup`);
  stage = 'audio provider lookup';

  const info = await getAudioInfo(videoUrl);
  filename = info.title || filename;

  stage = 'audio download and validation';
  const audio = await downloadAudio(info.url);

  console.log(`[PLAY] Validated MP3: ${audio.length} bytes`);
  stage = 'WhatsApp audio upload';

  await client.sendMessage(m.chat, {
    audio,
    mimetype: 'audio/mpeg',
    fileName: `${cleanFilename(filename)}.mp3`,
    ...(thumbnail
      ? {
          contextInfo: {
            externalAdReply: {
              title: filename.slice(0, 60),
              body: 'ALSON-XMD',
              thumbnailUrl: thumbnail,
              sourceUrl: videoUrl,
              mediaType: 1,
              renderLargerThumbnail: true
            }
          }
        }
      : {})
  });

  await react('✅');
  console.log('[PLAY] Audio sent successfully');
} catch (error) {
  console.error(`[PLAY] Failed at stage: ${stage}`);
  console.error('[PLAY] Error:', error.stack || error.message);

  await react('❌');

  return sendInteractive(
    client,
    m,
    `╭─❏ 「 PLAY ERROR 」\n│ ${String(error.message || 'Could not retrieve audio').slice(0, 180)}\n│ Please try another song or link.\n╰───────────────\n> © ALSON-XMD`
  );
}

}
};
