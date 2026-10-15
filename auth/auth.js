import fs from 'fs';
import path from 'path';

const BASE_AUTH_DIR = path.join(process.cwd(), 'auth');
const SESSIONS_DIR = path.join(BASE_AUTH_DIR, 'sessions');

if (!fs.existsSync(BASE_AUTH_DIR)) fs.mkdirSync(BASE_AUTH_DIR, { recursive: true });
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

export function getSessionAuthDir(sessionId = 'toxic-main') {
    const dir = path.join(SESSIONS_DIR, sessionId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

export function getSessionCredsPath(sessionId = 'toxic-main') {
    return path.join(getSessionAuthDir(sessionId), 'creds.json');
}

export function hasCredentials(sessionId = 'toxic-main') {
    return fs.existsSync(getSessionCredsPath(sessionId));
}

export function ensureSession(sessionId = 'toxic-main') {
    const dir = getSessionAuthDir(sessionId);
    return dir;
}

export function markStatus(sessionId, status) {
    console.log(`[SESSION] ${sessionId}: ${status}`);
}

export default {
    ensureSession,
    getSessionAuthDir,
    getSessionCredsPath,
    hasCredentials,
    markStatus
};
