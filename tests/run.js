import { suite } from 'uvu';
import * as assert from 'uvu/assert';
import { createBlobUploader, normalizeAbsoluteUrl, createBrowserAgentResolver } from '../src/index.js';

const uploaderSuite = suite('blob uploader');

uploaderSuite('builds absolute URL when download missing', async () => {
    const fetchCalls = [];
    const fetchImpl = async (...args) => {
        fetchCalls.push(args);
        return {
            ok: true,
            json: async () => ({
                id: 'abc',
                localPath: 'blobs/abc'
            })
        };
    };
    const uploader = createBlobUploader({
        fetchImpl,
        agentResolver: () => 'agent-one',
        uploadBaseUrl: '/blobs'
    });
    const fakeFile = { name: 'test.png', size: 10, type: 'image/png' };
    const result = await uploader(fakeFile);
    assert.is(fetchCalls.length, 1, 'fetch called once');
    assert.is(fetchCalls[0][0], '/blobs/agent-one');
    assert.is(result.id, 'abc');
    assert.is(result.filename, 'test.png');
    assert.is(result.downloadUrl, '/blobs/abc', 'falls back to local path origin-less');
});

uploaderSuite('normalizes download override', () => {
    const absolute = normalizeAbsoluteUrl('blobs/123', 'https://example.com/data');
    assert.is(absolute, 'https://example.com/data');
});

uploaderSuite('browser resolver falls back when window missing', () => {
    const resolver = createBrowserAgentResolver({ fallbackAgent: 'shared' });
    assert.is(resolver(), 'shared');
});

uploaderSuite.run();
