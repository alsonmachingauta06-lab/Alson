import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js';
import { sendInteractive } from '../../lib/sendInteractive.js';
import { getSettings, updateSetting } from '../../database/config.js';

export default {
    name: 'setprefix',
    aliases: ['prefix', 'setpre', 'pre'],
    description: 'Set the command prefix for the bot. Use `none` to disable prefixes.',

    run: async (context) => {
        await ownerMiddleware(context, async () => {
            const { client, m, text } = context;

            const current = await getSettings();
            const currentPrefix = (current && current.prefix !== undefined) ? String(current.prefix) : '.';

            if (!text || text.trim() === '') {
                return sendInteractive(client, m, `╭─❏ 「 Sᴇᴛ Pʀᴇꜰɪx 」\n│ Current prefix: *${currentPrefix === '' ? '(none)' : currentPrefix}*\n│\n│ Usage:\n│ .setprefix <prefix> — set a new prefix\n│ .setprefix none — disable prefix (commands work without prefix)\n│ .setprefix reset — restore default '.'\n╰───────────────\n> ALSON-XMD`);
            }

            const arg = String(text || '').trim();
            let newPrefix = arg;

            if (arg.toLowerCase() === 'reset') {
                newPrefix = '.';
            } else if (arg.toLowerCase() === 'none' || arg.toLowerCase() === 'no' || arg.toLowerCase() === 'off') {
                newPrefix = '';
            }

            // validate length (allow empty)
            if (newPrefix !== '' && newPrefix.length > 5) {
                return sendInteractive(client, m, `╭─❏ 「 Iɴᴠᴀʟɪᴅ Pʀᴇꜰɪx 」\n│ Prefix too long. Keep it short (max 5 chars).\n╰───────────────\n> ALSON-XMD`);
            }

            try {
                await updateSetting('prefix', newPrefix);

                return sendInteractive(client, m, `╭─❏ 「 Pʀᴇꜰɪx Uᴘᴅᴀᴛᴇᴅ 」\n│ New prefix: *${newPrefix === '' ? '(none)' : newPrefix}*\n│\n│ ${newPrefix === '' ? 'Commands will work without a prefix now.' : `Use *${newPrefix}<command>* to run commands.`}\n╰───────────────\n> ALSON-XMD`);
            } catch (e) {
                console.error('SETPREFIX ERROR:', e);
                return sendInteractive(client, m, `╭─❏ 「 Eʀʀᴏʀ 」\n│ Could not update prefix: ${e.message || e}\n╰───────────────\n> ALSON-XMD`);
            }
        });
    }
};
