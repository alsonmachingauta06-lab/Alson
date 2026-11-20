import fetch from 'node-fetch';
import yts from 'yt-search';
import { sendInteractive } from '../../lib/sendInteractive.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const NEXRAY_MP3 = 'https://api.nexray.web.id/downloader/ytmp3?url=';
const MAX_AUDIO_BYTES = 30 * 1024 * 1024;

function extractYtId(input) {
  try {
    const url = new URL(
      /^https?:\/\//i.test(input) ? input : `https://${input}`
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

function validateMp3(buffer) {
  if (buffer.length < 100000) {
    throw new Error(`Audio file is too small (${buffer.length} bytes)`);
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

async function getAudioInfo(videoUrl) {
  const response = await fetch(
    NEXRAY_MP3 + encodeURIComponent(videoUrl),
    {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 30000
    }
  );

  if (!response.ok) {
    throw new Error(`Nexray API HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data?.status || !data?.result?.url) {
    throw new Error('Nexray returned no download URL');
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
    let host = 'unknown';
    let finalHost = 'unknown';
    try { host = new URL(url).hostname; } catch {}
    try { finalHost = new URL(response.url).hostname; } catch {}
    console.error('[PLAY] Download diagnostic:', {
      status: response.status,
      requestedHost: host,
      finalHost,
      contentType: response.headers.get('content-type')
    });
    throw new Error(`Nexray download HTTP ${response.status}`);
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
    throw new Error(`Nexray returned non-audio content: ${type || 'unknown'}`);
  }

  const length = Number(response.headers.get('content-length') || 0);

  if (length > MAX_AUDIO_BYTES) {
    await response.body?.cancel();
    throw new Error('Audio exceeds the 30 MB limit');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return validateMp3(buffer);
}

async function downloadWithYtDlp(videoUrl) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'alson-audio-')
  );

  try {
    const output = path.join(directory, 'audio.%(ext)s');

    await execFileAsync('yt-dlp', [
      '--no-warnings',
      '--no-playlist',
      '--no-progress',
      '--socket-timeout', '20',
      '--retries', '3',
      '--fragment-retries', '3',
      '--max-filesize', '30M',
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '5',
      '-o', output,
      videoUrl
    ], {
      timeout: 480000,
      maxBuffer: 8 * 1024 * 1024
    });

    const files = await fs.readdir(directory);
    const mp3 = files.find(name => name.toLowerCase().endsWith('.mp3'));

    if (!mp3) {
      throw new Error('yt-dlp did not produce an MP3 file');
    }

    const filePath = path.join(directory, mp3);
    const stat = await fs.stat(filePath);

    if (stat.size > MAX_AUDIO_BYTES) {
      throw new Error('Audio exceeds the 30 MB limit');
    }

    const buffer = validateMp3(await fs.readFile(filePath));

    return { buffer, directory };
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

function cleanFilename(name) {
  return String(name || 'Unknown Song')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
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
    let temporaryDirectory;

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

      const isUrl = /^(https?:\/\/|www\.)/i.test(query);

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
      }

      let audio;

      // Provider 1: Nexray
      try {
        stage = 'Nexray audio provider';
        console.log('[PLAY] Trying Nexray.');

        const info = await getAudioInfo(videoUrl);
        filename = info.title || filename;

        stage = 'Nexray audio download';
        audio = await downloadAudio(info.url);

        console.log(`[PLAY] Nexray succeeded: ${audio.length} bytes.`);
      } catch (error) {
        console.error('[PLAY] Nexray failed:', error.message);
      }

      // Provider 2: local yt-dlp + FFmpeg
      if (!audio) {
        stage = 'yt-dlp audio fallback';
        console.log('[PLAY] Trying local yt-dlp fallback.');

        const result = await downloadWithYtDlp(videoUrl);
        audio = result.buffer;
        temporaryDirectory = result.directory;

        console.log(`[PLAY] yt-dlp succeeded: ${audio.length} bytes.`);
      }

      stage = 'WhatsApp audio upload';

      await client.sendMessage(m.chat, {
        audio,
        mimetype: 'audio/mpeg',
        fileName: `${cleanFilename(filename)}.mp3`
      });

      await react('✅');
      console.log('[PLAY] Audio sent successfully.');
    } catch (error) {
      console.error(`[PLAY] Failed at stage: ${stage}`);
      console.error('[PLAY] Error:', error.stack || error.message);

      await react('❌');

      return sendInteractive(
        client,
        m,
        `╭─❏ 「 PLAY ERROR 」\n│ ${String(error.message || 'Could not retrieve audio').slice(0, 180)}\n│ Please try another song or link.\n╰───────────────\n> © ALSON-XMD`
      );
    } finally {
      if (temporaryDirectory) {
        await fs.rm(temporaryDirectory, {
          recursive: true,
          force: true
        }).catch(error =>
          console.error('[PLAY] Temporary cleanup failed:', error.message)
        );
      }
    }
  }
};
