import fetch from 'node-fetch';
import { sendInteractive } from '../../lib/sendInteractive.js';

const NEXRAY_MP3 = 'https://api.nexray.web.id/downloader/ytmp3?url=';
const MAX_AUDIO_BYTES = 30 * 1024 * 1024;

function extractYtId(url) {
  try {
    const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '');

    let id = null;
    if (host === 'youtu.be') {
      id = parsed.pathname.split('/').filter(Boolean)[0];
    } else if (host === 'youtube.com' || host === 'music.youtube.com') {
      id = parsed.searchParams.get('v');
      if (!id) {
        const match = parsed.pathname.match(/^\/(?:shorts|embed|v)\/([A-Za-z0-9_-]{11})/);
        id = match?.[1];
      }
    }

    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

async function getNexrayAudioUrl(videoUrl) {
  const response = await fetch(
    NEXRAY_MP3 + encodeURIComponent(videoUrl),
    {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 30000
    }
  );

  if (!response.ok) throw new Error(`Nexray API HTTP ${response.status}`);

  const data = await response.json();
  if (!data.status || !data.result?.url) {
    throw new Error('Nexray did not return an audio URL');
  }

  return {
    url: data.result.url,
    title: data.result.title || 'Unknown Song'
  };
}

async function downloadVerifiedAudio(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 90000
  });

  if (!response.ok) {
    throw new Error(`Audio download HTTP ${response.status}`);
  }

  const type = (response.headers.get('content-type') || '')
    .split(';')[0].trim().toLowerCase();

  if (
    !type.startsWith('audio/') &&
    type !== 'application/octet-stream' &&
    type !== 'binary/octet-stream'
  ) {
    await response.body?.cancel();
    throw new Error(`Provider returned non-audio content: ${type || 'unknown type'}`);
  }

  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_AUDIO_BYTES) {
    await response.body?.cancel();
    throw new Error('Audio exceeds the 30 MB limit');
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length < 100000) {
    throw new Error(`Audio too small (${buffer.length} bytes); refusing to send`);
  }

  if (buffer.length > MAX_AUDIO_BYTES) {
    throw new Error('Downloaded audio exceeds the 30 MB limit');
  }

  const isMp3 =
    buffer.subarray(0, 3).toString() === 'ID3' ||
    (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);

  if (!isMp3) {
    throw new Error('Downloaded file does not have a recognised MP3 signature');
  }

  return buffer;
}

export default {
  name: 'play',
  aliases: ['ply', 'playy', 'pl'],
  description: 'Downloads songs from YouTube and sends verified audio',

  run: async (context) => {
    const { client, m, text } = context;

    await client.sendMessage(m.chat, {
      react: { text: '⌛', key: m.reactKey }
    });

    try {
      const query = text ? text.trim() : '';

      if (!query) {
        await client.sendMessage(m.chat, {
          react: { text: '❌', key: m.reactKey }
        }).catch(() => {});

        return sendInteractive(client, m,
          `╭─❏ 「 PLAY」
│ Give me a song name or YouTube link.
│ Example: .play harlem shake
│ Or: .play https://youtu.be/dQw4w9WgXcQ
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`
        );
      }

      if (query.length > 100 && !/^https?:\/\/|^www\./i.test(query)) {
        await client.sendMessage(m.chat, {
          react: { text: '❌', key: m.reactKey }
        }).catch(() => {});

        return sendInteractive(client, m,
          `│ Song title must be 100 characters or less.
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`
        );
      }

      let videoUrl;
      let filename = 'Unknown Song';
      let thumbnail = '';
      let sourceUrl = '';

      const isYoutubeLink =
        /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/))[A-Za-z0-9_-]{11}/i.test(query);

      if (isYoutubeLink) {
        const id = extractYtId(query);
        if (!id) throw new Error('Invalid YouTube link');

        videoUrl = `https://youtube.com/watch?v=${id}`;
        sourceUrl = videoUrl;
      } else {
        const { execFile } = await import('node:child_process');
        const { promisify } = await import('node:util');
        const execFileAsync = promisify(execFile);

        const { stdout } = await execFileAsync(
          'yt-dlp',
          [
            '--dump-single-json',
            '--no-warnings',
            '--skip-download',
            '--no-playlist',
            `ytsearch1:${query}`
          ],
          { timeout: 60000, maxBuffer: 5 * 1024 * 1024 }
        );

        const searchData = JSON.parse(stdout);
        const result = searchData.entries?.[0] || searchData;
        const id = result.id;

        if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
          throw new Error('yt-dlp search returned no valid YouTube video');
        }

        videoUrl = `https://www.youtube.com/watch?v=${id}`;
        filename = result.title || filename;
        thumbnail = result.thumbnail || '';
        sourceUrl = videoUrl;
      }

      // Use Nexray for the actual audio; never trust Apiziaul's download URL.
      const audioInfo = await getNexrayAudioUrl(videoUrl);
      filename = audioInfo.title || filename;

      // Validate the actual bytes before sending anything to WhatsApp.
      const audioBuffer = await downloadVerifiedAudio(audioInfo.url);

      const safeName = String(filename)
        .replace(/[<>:"/\\|?*]/g, '_')
        .trim() || 'youtube-song';

      await client.sendMessage(m.chat, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${safeName}.mp3`,
        contextInfo: thumbnail
          ? {
              externalAdReply: {
                title: String(filename).substring(0, 30),
                body: 'ALSON-XMD',
                thumbnailUrl: thumbnail,
                sourceUrl,
                mediaType: 1,
                renderLargerThumbnail: true
              }
            }
          : undefined
      });

      await client.sendMessage(m.chat, {
        react: { text: '✅', key: m.reactKey }
      });

    } catch (error) {
      console.error('[PLAY] Download failed:', error.message);

      await client.sendMessage(m.chat, {
        react: { text: '❌', key: m.reactKey }
      }).catch(() => {});

      return sendInteractive(client, m,
        `╭─❏ 「 PLAY ERROR」
│ Couldn't retrieve valid MP3 audio.
│ Please try again or try another song.
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`
      );
    }
  }
};
