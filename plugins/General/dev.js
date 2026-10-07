import {
  generateWAMessageFromContent,
  prepareWAMessageMedia
} from '@whiskeysockets/baileys';

export default {
  name: 'dev',
  aliases: ['developer', 'contact', 'owner', 'creator', 'devcontact'],
  description: 'ALSON-XMD Developer profile card',

  run: async (context) => {
    const { client, m } = context;

    const devPhone = '263786359833';
    const devName = 'Alson Machingauta';
    const imageUrl = 'https://files.catbox.moe/0d0zy2.jpg';

    const waUrl = `https://wa.me/${devPhone}`;

    const channelUrl =
      'https://whatsapp.com/channel/0029Vb98SpC30LKMF6Se9K2d';

    try {
      await client.sendMessage(m.chat, {
        react: {
          text: '⌛',
          key: m.reactKey
        }
      });

      // Prepare Catbox image as a real WhatsApp imageMessage
      const media = await prepareWAMessageMedia(
        {
          image: {
            url: imageUrl
          }
        },
        {
          upload: client.waUploadToServer
        }
      );

      const message = generateWAMessageFromContent(
        m.chat,
        {
          interactiveMessage: {
            header: {
              title: 'Alson XMD',
              subtitle: `+${devPhone}`,
              hasMediaAttachment: true,
              imageMessage: media.imageMessage
            },

            body: {
              text:
                '🔷 *ALSON-XMD DEVELOPER*\n\n' +
                `👤 *${devName}*\n` +
                `📞 *+${devPhone}*\n` +
                '🇿🇼 *Zimbabwe*\n\n' +
                '📄 *ALSON-XMD Developer Profile*'
            },

            footer: {
              text: 'Alson XMD • Developer'
            },

            nativeFlowMessage: {
              buttons: [
                {
                  name: 'cta_url',
                  buttonParamsJson: JSON.stringify({
                    display_text: '📞  Owner Number',
                    url: waUrl
                  })
                },
                {
                  name: 'cta_url',
                  buttonParamsJson: JSON.stringify({
                    display_text: '📢  Follow Channel',
                    url: channelUrl
                  })
                }
              ],

              messageParamsJson: ''
            },

            contextInfo: {
              mentionedJid: [
                `${devPhone}@s.whatsapp.net`
              ],

              externalAdReply: {
                title: 'Alson XMD',
                body: `+${devPhone} • ALSON-XMD Developer`,
                mediaType: 1,
                thumbnailUrl: imageUrl,
                sourceUrl: waUrl,
                showAdAttribution: false,
                renderLargerThumbnail: true
              }
            }
          }
        },
        {
          userJid: client.user?.id
        }
      );

      await client.relayMessage(
        m.chat,
        message.message,
        {
          messageId: message.key.id
        }
      );

      await client.sendMessage(m.chat, {
        react: {
          text: '✅',
          key: m.reactKey
        }
      });

    } catch (error) {
      console.error('[ALSON DEV ERROR]', error);

      await client.sendMessage(m.chat, {
        react: {
          text: '❌',
          key: m.reactKey
        }
      }).catch(() => {});

      await client.sendMessage(m.chat, {
        text:
          '╭─❏ 「 ALSON XMD 」\n' +
          `│ 👤 ${devName}\n` +
          `│ 📞 +${devPhone}\n` +
          '│ 🇿🇼 Zimbabwe\n' +
          '│\n' +
          '│ ⚡ ALSON-XMD Developer\n' +
          '╰───────────────'
      });
    }
  }
};
