import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DEPLOYMENTS_DIR = path.join(PROJECT_ROOT, 'deployments');

fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });

const deployments = new Map();

function makeId() {
    return `deploy-${crypto.randomBytes(6).toString('hex')}`;
}

function cleanNumber(number) {
    return String(number || '').replace(/\D/g, '');
}

function createDeployment({
    ownerNumber,
    repository,
    branch = 'main'
}) {
    const number = cleanNumber(ownerNumber);

    if (!number) {
        throw new Error('A valid WhatsApp number is required');
    }

    if (!repository) {
        throw new Error('Repository is required');
    }

    const deploymentId = makeId();
    const directory = path.join(DEPLOYMENTS_DIR, deploymentId);

    fs.mkdirSync(directory, { recursive: true });

    const deployment = {
        deploymentId,
        ownerNumber: number,
        repository,
        branch,
        directory,
        status: 'created',
        pairingCode: null,
        pid: null,
        createdAt: new Date().toISOString(),
        logs: []
    };

    deployments.set(deploymentId, deployment);

    saveDeployment(deployment);

    return deployment;
}

function saveDeployment(deployment) {
    fs.writeFileSync(
        path.join(deployment.directory, 'deployment.json'),
        JSON.stringify({
            deploymentId: deployment.deploymentId,
            ownerNumber: deployment.ownerNumber,
            repository: deployment.repository,
            branch: deployment.branch,
            status: deployment.status,
            pairingCode: deployment.pairingCode,
            pid: deployment.pid,
            createdAt: deployment.createdAt
        }, null, 2)
    );
}

function getDeployment(deploymentId) {
    if (deployments.has(deploymentId)) {
        return deployments.get(deploymentId);
    }

    const directory = path.join(DEPLOYMENTS_DIR, deploymentId);

    if (!fs.existsSync(directory)) return null;

    const file = path.join(directory, 'deployment.json');

    if (!fs.existsSync(file)) return null;

    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));

        const deployment = {
            ...data,
            directory,
            logs: []
        };

        deployments.set(deploymentId, deployment);

        return deployment;
    } catch {
        return null;
    }
}

function listDeployments() {
    fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });

    return fs.readdirSync(DEPLOYMENTS_DIR, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => getDeployment(entry.name))
        .filter(Boolean);
}

function addLog(deploymentId, message) {
    const deployment = getDeployment(deploymentId);

    if (!deployment) return;

    deployment.logs.push({
        time: new Date().toISOString(),
        message: String(message)
    });

    if (deployment.logs.length > 500) {
        deployment.logs.splice(0, deployment.logs.length - 500);
    }
}

function updateDeployment(deploymentId, changes = {}) {
    const deployment = getDeployment(deploymentId);

    if (!deployment) {
        throw new Error(`Deployment not found: ${deploymentId}`);
    }

    Object.assign(deployment, changes);

    saveDeployment(deployment);

    return deployment;
}

async function cloneDeployment(deploymentId, repoUrl, branch = 'main') {
    const deployment = getDeployment(deploymentId);

    if (!deployment) {
        throw new Error(`Deployment not found: ${deploymentId}`);
    }

    if (!/^https:\/\/github\.com\/alsonmachingauta06-lab\/[A-Za-z0-9._-]+\.git$/.test(repoUrl)) {
        throw new Error('Repository is not an allowed ALSON GitHub repository');
    }

    if (!/^[A-Za-z0-9._-]+$/.test(branch)) {
        throw new Error('Invalid branch name');
    }

    const repoDirectory = path.join(deployment.directory, 'repo');

    if (fs.existsSync(repoDirectory)) {
        throw new Error('Repository directory already exists');
    }

    updateDeployment(deploymentId, {
        status: 'cloning'
    });

    addLog(deploymentId, `Cloning ${repoUrl} [${branch}]`);

    return await new Promise((resolve, reject) => {
        const child = spawn(
            'git',
            ['clone', '--branch', branch, '--single-branch', repoUrl, repoDirectory],
            {
                cwd: DEPLOYMENTS_DIR,
                env: {
                    ...process.env,
                    GIT_TERMINAL_PROMPT: '0'
                },
                stdio: ['ignore', 'pipe', 'pipe']
            }
        );

        child.stdout.on('data', data => {
            addLog(deploymentId, data.toString());
        });

        child.stderr.on('data', data => {
            addLog(deploymentId, data.toString());
        });

        child.on('error', error => {
            updateDeployment(deploymentId, {
                status: 'error'
            });
            reject(error);
        });

        child.on('close', code => {
            if (code !== 0) {
                updateDeployment(deploymentId, {
                    status: 'error'
                });

                reject(new Error(`git clone exited with code ${code}`));
                return;
            }

            updateDeployment(deploymentId, {
                status: 'cloned'
            });

            addLog(deploymentId, 'Repository cloned successfully');

            resolve(getDeployment(deploymentId));
        });
    });
}

function runCommand(deploymentId, command, args = []) {
    const deployment = getDeployment(deploymentId);

    if (!deployment) {
        throw new Error(`Deployment not found: ${deploymentId}`);
    }

    const child = spawn(command, args, {
        cwd: deployment.directory,
        env: {
            ...process.env,
            DEPLOYMENT_ID: deployment.deploymentId,
            PAIRING_NUMBER: deployment.ownerNumber
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    deployment.pid = child.pid;
    deployment.status = 'running';
    saveDeployment(deployment);

    child.stdout.on('data', data => {
        addLog(deploymentId, data.toString());
    });

    child.stderr.on('data', data => {
        addLog(deploymentId, data.toString());
    });

    child.on('close', code => {
        deployment.pid = null;
        deployment.status = code === 0 ? 'stopped' : 'error';
        saveDeployment(deployment);
        addLog(deploymentId, `Process exited with code ${code}`);
    });

    return child;
}

export {
    DEPLOYMENTS_DIR,
    createDeployment,
    getDeployment,
    listDeployments,
    updateDeployment,
    addLog,
    cloneDeployment,
    runCommand
};
