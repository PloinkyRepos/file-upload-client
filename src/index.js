const DEFAULT_UPLOAD_BASE = '/blobs';

const globalObject = typeof globalThis !== 'undefined' ? globalThis : {};

function coerceString(value) {
    return typeof value === 'string' ? value : '';
}

export function normalizeAbsoluteUrl(localPath, downloadUrl, locationOverride) {
    const download = coerceString(downloadUrl).trim();
    if (download) {
        return download;
    }
    const rawPath = coerceString(localPath).trim();
    if (!rawPath) {
        return '';
    }
    const normalized = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const locationRef = locationOverride
        || globalObject?.window?.location
        || globalObject?.location
        || null;
    if (!locationRef) {
        return normalized;
    }
    try {
        return new URL(normalized, locationRef.origin || String(locationRef)).href;
    } catch (_) {
        return normalized;
    }
}

export function createBrowserAgentResolver({ fallbackAgent = '' } = {}) {
    return () => {
        const win = globalObject.window;
        if (!win) return coerceString(fallbackAgent).trim();
        const candidates = [
            coerceString(win.ASSISTOS_AGENT_ID),
            coerceString(win.__ASSISTOS_AGENT_ID),
            coerceString(win.document?.body?.dataset?.agent)
        ];
        const match = candidates.find((value) => value && value.trim());
        return match ? match.trim() : coerceString(fallbackAgent).trim();
    };
}

function buildUploadUrl(baseUrl = DEFAULT_UPLOAD_BASE, agentName = '') {
    const trimmedBase = coerceString(baseUrl).trim() || DEFAULT_UPLOAD_BASE;
    const base = trimmedBase.endsWith('/') ? trimmedBase.slice(0, -1) : trimmedBase;
    const agent = coerceString(agentName).trim();
    if (!agent) {
        return base;
    }
    return `${base}/${encodeURIComponent(agent)}`;
}

function assertFetchAvailable(fetchImpl) {
    if (typeof fetchImpl !== 'function') {
        throw new Error('No fetch implementation available for blob uploader.');
    }
}

export function createBlobUploader({
    uploadBaseUrl = DEFAULT_UPLOAD_BASE,
    defaultAgent = '',
    agentResolver = null,
    fetchImpl = globalObject.fetch,
    filenameHeader = 'X-File-Name',
    locationRef = globalObject?.window?.location || globalObject?.location || null
} = {}) {
    assertFetchAvailable(fetchImpl);
    const resolveAgent = typeof agentResolver === 'function'
        ? agentResolver
        : () => coerceString(defaultAgent).trim();

    return async function uploadBlob(file, { signal } = {}) {
        if (!file || typeof file.name !== 'string' || typeof file.size === 'undefined') {
            throw new Error('Invalid file payload.');
        }

        const agent = resolveAgent() || defaultAgent || '';
        const uploadUrl = buildUploadUrl(uploadBaseUrl, agent);
        const mime = coerceString(file.type) || 'application/octet-stream';
        const headers = {
            'Content-Type': mime,
            'X-Mime-Type': mime,
            [filenameHeader]: encodeURIComponent(file.name || 'file')
        };

        const response = await fetchImpl(uploadUrl, {
            method: 'POST',
            headers,
            body: file,
            signal
        });
        if (!response.ok) {
            const reason = await response.text().catch(() => '');
            throw new Error(reason || `Upload failed (${response.status})`);
        }
        const data = await response.json().catch(() => ({}));
        const localPath = typeof data.localPath === 'string' ? data.localPath : null;
        const absoluteUrl = normalizeAbsoluteUrl(localPath, data.downloadUrl, locationRef);
        return {
            id: data.id ?? null,
            filename: data.filename || file.name,
            localPath,
            downloadUrl: absoluteUrl,
            mime: data.mime ?? file.type ?? null,
            size: data.size ?? (Number.isFinite(file.size) ? file.size : null),
            agent: data.agent ?? (agent || null)
        };
    };
}

export default {
    createBlobUploader,
    createBrowserAgentResolver,
    normalizeAbsoluteUrl
};
