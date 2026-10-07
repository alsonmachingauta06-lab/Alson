const state = {
    githubUser: null,
    repositories: [],
    sessions: [],
    currentPage: 'dashboard'
};

const $ = (selector) => document.querySelector(selector);

async function api(url) {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.ok === false) {
        throw new Error(data.error || `Request failed: ${response.status}`);
    }

    return data;
}

function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function statusOf(session) {
    return String(session?.metadata?.status || 'unknown').toLowerCase();
}

function isOnline(session) {
    return ['connected', 'online', 'open'].includes(statusOf(session));
}

function statusClass(status) {
    const value = String(status || '').toLowerCase();

    if (['connected', 'online', 'open'].includes(value)) return 'online';
    if (value.includes('starting') || value === 'pairing') return 'starting';
    if (
        value.includes('failed') ||
        value === 'disconnected' ||
        value === 'closed'
    ) return 'offline';

    return 'unknown';
}

function maskNumber(number) {
    const value = String(number || '');

    if (value.length <= 6) return value;

    return `${value.slice(0, 3)}••••${value.slice(-3)}`;
}

function updateStats() {
    $('#botCount').textContent = state.repositories.length;
    $('#onlineCount').textContent =
        state.sessions.filter(isOnline).length;
    $('#pairedCount').textContent = state.sessions.length;
    $('#deploymentCount').textContent = '0';
}

