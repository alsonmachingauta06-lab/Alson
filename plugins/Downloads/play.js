import fetch from 'node-fetch';
import { sendInteractive } from '../../lib/sendInteractive.js';

const NEXRAY_MP3 = 'https://api.nexray.web.id/downloader/ytmp3?url=';

function extractYtId(url) {
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/))([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

export default {
  name: 'play',
  aliases: ['ply', 'playy', 'pl'],
  description: 'Downloads songs from YouTube and sends audio',

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

        return sendInteractive(
          client,
          m,
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

        return sendInteractive(
          client,
          m,
          `│ Song title must be 100 characters or less.
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`
        );
      }

      const isYoutubeLink =
        /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/)[a-zA-Z0-9_-]{11})/i.test(query);

      let audioUrl;
      let filename = 'Unknown Song';
      let thumbnail = '';
      let sourceUrl = '';

      if (isYoutubeLink) {
        /*
         * PRIMARY: Sidycoders
         * FALLBACK: NEXRAY
         */
        let primaryFailed = false;

        try {
          const response = await fetch(
            `https://api.sidycoders.xyz/api/ytdl?url=${encodeURIComponent(query)}&format=mp3&apikey=memberdycoders`,
            { headers: { 'User-Agent': 'Mozilla/5.0' } }
          );

          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const data = await response.json();

          if (!data.status || !data.cdn) {
            throw new Error('Primary audio provider failed');
          }

          audioUrl = data.cdn;
          filename = data.title || filename;
          sourceUrl = query;
        } catch (primaryError) {
          primaryFailed = true;
          console.error('[PLAY] Sidycoders failed:', primaryError.message);
        }

        if (primaryFailed) {
          const id = extractYtId(query);

          if (!id) throw new Error('Invalid YouTube link');

          const fullUrl = `https://youtube.com/watch?v=${id}`;

          const response = await fetch(
            NEXRAY_MP3 + encodeURIComponent(fullUrl),
            {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              timeout: 30000
            }
          );

          if (!response.ok) {
            throw new Error(`Fallback HTTP ${response.status}`);
          }

          const data = await response.json();

          if (!data.status || !data.result?.url) {
            throw new Error('Fallback audio provider failed');
          }

          audioUrl = data.result.url;
          filename = data.result.title || filename;
          sourceUrl = fullUrl;
        }
      } else {
        /*
         * PRIMARY: Apiziaul search
         * FALLBACK: NEXRAY requires a YouTube URL,
         * so we use YouTube search only if the primary search fails.
         */
        let searchWorked = false;

        try {
          const response = await fetch(
            `https://apiziaul.vercel.app/api/downloader/ytplaymp3?query=${encodeURIComponent(query)}`,
            { headers: { 'User-Agent': 'Mozilla/5.0' } }
          );

          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const data = await response.json();

          if (!data.status || !data.result?.downloadUrl) {
            throw new Error('Primary search provider failed');
          }

          audioUrl = data.result.downloadUrl;
          filename = data.result.title || filename;
          thumbnail = data.result.thumbnail || '';
          sourceUrl = data.result.videoUrl || '';
          searchWorked = true;
        } catch (primaryError) {
          console.error('[PLAY] Apiziaul failed:', primaryError.message);
        }

        /*
         * We intentionally do not add another search dependency here.
         * The existing search provider remains primary.
         */
        if (!searchWorked) {
          throw new Error('Song search provider unavailable');
        }
      }

      await client.sendMessage(m.chat, {
        react: { text: '✅', key: m.reactKey }
      });

      const safeName = String(filename)
        .replace(/[<>:"/\\|?*]/g, '_')
        .trim() || 'youtube-song';

      await client.sendMessage(m.chat, {
        audio: { url: audioUrl },
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
        document: { url: audioUrl },
        mimetype: 'audio/mpeg',
        fileName: `${safeName}.mp3`,
        caption:
          `╭─❏ 「 PLAY」\n` +
          `│ ${filename}\n` +
          `╰───────────────\n` +
          `> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`
      });

    } catch (error) {
      console.error('[PLAY] Download failed:', error.message);

      await client.sendMessage(m.chat, {
        react: { text: '❌', key: m.reactKey }
      }).catch(() => {});

      return sendInteractive(
        client,
        m,
        `╭─❏ 「 PLAY ERROR」
│ The audio service is temporarily unavailable.
│ Please try again or try another song.
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`
      );
    }
  }
};
