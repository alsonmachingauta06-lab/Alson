import yts from 'yt-search';
import fetch from 'node-fetch';
import { sendInteractive } from '../../lib/sendInteractive.js';

const NEXRAY_MP4 = 'https://api.nexray.web.id/downloader/ytmp4?url=';

export default async (context) => {
  const { client, m, text } = context;

  await client.sendMessage(m.chat, {
    react: { text: '⌛', key: m.reactKey }
  });

  if (!text) {
    await client.sendMessage(m.chat, {
      react: { text: '❌', key: m.reactKey }
    }).catch(() => {});

    return sendInteractive(
      client,
      m,
      `╭─❏ 「 VIDEO」
│ Give me a video name.
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`
    );
  }

  if (text.length > 100) {
    await client.sendMessage(m.chat, {
      react: { text: '❌', key: m.reactKey }
    }).catch(() => {});

    return sendInteractive(
      client,
      m,
      `╭─❏ 「 VIDEO」
│ Title must be under 100 characters.
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`
    );
  }

  try {
    const searchResult = await yts(`${text} official`);
    const video = searchResult.videos[0];

    if (!video) {
      await client.sendMessage(m.chat, {
        react: { text: '❌', key: m.reactKey }
      }).catch(() => {});

      return sendInteractive(
        client,
        m,
        `╭─❏ 「 VIDEO」
│ Nothing found for "${text}".
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`
      );
    }

    let videoUrl;
    let title = video.title || 'Untitled';
    let thumbnailUrl = video.thumbnail || '';

    /*
     * PRIMARY: Ootaizumi
     * FALLBACK: NEXRAY
     */

    try {
      const encodedUrl = encodeURIComponent(video.url);

      const response = await fetch(
        `https://api.ootaizumi.web.id/downloader/youtube?url=${encodedUrl}&format=720`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json'
          },
          timeout: 90000
        }
      );

      if (!response.ok) {
        throw new Error(`Primary HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.status || !data.result?.download) {
        throw new Error('Primary video provider failed');
      }

      videoUrl = data.result.download;
      title = data.result.title || title;
      thumbnailUrl = data.result.thumbnail || thumbnailUrl;

    } catch (primaryError) {
      console.error('[VIDEO] Ootaizumi failed:', primaryError.message);

      /*
       * FALLBACK: NEXRAY MP4
       */
      const fullUrl = `https://youtube.com/watch?v=${video.videoId}`;

      const response = await fetch(
        NEXRAY_MP4 +
          encodeURIComponent(fullUrl) +
          '&resolusi=720',
        {
          headers: {
            'User-Agent': 'Mozilla/5.0'
          },
          timeout: 90000
        }
      );

      if (!response.ok) {
        throw new Error(`Fallback HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.status || !data.result?.url) {
        throw new Error('Fallback video provider failed');
      }

      videoUrl = data.result.url;
      title = data.result.title || title;
      thumbnailUrl = data.result.thumbnail || thumbnailUrl;
    }

    const safeName =
      String(title)
        .replace(/[<>:"/\\|?*]/g, '_')
        .trim() || 'youtube-video';

    await client.sendMessage(m.chat, {
      react: { text: '✅', key: m.reactKey }
    });

    await client.sendMessage(m.chat, {
      video: { url: videoUrl },
      mimetype: 'video/mp4',
      fileName: `${safeName}.mp4`,
      contextInfo: {
        externalAdReply: {
          title: title.substring(0, 60),
          body: 'Powered by ALSON-XMD',
          thumbnailUrl,
          sourceUrl: video.url,
          mediaType: 2,
          renderLargerThumbnail: true
        }
      }
    });

  } catch (error) {
    console.error('[VIDEO] Download failed:', error.message);

    await client.sendMessage(m.chat, {
      react: { text: '❌', key: m.reactKey }
    }).catch(() => {});

    return sendInteractive(
      client,
      m,
      `╭─❏ 「 VIDEO ERROR」
│ The video service is temporarily unavailable.
│ Please try again later.
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`
    );
  }
};
