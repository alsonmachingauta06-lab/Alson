import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_COOKIES_PATH = '/etc/secrets/youtube-cookies.txt';

export async function getYtDlpCookieArgs(directory) {
  const sourcePath =
    process.env.YTDLP_COOKIES_PATH || DEFAULT_COOKIES_PATH;

  const temporaryPath = path.join(directory, 'youtube-cookies.txt');

  try {
    await fs.copyFile(sourcePath, temporaryPath);
    await fs.chmod(temporaryPath, 0o600);

    console.log('[YT-DLP] YouTube cookies copied to writable temporary storage.');
    return ['--cookies', temporaryPath];
  } catch (error) {
    console.warn('[YT-DLP] Cookie copy unavailable:', error.message);
    return [];
  }
}
