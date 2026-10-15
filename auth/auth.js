import fs from 'fs';
import path from 'path';

const authFolder = path.join(process.cwd(), 'auth');
if (!fs.existsSync(authFolder)) {
    fs.mkdirSync(authFolder, { recursive: true });
}

export function getAuth() {
    return {
        folder: authFolder,
        creds: path.join(authFolder, 'creds.json')
    };
}

export default { getAuth };
