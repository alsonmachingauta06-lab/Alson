const runtimes = new Map();

function makeRuntime(ownerNumber, opts = {}) {
    const sanitizedOwner = String(ownerNumber || '').replace(/\D/g, '') || 'unknown';
    const sessionId = opts.sessionId || `session-${sanitizedOwner}`;
    const sessionDir = opts.sessionDir || `./auth/sessions/${sessionId}`;
    
    return {
        sessionId,
        ownerNumber: sanitizedOwner,
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
        status: 'init',
        metadata: {}
    };
}

export function createRuntime(ownerNumber, options = {}) {
    const sanitizedOwner = String(ownerNumber || '').replace(/\D/g, '') || 'unknown';
    const sessionId = options.sessionId || `session-${sanitizedOwner}`;
    if (runtimes.has(sessionId)) {
        const existing = runtimes.get(sessionId);
        // update owner if needed
        existing.ownerNumber = sanitizedOwner;
        return existing;
    }
    const runtime = makeRuntime(sanitizedOwner, options);
    // populate metadata convenience field
    runtime.metadata = { status: runtime.status };
    runtimes.set(sessionId, runtime);
    return runtime;
}

export function getRuntime(sessionId) {
    return runtimes.get(sessionId) || null;
}

export function getAllRuntimes() {
    return Array.from(runtimes.values());
}

// convenience compatibility helpers expected by other modules
export function list() {
    return getAllRuntimes().map(rt => ({
        sessionId: rt.sessionId,
        ownerNumber: rt.ownerNumber,
        sessionDir: rt.sessionDir,
        metadata: { status: rt.status }
    }));
}

export function get(key) {
    if (!key) return null;
    const asId = String(key);
    if (runtimes.has(asId)) return runtimes.get(asId);
    // try to find by ownerNumber
    for (const rt of runtimes.values()) {
        if (rt.ownerNumber === String(key).replace(/\D/g, '')) return rt;
    }
    return null;
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
    if (rt) {
        rt.status = 'connected';
        rt.metadata = rt.metadata || {};
        rt.metadata.status = rt.status;
    }
}

export function markDisconnected(sessionId, status = 'disconnected') {
    const rt = runtimes.get(sessionId);
    if (rt) {
        rt.status = status || 'disconnected';
        rt.metadata = rt.metadata || {};
        rt.metadata.status = rt.status;
    }
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
        Object.values(rt.timers).forEach(t => { if (t) clearTimeout(t); if (t) clearInterval(t); });
        Object.values(rt.connection).forEach(t => { if (t) clearTimeout(t); if (t) clearInterval(t); });
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
    destroyRuntime,
    list,
    get
};