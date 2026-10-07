const Ownermiddleware = async (context, next) => {
    const { m, Owner } = context;

    if (!Owner) {
        return m.reply(`╭─❏ 「 Aᴄᴄᴇss Dᴇɴɪᴇᴅ」
│ You dare use an Owner command?\n│ Your mere existence insults\n│ my code. Crawl back to the\n│ abyss where mediocrity thrives.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐀𝐥𝐬𝐨𝐧`);
    }

    await next();
};

export default Ownermiddleware;
