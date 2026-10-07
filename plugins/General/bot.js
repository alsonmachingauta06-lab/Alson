import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { getSettings } from '../../database/config.js';
import { getDeviceMode } from '../../lib/deviceMode.js';
import { ButtonV2 } from '@whiskeysockets/baileys';

export default {
    name: 'start',
    aliases: ['alive', 'online', 'toxic', 'bot', 'status', 'active', 'check'],
    description: 'Check if bot is alive',
    run: async (context) => {
        const { client, m, mode, pict, botname, text, prefix } = context;

        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
        await client.sendMessage(m.chat, { react: { text: '🤖', key: m.reactKey } });

        const alsonxmdPaths = [
            path.join(__dirname, 'alsonxmd'),
            path.join(process.cwd(), 'alsonxmd'),
            path.join(__dirname, '..', 'alsonxmd')
        ];

        let audioFolder = null;
        for (const folderPath of alsonxmdPaths) {
            if (fs.existsSync(folderPath)) { audioFolder = folderPath; break; }
        }

        if (audioFolder) {
            const possibleFiles = [];
            for (let i = 1; i <= 10; i++) {
                for (const ext of ['.mp3', '.m4a', '.ogg', '.opus', '.wav']) {
                    const fullPath = path.join(audioFolder, `menu${i}${ext}`);
                    if (fs.existsSync(fullPath)) possibleFiles.push(fullPath);
                }
            }
            if (possibleFiles.length > 0) {
                const randomFile = possibleFiles[Math.floor(Math.random() * possibleFiles.length)];
                await client.sendMessage(m.chat, {
                    audio: { url: randomFile }, ptt: true, mimetype: 'audio/mpeg', fileName: 'toxic-start.mp3'
                });
            }
        }

        const settings = await getSettings();
        const effectivePrefix = settings.prefix || '.';
        const device = await getDeviceMode();

        const bodyText = `╭─❏ 「 Sᴛᴀʀᴛ」\n│ Yo @${m.sender.split('@')[0].split(':')[0]}! You actually bothered\n│ to check if I'm alive?\n│ ${botname} is active 24/7, unlike\n│ your brain cells.\n│ Choose an option below to continue.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧 𝐌𝐚𝐜𝐡𝐢𝐧𝐠𝐚𝐮𝐭𝐚`;

        if (device === 'ios') {
            await client.sendMessage(m.chat, { text: bodyText, mentions: [m.sender] });
            return;
        }

        try {
            const btnV2 = new ButtonV2(client);
            btnV2.setBody(bodyText)

                .addButton('𝐌𝐞𝐧𝐮', `${effectivePrefix}menu`)
                .addButton('𝐏𝐢𝐧𝐠', `${effectivePrefix}ping`)
                .addButton('𝐒𝐞𝐭𝐭𝐢𝐧𝐠𝐬', `${effectivePrefix}settings`);
            await btnV2.send(m.chat, { userJid: client.user?.id || '', mentions: [m.sender] });
            await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
        } catch {
            await client.sendMessage(m.chat, { text: bodyText, mentions: [m.sender] });
            await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
        }
    } };