function renderSessions() {
    const list = $('#sessionList');
    const count = $('#sessionCount');
    const summary = $('#statusSummary');

    if (!list) return;

    if (count) {
        count.textContent =
            `${state.sessions.length} session${state.sessions.length === 1 ? '' : 's'}`;
    }

    const online = state.sessions.filter(isOnline).length;
    const starting = state.sessions.filter(session =>
        statusOf(session).includes('starting') ||
        statusOf(session) === 'pairing'
    ).length;
    const failed = state.sessions.filter(session =>
        statusClass(statusOf(session)) === 'offline'
    ).length;

    if (summary) {
        summary.innerHTML = `
            <span class="summary-online">● ${online} online</span>
            <span class="summary-starting">● ${starting} starting</span>
            <span class="summary-failed">● ${failed} offline/failed</span>
        `;
    }

    if (!state.sessions.length) {
        list.innerHTML = `
            <div class="emptyState">
                <div>📱</div>
                <strong>No WhatsApp sessions</strong>
                <p>No session records were returned.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = state.sessions.map(session => {
        const status = statusOf(session);
        const cls = statusClass(status);

        return `
            <div class="session-row">
                <div class="botItemIcon">📱</div>

                <div class="session-main">
                    <strong>${escapeHTML(
                        maskNumber(session.ownerNumber)
                    )}</strong>

                    <small>
                        Session:
                        ${escapeHTML(session.sessionId)}
                    </small>
                </div>

                <span class="session-status ${cls}">
                    ${escapeHTML(status.toUpperCase())}
                </span>
            </div>
        `;
    }).join('');
}

function renderRepositories() {
    const list = $('#repoList');
    const githubUser = $('#githubUser');

    if (!list) return;

    if (githubUser) {
        githubUser.textContent =
            state.githubUser?.login
                ? `@${state.githubUser.login}`
                : 'GitHub';
    }

    if (!state.repositories.length) {
        list.innerHTML = `
            <div class="emptyState">
                <div>◈</div>
                <strong>No repositories detected</strong>
                <p>
                    GitHub may not be connected yet.
                </p>
            </div>
        `;
        return;
    }

    list.innerHTML = state.repositories.map(repo => `
        <div class="repo-row">
            <div class="botItemIcon">◈</div>

            <div>
                <strong>${escapeHTML(repo.name)}</strong>

                <small>
                    ${escapeHTML(
                        repo.description || 'No description'
                    )}
                </small>
            </div>

            <span>
                ${repo.private ? 'PRIVATE' : 'PUBLIC'}
            </span>
        </div>
    `).join('');
}

function renderBotList() {
    const container = $('#botList');

    if (!container) return;

    if (!state.repositories.length) {
        container.innerHTML = `
            <div class="emptyState">
                <div>🤖</div>
                <strong>No GitHub repositories detected</strong>
                <p>
                    Connect GitHub to discover your ALSON bots.
                </p>
            </div>
        `;
        return;
    }

    container.innerHTML = state.repositories
        .slice(0, 6)
        .map(repo => `
            <div class="botItem">
                <div class="botItemIcon">🤖</div>

                <div class="botItemInfo">
                    <strong>${escapeHTML(repo.name)}</strong>

                    <small>
                        ${escapeHTML(
                            repo.description ||
                            'GitHub repository'
                        )}
                    </small>
                </div>

                <div class="botItemStatus">
                    ${repo.private ? 'PRIVATE' : 'PUBLIC'}
                </div>
            </div>
        `)
        .join('');
}

function showAIMessage(message) {
    const box = $('.aiMessage');

    if (!box) return;

    box.innerHTML = `
        <strong>Welcome to Alson-XMD Dashboard.</strong>
        <p>${escapeHTML(message)}</p>
    `;
}

function scrollToSection(selector) {
    const element = $(selector);

    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

function navigate(page) {
    state.currentPage = page;

    document
        .querySelectorAll('.navItem')
        .forEach(item => {
            item.classList.toggle(
                'active',
                item.dataset.page === page
            );
        });

    if (page === 'dashboard') {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });

        showAIMessage(
            'Welcome back. Your ALSON-XMD Control Center is ready.'
        );

        return;
    }

    if (page === 'bots') {
        scrollToSection('.botsPanel');

        showAIMessage(
            `Bot Fleet selected. ${state.repositories.length} ` +
            'repository/repositories are available.'
        );

        return;
    }

    if (page === 'deploy') {
        scrollToSection('.botsPanel');

        showAIMessage(
            'Deploy Center selected. Choose a GitHub repository ' +
            'to use as your deployment source.'
        );

        return;
    }

    if (page === 'github') {
        scrollToSection('.managementWorkspace');

        showAIMessage(
            `GitHub Center selected. ${state.repositories.length} ` +
            'repositories are currently available.'
        );

        return;
    }

    if (page === 'sessions') {
        scrollToSection('.managementPanel');

        showAIMessage(
            `WhatsApp Center selected. ${state.sessions.length} ` +
            'session records are currently available.'
        );
    }
}

function setupNavigation() {
    document
        .querySelectorAll('[data-page]')
        .forEach(button => {
            button.addEventListener('click', event => {
                event.preventDefault();
                navigate(button.dataset.page);
            });
        });
}

function setupAI() {
    const input = $('#aiInput');
    const button = $('#aiSend');

    if (!input || !button) return;

    const respond = () => {
        const question = input.value.trim();

        if (!question) return;

        const text = question.toLowerCase();

        let answer =
            'I can guide you through GitHub, deployments, ' +
            'WhatsApp pairing, sessions and bot management.';

        if (
            text.includes('whatsapp') ||
            text.includes('pair') ||
            text.includes('session')
        ) {
            answer =
                `There are ${state.sessions.length} WhatsApp ` +
                'session records available in the Control Center.';

            navigate('sessions');
        } else if (text.includes('github')) {
            answer =
                `GitHub currently has ${state.repositories.length} ` +
                'repositories available to the dashboard.';

            navigate('github');
        } else if (text.includes('deploy')) {
            answer =
                'The Deploy Center is ready for selecting a ' +
                'GitHub repository and branch.';

            navigate('deploy');
        } else if (text.includes('bot')) {
            answer =
                `${state.repositories.length} repositories are currently available to the Control Center.`;

            navigate('bots');
        }

        showAIMessage(answer);
        input.value = '';
    };

    button.addEventListener('click', respond);

    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            respond();
        }
    });
}

async function loadDashboard() {
    try {
        const data = await api('/api/whatsapp/sessions');

        state.sessions = data.sessions || [];
    } catch (error) {
        console.error(
            '[Dashboard] WhatsApp:',
            error.message
        );
    }

    try {
        const data = await api('/api/github/repos');

        state.repositories = data.repositories || [];
    } catch (error) {
        console.warn(
            '[Dashboard] GitHub:',
            error.message
        );
    }

    try {
        const data = await api('/api/github/me');

        state.githubUser = data.user || null;
    } catch (error) {
        console.warn(
            '[Dashboard] GitHub account:',
            error.message
        );
    }

    updateStats();
    renderBotList();
    renderSessions();
    renderRepositories();
}

setupNavigation();
setupAI();
loadDashboard();

setInterval(loadDashboard, 10000);
