import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { deflateRawSync } from 'node:zlib';

// Resolve at the consumers, not this script: overrides can be nested or hoisted.
// These internal modules do not load hardhat.config or dotenv.
const require = createRequire(import.meta.url);
const hardhatRequire = createRequire(require.resolve('hardhat/internal/solidity/compiler/downloader'));
const verifyEntry = require.resolve('@nomicfoundation/hardhat-verify/internal/undici');
const verifyRequire = createRequire(verifyEntry);
const mochaRequire = createRequire(hardhatRequire.resolve('mocha/lib/nodejs/buffered-worker-pool'));
const solcRequire = createRequire(hardhatRequire.resolve('solc/smtsolver'));

function ownedDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'istory-tooling-compat-'));
  t.after(() => {
    // Only this mkdtemp result is recursively removed; never a caller-supplied path.
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('istory-tooling-compat-'));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

// A minimal DEFLATE ZIP built independently of adm-zip's writer, including CRC32.
function syntheticZip(name, content) {
  const filename = Buffer.from(name);
  const compressed = deflateRawSync(content);
  let crc = 0xffffffff;
  for (const byte of content) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(filename.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + filename.length, 12);
  end.writeUInt32LE(local.length + filename.length + compressed.length, 16);
  return Buffer.concat([local, filename, compressed, central, filename, end]);
}

test('Hardhat Windows compiler downloader extracts its synthetic ZIP with its adm-zip copy', async t => {
  const directory = ownedDirectory(t);
  const { CompilerDownloader, CompilerPlatform } = hardhatRequire('./downloader');
  const build = { version: '0.0.0-compat', path: 'synthetic-solc.zip' };
  const zipPath = path.join(directory, build.path);
  const binary = Buffer.from('MZ\0synthetic compiler bytes; never execute\xff', 'utf8');
  fs.writeFileSync(zipPath, syntheticZip('solc.exe', binary));
  const downloader = new CompilerDownloader(CompilerPlatform.WINDOWS, directory, 0, () => {
    throw new Error('A compatibility test must never download a compiler');
  });
  const extracted = path.join(directory, build.version, 'solc.exe');
  let checks = 0;
  // Keep the actual extraction path; substitute only execution of a fake binary.
  downloader._checkNativeSolc = async candidate => {
    checks++;
    assert.equal(candidate, build);
    assert.deepEqual(fs.readFileSync(extracted), binary);
    return checks === 1;
  };
  await downloader._postProcessCompilerDownload(build, zipPath);
  assert.deepEqual(fs.readFileSync(extracted), binary);
  assert.equal(fs.existsSync(`${extracted}.does.not.work`), false);
  fs.unlinkSync(extracted);
  await downloader._postProcessCompilerDownload(build, zipPath);
  assert.equal(checks, 2);
  assert.equal(fs.existsSync(`${extracted}.does.not.work`), true);
});

async function loopbackServer(t, listener) {
  const sockets = new Set();
  const server = http.createServer(listener);
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

for (const [consumer, consumerRequire] of [['hardhat', hardhatRequire], ['hardhat-verify', verifyRequire]]) {
  test(`${consumer}'s Undici request, redirect, Pool, Client and CONNECT proxy APIs work on loopback`, { timeout: 15000 }, async t => {
    const { Agent, ProxyAgent, Pool, Client, request } = consumerRequire('undici');
    const seen = [];
    const { origin } = await loopbackServer(t, async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      seen.push({ method: req.method, url: req.url, header: req.headers['x-compat'], body: Buffer.concat(chunks).toString() });
      if (req.url === '/redirect') {
        res.writeHead(302, { location: '/binary' });
        res.end();
      } else if (req.url === '/binary') {
        res.end(Buffer.from([0, 1, 127, 255]));
      } else {
        res.writeHead(req.url === '/failure' ? 503 : 200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ method: req.method, body: Buffer.concat(chunks).toString() }));
      }
    });
    const { server: proxy, origin: proxyOrigin } = await loopbackServer(t, (_req, res) => {
      res.writeHead(405).end();
    });
    let tunnels = 0;
    proxy.on('connect', (req, client, head) => {
      // Even a regression cannot make this proxy connect outside our own server.
      const expected = new URL(origin);
      if (req.url !== expected.host) {
        client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
        return;
      }
      tunnels++;
      const upstream = net.connect({ host: '127.0.0.1', port: Number(expected.port) }, () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) upstream.write(head);
        upstream.pipe(client);
        client.pipe(upstream);
      });
      client.on('error', () => upstream.destroy());
      upstream.on('error', () => client.destroy());
      client.on('close', () => upstream.destroy());
    });
    const agent = new Agent();
    const proxyAgent = new ProxyAgent(proxyOrigin);
    const pool = new Pool(origin);
    const client = new Client(origin);
    t.after(async () => {
      await Promise.all([agent, proxyAgent, pool, client].map(dispatcher => dispatcher.destroy()));
    });
    // Same request/body APIs and options used by Hardhat's compiler download.
    for (const dispatcher of [agent, proxyAgent]) {
      const response = await request(`${origin}/redirect`, {
        dispatcher, method: 'GET', headersTimeout: 2000, bodyTimeout: 2000,
        maxRedirections: 10, headers: { 'x-compat': consumer },
      });
      assert.equal(response.statusCode, 200);
      assert.deepEqual(Buffer.from(await response.body.arrayBuffer()), Buffer.from([0, 1, 127, 255]));
    }
    const failure = await request(`${origin}/failure`, { dispatcher: agent });
    assert.equal(failure.statusCode, 503);
    assert.match(await failure.body.text(), /GET/);
    for (const dispatcher of [pool, client]) {
      const response = await dispatcher.request({ path: '/rpc', method: 'POST', body: '{"jsonrpc":"2.0"}' });
      assert.deepEqual(await response.body.json(), { method: 'POST', body: '{"jsonrpc":"2.0"}' });
    }
    assert.ok(tunnels > 0, 'ProxyAgent must actually open a local CONNECT tunnel');
    assert.ok(seen.some(entry => entry.url === '/binary' && entry.header === consumer));
    if (consumer === 'hardhat-verify') {
      const verify = require(verifyEntry);
      t.after(() => verify.setMockDispatcher(undefined));
      for (const dispatcher of [agent, proxyAgent]) {
        // The real helper's seam avoids environment-derived proxy selection.
        verify.setMockDispatcher(dispatcher);
        const get = await verify.sendGetRequest(`${origin}/verify`);
        assert.deepEqual(await get.body.json(), { method: 'GET', body: '' });
        const post = await verify.sendPostRequest(`${origin}/verify`, 'address=synthetic', { 'x-compat': 'verify-wrapper' });
        assert.deepEqual(await post.body.json(), { method: 'POST', body: 'address=synthetic' });
      }
      assert.ok(seen.some(entry => entry.header === 'verify-wrapper'));
    }
  });
}

