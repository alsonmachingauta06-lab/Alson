import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js'; 
import { sendInteractive } from '../../lib/sendInteractive.js';

export default async (context) => {
    await ownerMiddleware(context, async () => {
        const { client, m, Owner, participants, botname } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

        if (!botname) {
            console.error(`Bot name is not configured.`);
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, `╭─❏ 「 LEAVEGC 」
│ \n│ Bot's not working. No botname in context.\n│ Yell at your dev, dumbass.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`);
        }

        if (!Owner) {
            console.error(`Owner not set, the owner is not configured.`);
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, `╭─❏ 「 LEAVEGC 」
│ \n│ Bot's broken. No owner in context.\n│ Go cry to the dev.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`);
        }

        if (!m.isGroup) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, `╭─❏ 「 LEAVEGC 」
│ \n│ This command only works in groups.\n│ direct messages? This is for groups,\n│ you please check the command.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`);
        }

        try {
            const maxMentions = 50;
            const mentions = participants.slice(0, maxMentions).map(a => a.id);
            await client.sendMessage(m.chat, { 
                text: `╭─❏ 「 LEAVING」
│ Leaving this group ${botname} is OUT!\n│ The bot is leaving the group.\n│ you everyone. ${mentions.length < participants.length ? 'Too many please try agains to tag, Please try again.' : ''}\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`, 
                mentions 
            });
            console.log(`[LEAVE-DEBUG] Leaving group ${m.chat}, mentioned ${mentions.length} participants`);
            await client.groupLeave(m.chat);
        } catch (error) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            console.error(`[LEAVE-ERROR] Couldn't ditch the group: ${error.stack}`);
            await sendInteractive(client, m, `╭─❏ 「 ERROR」
│ Something went wrong, @${m.sender.split('@')[0].split(':')[0]}!\n│ Can't escape this group:\n│ ${error.message}. Try again, please try again.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`);
        }
    });
};
