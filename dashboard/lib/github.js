const GITHUB_API = 'https://api.github.com';

function getToken() {
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
        throw new Error(
            'GITHUB_TOKEN is not configured on the server.'
        );
    }

    return token;
}

async function githubRequest(endpoint, options = {}) {
    const token = getToken();

    const response = await fetch(`${GITHUB_API}${endpoint}`, {
        ...options,
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            ...(options.headers || {})
        }
    });

    const text = await response.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!response.ok) {
        const message =
            typeof data === 'object' && data?.message
                ? data.message
                : `GitHub API error ${response.status}`;

        throw new Error(message);
    }

    return data;
}

export async function getViewer() {
    return githubRequest('/user');
}

export async function listRepositories(options = {}) {
    const page = options.page || 1;
    const perPage = options.perPage || 100;

    return githubRequest(
        `/user/repos?per_page=${perPage}&page=${page}&sort=updated`
    );
}

export async function getRepository(owner, repo) {
    return githubRequest(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
    );
}

export async function listBranches(owner, repo) {
    return githubRequest(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`
    );
}

export async function getContents(owner, repo, filePath = '', ref = '') {
    const encodedPath = filePath
        .split('/')
        .filter(Boolean)
        .map(encodeURIComponent)
        .join('/');

    const query = ref
        ? `?ref=${encodeURIComponent(ref)}`
        : '';

    return githubRequest(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}${query}`
    );
}
