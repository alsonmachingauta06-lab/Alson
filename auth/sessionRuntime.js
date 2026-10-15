const runtimes = new Map();

function makeRuntime(ownerNumber, opts = {}) {
    const sessionId = opts.sessionId || 'toxic-main';
    const sessionDir = opts.sessionDir || `./auth/sessions/${sessionId}`;
    
    return {
        sessionId,
        ownerNumber,
        sessionDir,
        sessionName: sessionDir,
        client: null,
        store: null,
        starting: false,
        shuttingDown: false,
        reconnectAttempts: 0,
        lastActivity: Date.now(),
        seenIds: new Set(),
        followed: false,
        reconnectTimer: null,
        timers: {
            cleanup: null,
            memoryCheck: null,
            autobio: null,
            storeWrite: null,
            processedCalls: null,
            watchdog: null
        },
        connection: {
            keepalive: null,
            drainInterval: null,
            drainTimer: null,
            ghost: null,
            sessionTs: 0,
            connectTime: 0,
            realTime: false,
            batchPoll: null
        },
        presenceMap: new Map(),
        groupMetaCache: new Map(),
        messageCounts: {},
        messageCountsToday: {},
        messageCountsByGroup: {},
        stickerCounts: {},
        stickerCountsByGroup: {},
        pushNames: new Map(),
        status: 'init'
    };
}

export function createRuntime(ownerNumber, options = {}) {
    const sessionId = options.sessionId || 'toxic-main';
    if (runtimes.has(sessionId)) {
        const existing = runtimes.get(sessionId);
        // update owner if needed
        existing.ownerNumber = ownerNumber;
        return existing;
    }
    const runtime = makeRuntime(ownerNumber, options);
    runtimes.set(sessionId, runtime);
    return runtime;
}

export function getRuntime(sessionId) {
    return runtimes.get(sessionId) || null;
}

export function getAllRuntimes() {
    return Array.from(runtimes.values());
}

export function attachClient(sessionId, client) {
    const rt = runtimes.get(sessionId);
    if (rt) rt.client = client;
}

export function attachStore(sessionId, store) {
    const rt = runtimes.get(sessionId);
    if (rt) rt.store = store;
}

export function markConnected(sessionId) {
    const rt = runtimes.get(sessionId);
    if (rt) rt.status = 'connected';
}

export function markDisconnected(sessionId) {
    const rt = runtimes.get(sessionId);
    if (rt) rt.status = 'disconnected';
}

export function touch(sessionId) {
    const rt = runtimes.get(sessionId);
    if (rt) rt.lastActivity = Date.now();
}

export function destroyRuntime(sessionId, force = false) {
    const rt = runtimes.get(sessionId);
    if (!rt) return;
    try {
        if (rt.reconnectTimer) clearTimeout(rt.reconnectTimer);
        Object.values(rt.timers).forEach(t => { if (t) clearTimeout(t); clearInterval(t); });
        Object.values(rt.connection).forEach(t => { if (t) clearTimeout(t); clearInterval(t); });
    } catch {}
    if (force) runtimes.delete(sessionId);
    else rt.status = 'destroyed';
}

export default {
    createRuntime,
    getRuntime,
    getAllRuntimes,
    attachClient,
    attachStore,
    markConnected,
    markDisconnected,
    touch,
    destroyRuntime
};
