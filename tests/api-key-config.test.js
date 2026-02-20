import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const SERVER_PATH = 'server.js';

function startServer({ port, nodeEnv, apiKey }) {
  const env = { ...process.env, PORT: String(port), NODE_ENV: nodeEnv };

  if (apiKey === undefined) {
    delete env.API_KEY;
  } else {
    env.API_KEY = apiKey;
  }

  const child = spawn('node', [SERVER_PATH], {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  return { child, getOutput: () => output };
}

async function waitForExit(child, timeoutMs = 5000) {
  if (child.exitCode !== null) {
    return child.exitCode;
  }

  return Promise.race([
    new Promise((resolve) => child.once('exit', (code) => resolve(code))),
    (async () => {
      await delay(timeoutMs);
      throw new Error(`Process did not exit within ${timeoutMs}ms`);
    })()
  ]);
}

test('server fails fast when API_KEY is missing outside test env', async () => {
  const { child, getOutput } = startServer({
    port: 31901,
    nodeEnv: 'development',
    apiKey: undefined
  });

  const code = await waitForExit(child);
  assert.notEqual(code, 0);
  assert.match(getOutput(), /missing required environment variable: api_key/i);
});

test('middleware rejects requests when API_KEY is not configured', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiKey = process.env.API_KEY;

  process.env.NODE_ENV = 'test';
  delete process.env.API_KEY;

  try {
    const { requireApiKey } = await import(`../server.js?test=${Date.now()}`);
    let calledNext = false;
    let statusCode = null;
    let responseBody = null;

    const req = { headers: { 'x-api-key': 'any-value' } };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      }
    };
    const next = () => {
      calledNext = true;
    };

    requireApiKey(req, res, next);

    assert.equal(calledNext, false);
    assert.equal(statusCode, 500);
    assert.deepEqual(responseBody, { error: 'Server API key is not configured' });
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalApiKey === undefined) {
      delete process.env.API_KEY;
    } else {
      process.env.API_KEY = originalApiKey;
    }
  }
});
