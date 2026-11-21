import fs from 'node:fs/promises';

const DEFAULT_COOKIES_PATH = '/etc/secrets/youtube-cookies.txt';

export async function getYtDlpCookieArgs() {
  const cookiesPath =
    process.env.YTDLP_COOKIES_PATH || DEFAULT_COOKIES_PATH;

  try {
    await fs.access(cookiesPath);
    console.log('[YT-DLP] YouTube cookie file detected; authenticated download enabled.');
    return ['--cookies', cookiesPath];
  } catch {
    console.warn('[YT-DLP] YouTube cookie file not found; continuing without cookies.');
    return [];
  }
}
