import { CHANNEL_JID, CHANNEL_INVITE, CHANNEL_NAME } from '../../lib/channelConfig.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default {
    name: 'channel',
    aliases: ['channelinfo', 'channelid', 'ch'],
    description: 'Show the official ALSON-XMD newsletter channel',
    run: async (context) => {
        const { client, m, prefix } = context;

        try {
            await client.sendMessage(m.chat, {
                react: { text: '📢', key: m.reactKey || m.key }
            }).catch(() => {});

            const text =
`╭─❏ 「 ${CHANNEL_NAME} CHANNEL」
│
│ 📢 Official Channel
│
│ 🔗 ${CHANNEL_INVITE}
│
│ 🆔 Channel JID:
│ ${CHANNEL_JID}
│
│ Use *${prefix}checkid* with a
│ channel invite to resolve any
│ WhatsApp channel JID.
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧 𝐌𝐚𝐜𝐡𝐢𝐧𝐠𝐚𝐮𝐭𝐚`;

            await sendInteractive(client, m, text);

            await client.sendMessage(m.chat, {
                react: { text: '✅', key: m.reactKey || m.key }
            }).catch(() => {});
        } catch (error) {
            await client.sendMessage(m.chat, {
                text: `❌ Channel command failed: ${error.message}`
            }).catch(() => {});
        }
    }
};
