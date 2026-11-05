#!/usr/bin/env node
// Check what is actually in Hominem, using an MCP personal access token. This is
// the authoritative answer to "did my change reach Hominem?" — the app can only
// show the local cache plus its sync status.
//
//   node scripts/check-hominem.mjs AirPods           # possessions whose name matches
//   node scripts/check-hominem.mjs --recent          # the 20 most recently created
//   node scripts/check-hominem.mjs --id <uuid>       # one item, with its history
//   node scripts/check-hominem.mjs --url http://localhost:4040 AirPods
//
// The token is read from HOMINEM_MCP_TOKEN, or from ~/.localrc (where local
// Hominem onboarding puts it). The endpoint is HOMINEM_MCP_URL or --url, and
// defaults to the production API.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const PROTOCOL_VERSION = '2026-07-28';
const CLIENT_INFO = { name: 'still-check-hominem', version: '1.0.0' };
const PRODUCTION = 'https://api.ponti.io';

function fromLocalrc(key) {
  try {
    const text = readFileSync(`${homedir()}/.localrc`, 'utf8');
    const match = text.match(new RegExp(`^\\s*export\\s+${key}=(.*)$`, 'm'));
    return match?.[1]?.trim().replace(/^["']|["']$/g, '') || undefined;
  } catch {
    return undefined;
  }
}

const token = process.env.HOMINEM_MCP_TOKEN ?? fromLocalrc('HOMINEM_MCP_TOKEN');
if (!token) {
  console.error('No token. Set HOMINEM_MCP_TOKEN, or add it to ~/.localrc.');
  process.exit(2);
}

function parseArgs(argv) {
  const args = { recent: false, id: undefined, query: undefined, url: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--recent') args.recent = true;
    else if (a === '--url') args.url = argv[++i];
    else if (a === '--id') args.id = argv[++i];
    else if (!a.startsWith('--')) args.query = args.query ? `${args.query} ${a}` : a;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const base = args.url ?? process.env.HOMINEM_MCP_URL ?? PRODUCTION;
const url = base.endsWith('/api/mcp') ? base : `${base.replace(/\/$/, '')}/api/mcp`;

async function readBody(response) {
  const text = await response.text();
  if (!text) return {};
  if (response.headers.get('content-type')?.includes('text/event-stream') || text.startsWith('event:')) {
    const data = text.split('\n').filter((l) => l.startsWith('data:')).at(-1)?.slice(5).trim();
    return JSON.parse(data ?? '{}');
  }
  return JSON.parse(text);
}

async function rpc(sessionId, body, includeProtocol) {
  const headers = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (includeProtocol) {
    headers['mcp-protocol-version'] = PROTOCOL_VERSION;
    if (body.method) headers['mcp-method'] = body.method;
    if (body.method === 'tools/call' && body.params?.name) headers['mcp-name'] = body.params.name;
  }
  if (sessionId) headers['mcp-session-id'] = sessionId;
  return fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
}

async function main() {
  const init = await rpc(undefined, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: CLIENT_INFO },
  }, false);
  if (!init.ok) {
    console.error(
      `Could not reach ${url} (HTTP ${init.status}). ` +
        (init.status === 401 ? 'Is the token for this endpoint?' : 'Is the server running?'),
    );
    process.exit(1);
  }
  const sessionId = init.headers.get('mcp-session-id') ?? undefined;
  await rpc(sessionId, { jsonrpc: '2.0', method: 'notifications/initialized' }, true);

  let nextId = 2;
  async function call(name, callArgs) {
    const params = {
      name,
      arguments: callArgs,
      _meta: {
        'io.modelcontextprotocol/protocolVersion': PROTOCOL_VERSION,
        'io.modelcontextprotocol/clientInfo': CLIENT_INFO,
        'io.modelcontextprotocol/clientCapabilities': {},
      },
    };
    const response = await rpc(sessionId, { jsonrpc: '2.0', id: nextId++, method: 'tools/call', params }, true);
    if (!response.ok) {
      console.error(`${name} failed (HTTP ${response.status}): ${(await response.text()).slice(0, 300)}`);
      process.exit(1);
    }
    const body = await readBody(response);
    if (body.error) {
      console.error(`${name} error: ${JSON.stringify(body.error).slice(0, 300)}`);
      process.exit(1);
    }
    return body.result?.structuredContent ?? body.result ?? {};
  }

  const stamp = (p) => `${(p.updatedAt ?? p.createdAt ?? '').slice(0, 19).replace('T', ' ')}`;
  const line = (p) =>
    `${stamp(p)}  ${p.name}\n` +
    `    id=${p.id} status=${p.status} archived=${p.isArchived} category=${p.category ?? '—'} externalId=${p.externalId ?? '—'}`;

  if (args.id) {
    const item = await call('possession_get', { id: args.id });
    console.log(JSON.stringify(item, null, 2));
    const history = await call('possession_history', { id: args.id, limit: 20 });
    console.log('\nHistory:');
    console.log(JSON.stringify(history, null, 2));
    return;
  }

  const params = args.query ? { query: args.query, limit: 50 } : { limit: 20 };
  const result = await call('possession_list', params);
  const rows = result.possessions ?? [];

  if (!rows.length) {
    console.log(`No possessions matched${args.query ? ` "${args.query}"` : ''} at ${url}.`);
    return;
  }
  const label = args.query ? ` matching "${args.query}"` : ' (newest 20)';
  console.log(`${rows.length} possession(s) at ${url}${label}:\n`);
  for (const p of rows) console.log(line(p));
}

await main();