test('Mocha parallel options serialize and revive through its actual worker', { timeout: 15000 }, async t => {
  const directory = ownedDirectory(t);
  const { BufferedWorkerPool } = mochaRequire('./buffered-worker-pool');
  const serialize = mochaRequire('serialize-javascript');
  const options = {
    grep: /compat selected/i, timeout: 2000, require: [],
    reporter: mochaRequire.resolve('./reporters/parallel-buffered'),
    synthetic: { date: new Date('2026-01-01T00:00:00Z'), text: '</script>+synthetic', omitted() {} },
  };
  const serialized = BufferedWorkerPool.serializeOptions(options);
  assert.equal(serialized, serialize(options, { unsafe: true, ignoreFunction: true }));
  // The worker evaluates this expression. Only our synthetic values enter the VM.
  const revived = vm.runInNewContext(`(${serialized})`, {}, { timeout: 1000 });
  assert.equal(revived.grep.test('COMPAT SELECTED'), true);
  assert.equal(revived.synthetic.date.toISOString(), options.synthetic.date.toISOString());
  assert.equal(revived.synthetic.text, options.synthetic.text);
  assert.equal('omitted' in revived.synthetic, false);
  const fixture = path.join(directory, 'parallel-fixture.cjs');
  fs.writeFileSync(fixture, "describe('compat', function () { it('selected', function () {}); it('excluded', function () { throw new Error('grep was not revived'); }); });\n");
  const pool = BufferedWorkerPool.create({ maxWorkers: 1, forkOpts: { execArgv: [] } });
  t.after(() => pool.terminate(true));
  const result = await pool.run(fixture, options);
  assert.equal(result.failureCount, 0);
  assert.equal(result.events.filter(event => event.eventName === 'pass').length, 1);
  assert.equal(result.events.filter(event => event.eventName === 'fail').length, 0);
});

test('Solc tmp.fileSync postfix, filename IO and removeCallback remain compatible', t => {
  const directory = ownedDirectory(t);
  const tmp = solcRequire('tmp');
  // The extra dir confines the same Solc postfix call surface to owned storage.
  const file = tmp.fileSync({ postfix: '.smt2', dir: directory });
  t.after(() => file.removeCallback());
  assert.equal(path.dirname(file.name), directory);
  assert.equal(path.extname(file.name), '.smt2');
  assert.equal(typeof file.fd, 'number');
  const query = '(set-logic QF_LIA)\n(assert (= 1 1))\n(check-sat)\n';
  fs.writeFileSync(file.name, query);
  assert.equal(fs.readFileSync(file.name, 'utf8'), query);
  assert.equal(fs.fstatSync(file.fd).size, Buffer.byteLength(query));
  file.removeCallback();
  assert.equal(fs.existsSync(file.name), false);
  assert.throws(() => fs.fstatSync(file.fd), { code: 'EBADF' });
});
