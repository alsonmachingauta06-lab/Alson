import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js';
import { CHANNEL_JID, CHANNEL_NAME } from '../../lib/channelConfig.js';

export default {
    name: 'channelpost',
    aliases: ['chpost', 'postchannel'],
    description: 'Post an announcement to the ALSON-XMD channel',
    run: async (context) => {
        await ownerMiddleware(context, async () => {
            const { client, m, prefix } = context;

            const body = (m.body || '').trim();
            const parts = body.split(/\s+/);
            const text = body.startsWith(prefix)
                ? body.slice(parts[0].length).trim()
                : body;

            if (!text) {
                return client.sendMessage(m.chat, {
                    text: `📢 Usage: ${prefix}channelpost <announcement>`
                });
            }

            try {
                await client.sendMessage(CHANNEL_JID, {
                    text:
`╭─❏ 「 ${CHANNEL_NAME} 」
│
│ 📢 Announcement
│
${text.split('\n').map(line => `│ ${line}`).join('\n')}
│
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧 𝐌𝐚𝐜𝐡𝐢𝐧𝐠𝐚𝐮𝐭𝐚`
                });

                await client.sendMessage(m.chat, {
                    text: `✅ Posted to the ${CHANNEL_NAME} channel.`
                });
            } catch (error) {
                await client.sendMessage(m.chat, {
                    text: `❌ Channel post failed: ${error.message}`
                });
            }
        });
    }
};
