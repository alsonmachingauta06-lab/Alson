const botname = process.env.BOTNAME || 'ALSON-XMD';
const mycode = process.env.CODE || '263';
const timezone = process.env.TZ || 'Africa/Harare';

const rawPrefix = process.env.ALSON_PREFIX;

const prefix =
    rawPrefix === undefined
        ? '.'
        : rawPrefix.toLowerCase() === 'none'
            ? ''
            : rawPrefix;

const herokuAppName = '';
const session = '';

function getHerokuApiKey() {
    return '';
}

export {
    session,
    mycode,
    botname,
    timezone,
    prefix,
    herokuAppName,
    getHerokuApiKey
};
