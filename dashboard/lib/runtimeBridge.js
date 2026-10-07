import {
    startToxic,
    getPairingCode,
    clearPairingCode
} from '../../index.js';

import {
    getRuntime,
    getAllRuntimes,
    destroyRuntime
} from '../../auth/sessionRuntime.js';

import {
    get,
    list,
    update
} from '../../auth/sessionManager.js';

async function startWhatsAppRuntime(ownerNumber, sessionId) {
    if (!ownerNumber) {
        throw new Error('WhatsApp number is required');
    }

    if (!sessionId) {
        throw new Error('Session ID is required');
    }

    const runtime = await startToxic(ownerNumber, {
        sessionId
    });

    return {
        sessionId: runtime.sessionId,
        ownerNumber: runtime.ownerNumber,
        status: runtime.status
    };
}

function getRuntimeStatus(sessionId) {
    const runtime = getRuntime(sessionId);
    const session = get(sessionId);

    if (!runtime && !session) {
        return null;
    }

    return {
        sessionId,
        ownerNumber:
            runtime?.ownerNumber ||
            session?.ownerNumber ||
            '',
        status:
            runtime?.status ||
            session?.metadata?.status ||
            'unknown',
        connectedAt:
            runtime?.connectedAt ||
            null,
        pairingCode:
            getPairingCode(sessionId)?.code ||
            null
    };
}

function getAllRuntimeStatuses() {
    const sessions = list();

    return sessions.map(session => {
        const status = getRuntimeStatus(session.sessionId);

        return status || {
            sessionId: session.sessionId,
            ownerNumber: session.ownerNumber,
            status: 'unknown'
        };
    });
}

async function stopWhatsAppRuntime(sessionId) {
    if (!sessionId) {
        throw new Error('Session ID is required');
    }

    const runtime = getRuntime(sessionId);

    if (runtime) {
        await destroyRuntime(sessionId);
    }

    clearPairingCode(sessionId);

    update(sessionId, {
        status: 'stopped'
    });

    return getRuntimeStatus(sessionId);
}

export {
    startWhatsAppRuntime,
    getRuntimeStatus,
    getAllRuntimeStatuses,
    stopWhatsAppRuntime
};
