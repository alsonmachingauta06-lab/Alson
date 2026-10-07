import {
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import pino from 'pino';
import {
    generateWAMessageFromContent,
    proto
} from '@whiskeysockets/baileys';

import { sendInteractive } from '../../lib/sendInteractive.js';
import {
    createRuntime,
    attachClient,
    attachStore,
    markConnected,
    markDisconnected
} from '../../auth/sessionRuntime.js';

function cleanNumber(input) {
    let num = String(input || '').replace(/[\s\-\(\)\+\.]/g, '');
    num = num.replace(/[^0-9]/g, '');

    if (num.startsWith('00')) {
        num = num.slice(2);
    }

    return num;
}

export default {
    name: 'pair',
    aliases: ['getcode', 'paircode', 'pairingcode', 'connect'],
    description: 'Generates a persistent WhatsApp multi-device pairing session',

    run: async (context) => {
        const { client, m, text, prefix } = context;

        await client.sendMessage(m.chat, {
            react: { text: '⌛', key: m.reactKey }
        });

        let runtime = null;

        try {
            if (!text) {
                return await sendInteractive(
                    client,
                    m,
                    `╭─❏ 「 Pᴀɪʀɪɴɢ 」
│ Give me a WhatsApp number to pair.
│
│ Usage: *${prefix}pair <number>*
│ Example: *${prefix}pair 263783549857*
│
│ Include the country code.
╰───────────────
> ALSON-XMD`
                );
            }

            const number = cleanNumber(text);

            if (number.length < 6 || number.length > 15) {
                return await sendInteractive(
                    client,
                    m,
                    `╭─❏ 「 Iɴᴠᴀʟɪᴅ Nᴜᴍʙᴇʀ 」
│ Invalid WhatsApp number.
│
│ Cleaned: ${number}
│ Required: 6-15 digits
│ Include the country code.
╰───────────────
> ALSON-XMD`
                );
            }

            await client.sendMessage(m.chat, {
                react: { text: '⌛', key: m.reactKey }
            });

            await sendInteractive(
                client,
                m,
                `╭─❏ 「 Pᴀɪʀɪɴɢ 」
│ Number: ${number}
│
│ Creating a persistent session...
│ Please wait.
╰───────────────
> ALSON-XMD`
            );

            // Create the permanent session.
            runtime = createRuntime(number);

            const { version } = await fetchLatestBaileysVersion();

            const { state, saveCreds } =
                await useMultiFileAuthState(runtime.sessionDir);

            const pairSocket = (await import('@whiskeysockets/baileys'))
                .default({
                    version,
                    auth: {
                        creds: state.creds,
                        keys: makeCacheableSignalKeyStore(
                            state.keys,
                            pino({ level: 'silent' })
                        )
                    },
                    printQRInTerminal: false,
                    logger: pino({ level: 'silent' }),
                    browser: ['ALSON-XMD', 'Chrome', '1.0.0'],
                    syncFullHistory: false,
                    generateHighQualityLinkPreview: true,
                    getMessage: async () => undefined,
                    markOnlineOnConnect: true,
                    connectTimeoutMs: 120000,
                    keepAliveIntervalMs: 30000,
                    defaultQueryTimeoutMs: 60000,
                    transactionOpts: {
                        maxCommitRetries: 10,
                        delayBetweenTriesMs: 3000
                    },
                    retryRequestDelayMs: 10000
                });

            runtime.sessionConfig = {
                number,
                pairedFrom: m.chat,
                pairedAt: new Date().toISOString()
            };

            attachClient(runtime.sessionId, pairSocket);

            pairSocket.ev.on('creds.update', saveCreds);

            pairSocket.ev.on('connection.update', ({ connection, lastDisconnect }) => {
                if (connection === 'open') {
                    markConnected(runtime.sessionId);
                }

                if (connection === 'close') {
                    markDisconnected(runtime.sessionId, 'disconnected');
                }
            });

            await new Promise(resolve => setTimeout(resolve, 3000));

            const code = await pairSocket.requestPairingCode(number);

            if (!code) {
                throw new Error('Pairing code generation failed.');
            }

            const formattedCode =
                code.match(/.{1,4}/g)?.join('-') || code;

            const ctaMsg = generateWAMessageFromContent(
                m.chat,
                {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage:
                                proto.Message.InteractiveMessage.create({
                                    body:
                                        proto.Message.InteractiveMessage.Body.create({
                                            text:
`╭─❏ 「 Pᴀɪʀɪɴɢ Cᴏᴅᴇ 」
│ Number: ${number}
│ Session: ${runtime.sessionId}
│
│ Code: *${formattedCode}*
│
│ Open WhatsApp → Linked Devices
│ and enter this pairing code.
│
│ This session will remain saved
│ after pairing.
╰───────────────
> ALSON-XMD`
                                        }),

                                    footer:
                                        proto.Message.InteractiveMessage.Footer.create({
                                            text: 'ALSON-XMD Pairing System'
                                        }),

                                    nativeFlowMessage:
                                        proto.Message.InteractiveMessage.NativeFlowMessage.create({
                                            buttons: [
                                                {
                                                    name: 'cta_copy',
                                                    buttonParamsJson:
                                                        JSON.stringify({
                                                            display_text:
                                                                'Copy Pairing Code',
                                                            id: 'copy_code',
                                                            copy_code:
                                                                formattedCode
                                                        })
                                                }
                                            ]
                                        })
                                })
                        }
                    }
                }
            );

            await client.sendMessage(m.chat, {
                react: { text: '✅', key: m.reactKey }
            });

            try {
                await client.relayMessage(
                    m.chat,
                    ctaMsg.message,
                    { messageId: ctaMsg.key.id }
                );
            } catch {
                await sendInteractive(
                    client,
                    m,
                    `╭─❏ 「 Pᴀɪʀɪɴɢ Cᴏᴅᴇ 」
│ Number: ${number}
│ Session: ${runtime.sessionId}
│
│ Code: *${formattedCode}*
│
│ Enter this code in:
│ WhatsApp → Linked Devices
╰───────────────
> ALSON-XMD`
                );
            }

            // IMPORTANT:
            // Do NOT close the socket.
            // Do NOT delete the session directory.
            // The runtime remains alive for this session.

        } catch (error) {
            console.error('[ALSON-XMD] Pair error:', error);

            if (runtime) {
                markDisconnected(runtime.sessionId, 'pairing_failed');
            }

            await client.sendMessage(m.chat, {
                react: { text: '❌', key: m.reactKey }
            }).catch(() => {});

            await sendInteractive(
                client,
                m,
                `╭─❏ 「 Pᴀɪʀɪɴɢ Fᴀɪʟᴇᴅ 」
│ ${error.message || 'Unknown error'}
│
│ The persistent session could
│ not be created.
╰───────────────
> ALSON-XMD`
            ).catch(() => {});
        }
    }
};
