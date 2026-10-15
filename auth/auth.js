import fs from 'fs';
import path from 'path';

const authFolder = path.join(process.cwd(), 'auth');
if (!fs.existsSync(authFolder)) {
    fs.mkdirSync(authFolder, {recursive: true});
}

const credsPath = path.join(authFolder, 'creds.json');

// If SESSION_ID env exists, decode it to creds.json
if (process.env.SESSION_ID && !fs.existsSync(credsPath)) {
    try {
        let session = process.env.SESSION_ID;
        if (session.startsWith('Alson~')) {
            session = session.slice(6);
        }
        const decoded = Buffer.from(session, 'base64').toString('utf-8');
        fs.writeFileSync(credsPath, decoded);
        console.log('✓ Session decoded to auth/creds.json');
    } catch (e) {
        console.log('Failed to decode SESSION_ID, will use pairing code:', e.message);
    }
}

export default function() {
    return {
        credsPath,
        authFolder
    };
}
