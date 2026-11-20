import yts from 'yt-search';
import fetch from 'node-fetch';
import { sendInteractive } from '../../lib/sendInteractive.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const OOTAIZUMI =
  'https://api.ootaizumi.web.id/downloader/youtube?url=';

const NEXRAY =
  'https://api.nexray.web.id/downloader/ytmp4?url=';

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
    throw new Error(`${provider} HTTP ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json();

  if (!data.status) {
    throw new Error(`${provider}: ${data.error || 'Provider reported failure'}`);
  }

  return data;
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
      '--socket-timeout', '20',
      '--retries', '2',
      '--fragment-retries', '2',
      '--max-filesize', '64M',
      '-f', 'bv*[height<=720]+ba/b[height<=720]/b',
      '--merge-output-format', 'mp4',
      '-o', output,
      videoUrl
    ], {
      timeout: 480000,
      maxBuffer: 5 * 1024 * 1024
    });

    const files = await fs.readdir(directory);
    const candidates = files.filter(
      name => /\.(mp4|mkv|webm|mov)$/i.test(name)
    );

    if (!candidates.length) {
      throw new Error('yt-dlp produced no video file');
    }

    const filePath = path.join(directory, candidates[0]);
    const stat = await fs.stat(filePath);

    if (!stat.size) {
      throw new Error('Downloaded video is empty');
    }

    if (stat.size > MAX_VIDEO_SIZE) {
      throw new Error('Video exceeds the 64 MB WhatsApp delivery limit');
    }

    return { directory, filePath };
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

export default async (context) => {
  const { client, m, text } = context;
  let temporaryDirectory;

  const react = async (emoji) => {
    await client.sendMessage(m.chat, {
      react: { text: emoji, key: m.reactKey }
    }).catch(() => {});
  };

  try {
    await react('⌛');

    if (!text) {
      await react('❌');
      return sendInteractive(client, m,
        `╭─❏ 「 VIDEO」
│ Give me a video name.
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`);
    }

    if (text.length > 100) {
      await react('❌');
      return sendInteractive(client, m,
        `╭─❏ 「 VIDEO」
│ Title must be under 100 characters.
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`);
    }

    const searchResult = await yts(`${text} official`);
    const video = searchResult.videos[0];

    if (!video) {
      await react('❌');
      return sendInteractive(client, m,
        `╭─❏ 「 VIDEO」
│ Nothing found for "${text}".
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`);
    }

    const videoUrl = video.url;
    let title = video.title || 'Untitled';
    let thumbnailUrl = video.thumbnail || '';
    let media;

    // Provider 1: Ootaizumi
    try {
      const data = await downloadFromApi(
        OOTAIZUMI + encodeURIComponent(videoUrl) + '&format=720',
        'Ootaizumi'
      );

      if (!data.result?.download) {
        throw new Error('No download URL in response');
      }

      media = { url: data.result.download };
      title = data.result.title || title;
      thumbnailUrl = data.result.thumbnail || thumbnailUrl;
      console.log('[VIDEO] Ootaizumi succeeded.');
    } catch (error) {
      console.error('[VIDEO] Ootaizumi failed:', error.message);
    }

    // Provider 2: Nexray
    if (!media) {
      try {
        const data = await downloadFromApi(
          NEXRAY + encodeURIComponent(videoUrl) + '&resolusi=720',
          'Nexray'
        );

        if (!data.result?.url) {
          throw new Error('No download URL in response');
        }

        media = { url: data.result.url };
        title = data.result.title || title;
        thumbnailUrl = data.result.thumbnail || thumbnailUrl;
        console.log('[VIDEO] Nexray succeeded.');
      } catch (error) {
        console.error('[VIDEO] Nexray failed:', error.message);
      }
    }

    // Provider 3: Local yt-dlp
    if (!media) {
      console.log('[VIDEO] Trying local yt-dlp fallback.');

      const result = await downloadWithYtDlp(videoUrl);
      temporaryDirectory = result.directory;
      media = { url: result.filePath };

      console.log('[VIDEO] Local yt-dlp download succeeded.');
    }

    const safeName = String(title)
      .replace(/[<>:"/\\|?*]/g, '_')
      .trim()
      .slice(0, 150) || 'youtube-video';

    await client.sendMessage(m.chat, {
      video: media,
      mimetype: 'video/mp4',
      fileName: `${safeName}.mp4`
    }, {
      mediaUploadTimeoutMs: 180000
    });

    await react('✅');
    console.log('[VIDEO] Video sent successfully.');

  } catch (error) {
    console.error('[VIDEO] Download failed:', error.message);
    await react('❌');

    return sendInteractive(client, m,
      `╭─❏ 「 VIDEO ERROR」
│ The video service is temporarily unavailable.
│ Please try again later.
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐒𝐎𝐍`);
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
