import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
    list as listWhatsAppSessions
} from '../auth/sessionManager.js';

import {
    getViewer,
    listRepositories
} from './lib/github.js';

import {
    createDeployment,
    getDeployment,
    listDeployments,
    updateDeployment,
    cloneDeployment
} from './lib/deploymentManager.js';

import {
    startWhatsAppRuntime,
    getRuntimeStatus,
    getAllRuntimeStatuses,
    stopWhatsAppRuntime
} from './lib/runtimeBridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, 'public');
const ASSET_DIR = path.join(__dirname, '..', 'assets');
const PORT = Number(process.env.DASHBOARD_PORT || 3000);

function readJSON(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", chunk => { body += chunk; });
        req.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (error) {
                reject(new Error("Invalid JSON body"));
            }
        });
        req.on("error", reject);
    });
}

function sendJSON(res, data, status = 200) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });

    res.end(JSON.stringify(data));
}

function sendError(res, error, status = 500) {
    console.error('[DASHBOARD]', error);

    sendJSON(res, {
        ok: false,
        error: error.message || 'Internal server error'
    }, status);
}

async function serveAsset(req, res) {
    const requested = req.url.replace('/assets/', '');

    if (
        !requested ||
        requested.includes('..') ||
        requested !== 'alson-xmd.png'
    ) {
        return sendJSON(res, {
            ok: false,
            error: 'Invalid asset'
        }, 400);
    }

    const filePath = path.join(ASSET_DIR, requested);

    if (!fs.existsSync(filePath)) {
        return sendJSON(res, {
            ok: false,
            error: 'Asset not found'
        }, 404);
    }

    res.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600'
    });

    fs.createReadStream(filePath).pipe(res);
}

async function api(req, res) {
    if (req.url === '/api/github/me') {
        return sendJSON(res, {
            ok: true,
            user: await getViewer()
        });
    }

    if (req.url === '/api/github/repos') {
        return sendJSON(res, {
            ok: true,
            repositories: await listRepositories()
        });
    }

    
if (req.url === '/api/deployments' && req.method === 'GET') {
    return sendJSON(res, {
        ok: true,
        deployments: listDeployments()
    });
}

if (req.url === '/api/runtime/status' && req.method === 'GET') {
    return sendJSON(res, {
        ok: true,
        sessions: getAllRuntimeStatuses()
    });
}

if (req.url === '/api/deployments' && req.method === 'POST') {
    try {
        const body = await readJSON(req);

        const deployment = createDeployment({
            ownerNumber: body.ownerNumber,
            repository: body.repository,
            branch: body.branch || 'main'
        });

        return sendJSON(res, {
            ok: true,
            deployment: {
                deploymentId: deployment.deploymentId,
                ownerNumber: deployment.ownerNumber,
                repository: deployment.repository,
                branch: deployment.branch,
                status: deployment.status
            }
        }, 201);
    } catch (error) {
        return sendJSON(res, {
            ok: false,
            error: error.message
        }, 400);
    }
}

if (req.url.startsWith('/api/deployments/') && req.method === 'POST') {
    const parts = req.url.split('/').filter(Boolean);
    const deploymentId = parts[2];
    const action = parts[3];

    if (action === 'deploy') {
        const deployment = getDeployment(deploymentId);

        if (!deployment) {
            return sendJSON(res, {
                ok: false,
                error: 'Deployment not found'
            }, 404);
        }

        try {
            const match = String(deployment.repository).match(
                /^alsonmachingauta06-lab\/([A-Za-z0-9._-]+)$/
            );

            if (!match) {
                throw new Error(
                    'Repository is outside the allowed ALSON GitHub scope'
                );
            }

            const repoUrl =
                `https://github.com/alsonmachingauta06-lab/${match[1]}.git`;

            const result = await cloneDeployment(
                deploymentId,
                repoUrl,
                deployment.branch || 'main'
            );

            return sendJSON(res, {
                ok: true,
                deployment: {
                    deploymentId: result.deploymentId,
                    repository: result.repository,
                    branch: result.branch,
                    status: result.status
                }
            });
        } catch (error) {
            return sendJSON(res, {
                ok: false,
                error: error.message
            }, 400);
        }
    }
}

if (req.url.startsWith('/api/deployments/') && req.method === 'POST') {
    const parts = req.url.split('/').filter(Boolean);
    const deploymentId = parts[2];
    const action = parts[3];

    const deployment = getDeployment(deploymentId);

    if (!deployment) {
        return sendJSON(res, {
            ok: false,
            error: 'Deployment not found'
        }, 404);
    }

    try {
        if (action === 'pair') {
            const runtime = await startWhatsAppRuntime(
                deployment.ownerNumber,
                deployment.deploymentId
            );

            updateDeployment(deploymentId, {
                status: 'pairing'
            });

            return sendJSON(res, {
                ok: true,
                runtime
            });
        }

        if (action === 'stop') {
            const status = await stopWhatsAppRuntime(
                deployment.deploymentId
            );

            updateDeployment(deploymentId, {
                status: 'stopped',
                pid: null
            });

            return sendJSON(res, {
                ok: true,
                status
            });
        }

        return sendJSON(res, {
            ok: false,
            error: 'Unknown deployment action'
        }, 400);

    } catch (error) {
        return sendJSON(res, {
            ok: false,
            error: error.message
        }, 500);
    }
}

if (req.url.startsWith('/api/deployments/') &&
    req.method === 'GET') {

    const parts = req.url.split('/').filter(Boolean);
    const deploymentId = parts[2];

    const deployment = getDeployment(deploymentId);

    if (!deployment) {
        return sendJSON(res, {
            ok: false,
            error: 'Deployment not found'
        }, 404);
    }

    const status = getRuntimeStatus(deploymentId);

    return sendJSON(res, {
        ok: true,
        deployment: {
            deploymentId: deployment.deploymentId,
            ownerNumber: deployment.ownerNumber,
            repository: deployment.repository,
            branch: deployment.branch,
            status: deployment.status,
            createdAt: deployment.createdAt
        },
        runtime: status
    });
}


if (req.url === '/api/whatsapp/sessions') {
        const sessions = listWhatsAppSessions();

        const safeSessions = sessions.map(session => ({
            sessionId: session.sessionId,
            ownerNumber: session.ownerNumber,
            metadata: session.metadata
        }));

        return sendJSON(res, {
            ok: true,
            sessions: safeSessions
        });
    }

    return sendJSON(res, {
        ok: false,
        error: 'API route not found'
    }, 404);
}

const server = http.createServer(async (req, res) => {
    try {
        if (req.url.startsWith('/api/')) {
            return await api(req, res);
        }

        if (req.url.startsWith('/assets/')) {
            return await serveAsset(req, res);
        }

        let requestPath = req.url.split('?')[0];

        if (requestPath === '/') {
            requestPath = '/index.html';
        }

        if (requestPath.includes('..')) {
            return sendJSON(res, {
                ok: false,
                error: 'Invalid path'
            }, 400);
        }

        const filePath = path.join(PUBLIC_DIR, requestPath);

        if (!fs.existsSync(filePath)) {
            return sendJSON(res, {
                ok: false,
                error: 'Not found'
            }, 404);
        }

        const ext = path.extname(filePath);

        const contentTypes = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml'
        };

        res.writeHead(200, {
            'Content-Type':
                contentTypes[ext] ||
                'application/octet-stream'
        });

        fs.createReadStream(filePath).pipe(res);

    } catch (error) {
        sendError(res, error);
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║       ALSON-XMD CONTROL CENTER      ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║ Port: ${PORT}                         ║`);
    console.log('║ GitHub integration: enabled         ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');
});

