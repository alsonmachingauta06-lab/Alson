import yts from 'yt-search';
import fetch from 'node-fetch';
import { sendInteractive } from '../../lib/sendInteractive.js';
import { getYtDlpCookieArgs } from '../../lib/ytDlpCookies.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const OOTAIZUMI = 'https://api.ootaizumi.web.id/downloader/youtube?url=';
const NEXRAY = 'https://api.nexray.web.id/downloader/ytmp4?url=';
const MAX_VIDEO_SIZE = 64 * 1024 * 1024;

async function downloadFromApi(url, provider) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json'
    },
    timeout: 90000
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${provider} HTTP ${response.status}: ${body.slice(0, 180)}`);
  }

  const data = await response.json();

  if (!data?.status) {
    throw new Error(`${provider}: ${data?.error || 'Provider failed'}`);
  }

  return data;
}


async function downloadApiVideo(downloadUrl, provider) {
  let directory;

  try {
    const parsed = new URL(downloadUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`${provider}: invalid download URL`);
    }

    const response = await fetch(downloadUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 90000
    });

    if (!response.ok) {
      throw new Error(`${provider} media HTTP ${response.status}`);
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (
      contentType &&
      !contentType.startsWith('video/') &&
      !contentType.includes('application/octet-stream') &&
      !contentType.includes('application/mp4')
    ) {
      throw new Error(`${provider}: unexpected media type ${contentType}`);
    }

    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (declaredSize > MAX_VIDEO_SIZE) {
      throw new Error(`${provider}: video exceeds the 64 MB limit`);
    }

    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'alson-api-video-'));
    const filePath = path.join(directory, 'video.mp4');
    let received = 0;

    const sizeGuard = new Transform({
      transform(chunk, encoding, callback) {
        received += chunk.length;
        if (received > MAX_VIDEO_SIZE) {
          callback(new Error(`${provider}: video exceeds the 64 MB limit`));
          return;
        }
        callback(null, chunk);
      }
    });

    if (!response.body) {
      throw new Error(`${provider}: empty media response`);
    }

    await pipeline(response.body, sizeGuard, createWriteStream(filePath));

    const stat = await fs.stat(filePath);
    if (!stat.size) {
      throw new Error(`${provider}: downloaded video is empty`);
    }

    return { directory, filePath };
  } catch (error) {
    if (directory) {
      await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
    }
    throw error;
  }
}

async function downloadWithYtDlp(videoUrl) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'alson-video-')
  );

  try {
    const output = path.join(directory, '%(id)s.%(ext)s');

    await execFileAsync('yt-dlp', [
      '--no-warnings',
      '--no-playlist',
      '--no-progress',
      '--socket-timeout', '30',
      '--retries', '3',
      '--fragment-retries', '3',
      '--no-js-runtimes', '--js-runtimes', 'node',
      '--max-filesize', '63M',
      '-f', 'bv*[height<=360]+ba/b[height<=360]/b',
      '--merge-output-format', 'mp4',
      '-o', output,
      ...await getYtDlpCookieArgs(directory),
      videoUrl
    ], {
      timeout: 480000,
      maxBuffer: 8 * 1024 * 1024
    });

    const files = await fs.readdir(directory);
    const candidates = files.filter(name => /\.(mp4|mkv|webm|mov)$/i.test(name));

    if (!candidates.length) {
      throw new Error('yt-dlp completed but produced no video file');
    }

    const filePath = path.join(directory, candidates[0]);
    const stat = await fs.stat(filePath);

    if (!stat.size) {
      throw new Error('Downloaded video is empty');
    }

    if (stat.size > MAX_VIDEO_SIZE) {
      throw new Error(`Video is ${Math.ceil(stat.size / 1024 / 1024)} MB; limit is 64 MB`);
    }

    return { directory, filePath };
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}


async function getFfmpegPath() {
  try {
    const installer = await import('@ffmpeg-installer/ffmpeg');
    if (installer.default?.path) return installer.default.path;
  } catch (error) {
    console.log('[VIDEO] Using system FFmpeg:', error.message);
  }

  return 'ffmpeg';
}

async function convertToMp4(inputPath, directory) {
  const outputPath = path.join(directory, 'whatsapp-compatible.mp4');

  const ffmpegPath = await getFfmpegPath();
  await execFileAsync(ffmpegPath, [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-i', inputPath,
    '-map', '0:v:0',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '28',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    '-f', 'mp4',
    outputPath
  ], {
    timeout: 480000,
    maxBuffer: 8 * 1024 * 1024
  });

  const stat = await fs.stat(outputPath);

  if (!stat.size) {
    throw new Error('FFmpeg produced an empty MP4 file');
  }

  if (stat.size > MAX_VIDEO_SIZE) {
    throw new Error('Converted MP4 exceeds the 64 MB WhatsApp limit');
  }

  return outputPath;
}

function safeFilename(name) {
  return String(name || 'youtube-video')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .trim()
    .slice(0, 120) || 'youtube-video';
}

export default async (context) => {
  const { client, m, text } = context;
  let temporaryDirectory;
  let stage = 'video search';

  const react = async (emoji) => {
    if (!m.reactKey) return;
    await client.sendMessage(m.chat, {
      react: { text: emoji, key: m.reactKey }
    }).catch(() => {});
  };

  try {
    const query = String(text || '').trim();

    if (!query) {
      return sendInteractive(client, m,
        '╭─❏ 「 VIDEO 」\n│ Give me a video name or YouTube link.\n╰───────────────\n> © ALSON-XMD');
    }

    if (query.length > 200) {
      throw new Error('Search text must be under 200 characters.');
    }

    await react('⌛');

    let videoUrl;
    let title = 'Untitled';
    let thumbnailUrl = '';
    let media;

    const isUrl = /^(https?:\/\/|www\.)/i.test(query);

    if (isUrl) {
      const normalized = /^https?:\/\//i.test(query) ? query : `https://${query}`;
      const parsed = new URL(normalized);
      const host = parsed.hostname.replace(/^(www\.|m\.)/, '');

      if (!['youtube.com', 'youtu.be', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) {
        throw new Error('Please provide a valid YouTube video link.');
      }

      videoUrl = normalized;
      stage = 'YouTube video lookup';
      const id = host === 'youtu.be'
        ? parsed.pathname.split('/').filter(Boolean)[0]
        : parsed.searchParams.get('v') ||
          parsed.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)?.[1];

      if (!id) throw new Error('Could not read the YouTube video ID.');
      videoUrl = `https://www.youtube.com/watch?v=${id}`;
    } else {
      stage = 'YouTube search';
      const results = await yts(`${query} official`);
      const video = results.videos?.[0];

      if (!video?.url) {
        throw new Error(`No video found for "${query}".`);
      }

      videoUrl = video.url;
      title = video.title || title;
      thumbnailUrl = video.thumbnail || '';
    }

    // Provider 1: Ootaizumi
    try {
      stage = 'Ootaizumi provider';
      console.log('[VIDEO] Trying Ootaizumi.');

      const data = await downloadFromApi(
        OOTAIZUMI + encodeURIComponent(videoUrl) + '&format=720',
        'Ootaizumi'
      );

      if (!data.result?.download) {
        throw new Error('No download URL returned');
      }

      const downloaded = await downloadApiVideo(data.result.download, 'Ootaizumi');
      temporaryDirectory = downloaded.directory;
      media = { url: downloaded.filePath };
      title = data.result.title || title;
      thumbnailUrl = data.result.thumbnail || thumbnailUrl;
      console.log('[VIDEO] Ootaizumi media downloaded and validated.');
    } catch (error) {
      console.error('[VIDEO] Ootaizumi failed:', error.message);
    }

    // Provider 2: Nexray
    if (!media) {
      try {
        stage = 'Nexray provider';
        console.log('[VIDEO] Trying Nexray.');

        const data = await downloadFromApi(
          NEXRAY + encodeURIComponent(videoUrl) + '&resolusi=720',
          'Nexray'
        );

        if (!data.result?.url) {
          throw new Error('No download URL returned');
        }

        const downloaded = await downloadApiVideo(data.result.url, 'Nexray');
        temporaryDirectory = downloaded.directory;
        media = { url: downloaded.filePath };
        title = data.result.title || title;
        thumbnailUrl = data.result.thumbnail || thumbnailUrl;
        console.log('[VIDEO] Nexray media downloaded and validated.');
      } catch (error) {
        console.error('[VIDEO] Nexray failed:', error.message);
      }
    }

    // Provider 3: yt-dlp + FFmpeg
    if (!media) {
      stage = 'yt-dlp fallback';
      console.log('[VIDEO] Trying yt-dlp fallback.');

      const result = await downloadWithYtDlp(videoUrl);
      temporaryDirectory = result.directory;
      media = { url: result.filePath };

      console.log('[VIDEO] yt-dlp download and merge succeeded.');
    }

    stage = 'MP4 conversion';
    console.log('[VIDEO] Converting video to H.264/AAC MP4.');

    const mp4Path = await convertToMp4(media.url, temporaryDirectory);
    media = { url: mp4Path };

    stage = 'WhatsApp video upload';

    await client.sendMessage(m.chat, {
      video: media,
      mimetype: 'video/mp4',
      fileName: `${safeFilename(title)}.mp4`,
      caption: title
    }, {
      mediaUploadTimeoutMs: 240000
    });

    await react('✅');
    console.log('[VIDEO] Video sent successfully.');
  } catch (error) {
    console.error(`[VIDEO] Failed at stage: ${stage}`);
    console.error('[VIDEO] Error:', error.stack || error.message);

    await react('❌');

    return sendInteractive(client, m,
      `╭─❏ 「 VIDEO ERROR 」\n│ ${String(error.message || 'Video download failed').slice(0, 180)}\n│ Please try another video or link.\n╰───────────────\n> © ALSON-XMD`);
  } finally {
    if (temporaryDirectory) {
      await fs.rm(temporaryDirectory, {
        recursive: true,
        force: true
      }).catch(error =>
        console.error('[VIDEO] Temporary cleanup failed:', error.message)
      );
    }
  }
};
