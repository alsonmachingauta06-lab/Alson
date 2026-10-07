import { generateWAMessageFromContent } from '@whiskeysockets/baileys';
import { sendInteractive } from '../../lib/sendInteractive.js';
export default async (context) => {
  const { client, m, prefix, text } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

  const toFancyFont = (text, isUpperCase = false) => {
    const fonts = {
      'A': '𝘼', 'B': '𝘽', 'C': '𝘾', 'D': '𝘿', 'E': '𝙀', 'F': '𝙁', 'G': '𝙂', 'H': '𝙃', 'I': '𝙄', 'J': '𝙅', 'K': '𝙆', 'L': '𝙇', 'M': '𝙈',
      'N': '𝙉', 'O': '𝙊', 'P': '𝙋', 'Q': '𝙌', 'R': '𝙍', 'S': '𝙎', 'T': '𝙏', 'U': '𝙐', 'V': '𝙑', 'W': '𝙒', 'X': '𝙓', 'Y': '𝙔', 'Z': '𝙕',
      'a': '𝙖', 'b': '𝙗', 'c': '𝙘', 'd': '𝙙', 'e': '𝙚', 'f': '𝙛', 'g': '𝙜', 'h': '𝙝', 'i': '𝙞', 'j': '𝙟', 'k': '𝙠', 'l': '𝙡', 'm': '𝙢',
      'n': '𝙣', 'o': '𝙤', 'p': '𝙥', 'q': '𝙦', 'r': '𝙧', 's': '𝙨', 't': '𝙩', 'u': '𝙪', 'v': '𝙫', 'w': '𝙬', 'x': '𝙭', 'y': '𝙮', 'z': '𝙯'
    };
    return (isUpperCase ? text.toUpperCase() : text.toLowerCase())
      .split('')
      .map(char => fonts[char] || char)
      .join('');
  };

  if (text) {
    await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
    return client.sendMessage(m.chat, { text: `╭─❏ 「 Eʀʀᴏʀ」
│ Yo, @${m.sender.split('@')[0].split(':')[0]}, what's with the extra\n│ extra text? Please use ${prefix}credits.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧` }, { mentions: [m.sender] });
  }

  try {
    const replyText = `╭─❏ 「 Cʀᴇᴅɪᴛs」
│ All hail *𝐀𝐥𝐬𝐨𝐧 𝐌𝐚𝐜𝐡𝐢𝐧𝐠𝐚𝐮𝐭𝐚*, the badass who\n│ built this bot from the ground up.\n│ Credit goes to the project contributors.\n│ This project is maintained by Alson Machingauta.\n│ \n│ Bow down to *𝐀𝐥𝐬𝐨𝐧 𝐌𝐚𝐜𝐡𝐢𝐧𝐠𝐚𝐮𝐭𝐚*\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`;

    await client.sendMessage(m.chat, {
      text: replyText,
      footer: `©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`,
      viewOnce: true
    });
  } catch (error) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
    console.error('Error in credits command:', error);
    await sendInteractive(client, m, `╭─❏ 「 Eʀʀᴏʀ」
│ Something went wrong, can't show credits.\n│ Try again later, please try again.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`);
  }
};
