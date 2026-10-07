import {
    default as makeWASocket,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';

import pino from 'pino';

import { sendInteractive } from '../../lib/sendInteractive.js';

import {
    createRuntime,
    attachClient,
    markConnected,
    markDisconnected,
    list,
    get
} from '../../auth/sessionRuntime.js';


function cleanNumber(input) {
    let number = String(input || '')
        .replace(/[\s\-\(\)\+\.]/g, '')
        .replace(/[^0-9]/g, '');

    if (number.startsWith('00')) {
        number = number.slice(2);
    }

    return number;
}


function findExistingSession(number) {
    const sessions = list();

    return sessions.find(session => {
        const owner = String(session.ownerNumber || '')
            .replace(/\D/g, '');

        return owner === number;
    }) || null;
}


async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


export default {
    name: 'pair',

    aliases: [
        'getcode',
        'paircode',
        'pairingcode',
        'connect'
    ],

    description:
        'Generates a persistent WhatsApp multi-device pairing session',

    run: async (context) => {
        const {
            client,
            m,
            text,
            prefix
        } = context;

        let runtime = null;
        let pairSocket = null;

        try {
            /*
             * ---------------------------------------------------------
             * NUMBER VALIDATION
             * ---------------------------------------------------------
             */

            if (!text) {
                return await sendInteractive(
                    client,
                    m,
                    `╭─❏ 「 Pᴀɪʀɪɴɢ 」
│ Give me a WhatsApp number to pair.
│
│ Usage:
│ *${prefix}pair <number>*
│
│ Example:
│ *${prefix}pair 263783549857*
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
│
│ Include the country code.
╰───────────────
> ALSON-XMD`
                );
            }


            /*
             * ---------------------------------------------------------
             * CHECK WHETHER THIS NUMBER ALREADY HAS A SESSION
             * ---------------------------------------------------------
             */

            const existing = findExistingSession(number);

            let sessionId;
            let reusableSession = false;

            if (existing) {
                const metadata = existing.metadata || {};

                reusableSession =
                    metadata.status === 'connected' ||
                    metadata.status === 'logged_in';

                if (reusableSession) {
                    sessionId = existing.sessionId;

                    console.log(
                        `[ALSON-XMD] Reusing connected session ${sessionId} for ${number}`
                    );
                } else {
                    console.log(
                        `[ALSON-XMD] Existing session ${existing.sessionId} is not connected. Creating a fresh pairing session for ${number}`
                    );
                }
            }


            /*
             * ---------------------------------------------------------
             * START MESSAGE
             * ---------------------------------------------------------
             */

            await client.sendMessage(m.chat, {
                react: {
                    text: '⌛',
                    key: m.reactKey
                }
            }).catch(() => {});


            await sendInteractive(
                client,
                m,
                `╭─❏ 「 Pᴀɪʀɪɴɢ 」
│ Number: ${number}
│
│ ${existing
                    ? 'Resuming existing session...'
                    : 'Creating persistent session...'}
│
│ Please wait...
╰───────────────
> ALSON-XMD`
            );


            /*
             * ---------------------------------------------------------
             * CREATE OR REUSE PERSISTENT SESSION
             * ---------------------------------------------------------
             */

            runtime = createRuntime(
                number,
                reusableSession
                    ? { sessionId }
                    : {}
            );


            runtime.sessionConfig = {
                number,
                pairedFrom: m.chat,
                pairedAt: new Date().toISOString()
            };


            /*
             * ---------------------------------------------------------
             * LOAD BAILEYS AUTH STATE
             * ---------------------------------------------------------
             */

            const {
                state,
                saveCreds
            } = await useMultiFileAuthState(
                runtime.sessionDir
            );


            /*
             * ---------------------------------------------------------
             * BAILEYS VERSION
             * ---------------------------------------------------------
             */

            const {
                version,
                isLatest
            } = await fetchLatestBaileysVersion();

            console.log(
                `[ALSON-XMD] Pairing ${number} using Baileys ${version.join('.')} latest=${isLatest}`
            );


            /*
             * ---------------------------------------------------------
             * CREATE INDEPENDENT SOCKET
             * ---------------------------------------------------------
             */

            pairSocket = makeWASocket({
                version,

                auth: {
                    creds: state.creds,

                    keys: makeCacheableSignalKeyStore(
                        state.keys,
                        pino({
                            level: 'silent'
                        })
                    )
                },

                printQRInTerminal: false,

                logger: pino({
                    level: 'silent'
                }),

                browser: [
                    'Ubuntu',
                    'Chrome',
                    '22.04.4'
                ],

                syncFullHistory: false,

                generateHighQualityLinkPreview: true,

                markOnlineOnConnect: true,

                connectTimeoutMs: 120000,

                keepAliveIntervalMs: 30000,

                defaultQueryTimeoutMs: 60000,

                transactionOpts: {
                    maxCommitRetries: 10,
                    delayBetweenTriesMs: 3000
                },

                retryRequestDelayMs: 10000,

                getMessage: async () => undefined
            });


            /*
             * ---------------------------------------------------------
             * ATTACH SOCKET TO RUNTIME
             * ---------------------------------------------------------
             */

            attachClient(
                runtime.sessionId,
                pairSocket
            );


            /*
             * ---------------------------------------------------------
             * SAVE CREDENTIALS
             * ---------------------------------------------------------
             */

            pairSocket.ev.on(
                'creds.update',
                saveCreds
            );


            /*
             * ---------------------------------------------------------
             * CONNECTION MONITOR
             * ---------------------------------------------------------
             */

            pairSocket.ev.on(
                'connection.update',
                async ({
                    connection,
                    lastDisconnect,
                    isNewLogin
                }) => {

                    console.log(
                        `[ALSON-XMD] ${number} connection: ${connection || 'unknown'}`
                    );


                    if (connection === 'open') {

                        markConnected(
                            runtime.sessionId
                        );

                        console.log(
                            `[ALSON-XMD] ✅ ${number} successfully connected`
                        );

                        return;
                    }


                    if (connection === 'close') {

                        const statusCode =
                            lastDisconnect?.error?.output?.statusCode ??
                            lastDisconnect?.error?.statusCode ??
                            null;

                        const errorMessage =
                            lastDisconnect?.error?.message ||
                            'connection closed';

                        console.log(
                            `[ALSON-XMD] ❌ ${number} disconnected`,
                            {
                                statusCode,
                                error: errorMessage,
                                isNewLogin: !!isNewLogin
                            }
                        );


                        markDisconnected(
                            runtime.sessionId,
                            statusCode === 401
                                ? 'logged_out'
                                : 'disconnected'
                        );
                    }
                }
            );


            /*
             * ---------------------------------------------------------
             * ALREADY REGISTERED?
             * ---------------------------------------------------------
             */

            if (state.creds.registered) {

                markConnected(
                    runtime.sessionId
                );

                await client.sendMessage(m.chat, {
                    react: {
                        text: '✅',
                        key: m.reactKey
                    }
                }).catch(() => {});

                return await sendInteractive(
                    client,
                    m,
                    `╭─❏ 「 Aʟʀᴇᴀᴅʏ Pᴀɪʀᴇᴅ 」
│ Number: ${number}
│
│ This number already has
│ a registered WhatsApp session.
│
│ Session: ${runtime.sessionId}
│
│ No new pairing code was generated.
╰───────────────
> ALSON-XMD`
                );
            }


            /*
             * ---------------------------------------------------------
             * WAIT UNTIL BAILEYS IS READY FOR PAIRING
             *
             * Baileys emits a QR event even when using pairing-code
             * authentication. That event is the reliable signal that
             * requestPairingCode() can be called.
             * ---------------------------------------------------------
             */

            await new Promise((resolve, reject) => {

                let settled = false;

                const timeout = setTimeout(() => {

                    if (settled) return;

                    settled = true;

                    reject(
                        new Error(
                            'WhatsApp pairing socket did not become ready within 30 seconds.'
                        )
                    );

                }, 30000);


                const onUpdate = ({ qr, connection }) => {

                    if (settled) return;


                    if (connection === 'close') {

                        clearTimeout(timeout);

                        settled = true;

                        reject(
                            new Error(
                                'WhatsApp closed the pairing connection before the pairing code was requested.'
                            )
                        );

                        return;
                    }


                    if (qr) {

                        clearTimeout(timeout);

                        settled = true;

                        resolve();

                    }

                };


                pairSocket.ev.on(
                    'connection.update',
                    onUpdate
                );

            });


            /*
             * ---------------------------------------------------------
             * REQUEST PAIRING CODE
             * ---------------------------------------------------------
             */

            console.log(
                `[ALSON-XMD] Requesting pairing code for ${number}`
            );


            const code =
                await pairSocket.requestPairingCode(
                    number
                );


            if (!code) {
                throw new Error(
                    'WhatsApp did not return a pairing code.'
                );
            }


            const formattedCode =
                code
                    .match(/.{1,4}/g)
                    ?.join('-') ||
                code;


            /*
             * ---------------------------------------------------------
             * SEND CODE TO USER
             * ---------------------------------------------------------
             */

            await sendInteractive(
                client,
                m,
                `╭─❏ 「 Pᴀɪʀɪɴɢ Cᴏᴅᴇ 」
│ Number: ${number}
│
│ Code: *${formattedCode}*
│
│ On the target WhatsApp:
│
│ 1. Open WhatsApp
│ 2. Go to Linked devices
│ 3. Tap Link a device
│ 4. Choose “Link with phone
│    number instead”
│ 5. Enter the code above
│
│ Keep ALSON-XMD running
│ until the phone finishes linking.
│
│ Session: ${runtime.sessionId}
╰───────────────
> ALSON-XMD`
            );


            await client.sendMessage(m.chat, {
                react: {
                    text: '✅',
                    key: m.reactKey
                }
            }).catch(() => {});


            /*
             * ---------------------------------------------------------
             * IMPORTANT:
             *
             * DO NOT CLOSE pairSocket.
             * DO NOT DELETE runtime.sessionDir.
             *
             * The socket must remain alive so WhatsApp
             * can complete the pairing.
             * ---------------------------------------------------------
             */

            console.log(
                `[ALSON-XMD] ⏳ Waiting for ${number} to complete pairing...`
            );

        } catch (error) {

            console.error(
                '[ALSON-XMD] Pair error:',
                error
            );


            if (runtime) {
                markDisconnected(
                    runtime.sessionId,
                    'pairing_failed'
                );
            }


            await client.sendMessage(m.chat, {
                react: {
                    text: '❌',
                    key: m.reactKey
                }
            }).catch(() => {});


            await sendInteractive(
                client,
                m,
                `╭─❏ 「 Pᴀɪʀɪɴɢ Fᴀɪʟᴇᴅ 」
│ ${error?.message || 'Unknown error'}
│
│ Number: ${cleanNumber(text)}
│
│ The persistent session could
│ not be started.
│
│ The session directory was kept
│ so it can be retried safely.
╰───────────────
> ALSON-XMD`
            ).catch(() => {});
        }
    }
};
