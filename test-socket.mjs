import toxicConnect, { useMultiFileAuthState, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys'
import pino from 'pino'

const { state } = await useMultiFileAuthState('./sessions/c76397da374f')

console.log('1. Auth OK')

const client = toxicConnect({
  printQRInTerminal: false,
  version: [2, 3000, 1043857760],
  browser: ['Ubuntu', 'Chrome', '1'],

  syncFullHistory: false,
  markOnlineOnConnect: false,
  connectTimeoutMs: 60000,
  userDevicesCache: new Map(),
  defaultQueryTimeoutMs: 60000,
  keepAliveIntervalMs: 25000,

  generateHighQualityLinkPreview: true,
  emitOwnEvents: true,
  fireInitQueries: true,
  retryRequestDelayMs: 250,
  maxMsgRetryCount: 5,
  enableAutoSessionRecreation: true,

  getMessage: async () => undefined,

  transactionOpts: {
    maxCommitRetries: 3,
    delayBetweenTriesMs: 500
  },

  patchMessageBeforeSending: (message) => {
    try {
      if (!message || typeof message !== 'object') return message

      const hasLegacyInteractive =
        !!message.buttonsMessage ||
        !!message.templateMessage ||
        !!message.listMessage

      if (!hasLegacyInteractive) return message
      if (message.viewOnceMessage || message.ephemeralMessage) return message

      return {
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadataVersion: 2,
              deviceListMetadata: {}
            },
            ...message
          }
        }
      }
    } catch {
      return message
    }
  },

  logger: pino({ level: 'silent' }),

  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(
      state.keys,
      pino({ level: 'silent' })
    )
  }
})

console.log('2. SOCKET CREATED')
