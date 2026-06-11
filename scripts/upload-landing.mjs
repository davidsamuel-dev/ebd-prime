#!/usr/bin/env node
/** Envia só a landing (index.html, index.php, .htaccess, site-assets/) para a Hostinger. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'basic-ftp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deployDir = path.join(root, 'deploy', 'hostinger-ebd.adparaiso.com.br');
const envPath = path.join(root, 'backend', '.env.deploy');

function parseEnvFile(filePath) {
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = val;
  }
  return out;
}

const cfg = parseEnvFile(envPath);
const client = new Client(120_000);
const accessOpts = {
  host: cfg.HOSTINGER_FTP_HOST,
  user: cfg.HOSTINGER_FTP_USER,
  password: cfg.HOSTINGER_FTP_PASS,
  port: parseInt(cfg.HOSTINGER_FTP_PORT || '21', 10),
  secure: String(cfg.HOSTINGER_FTP_SECURE ?? 'true').toLowerCase() !== 'false',
};
if (accessOpts.secure) {
  accessOpts.secureOptions = { rejectUnauthorized: false };
}

try {
  await client.access(accessOpts);
  let remoteDir = (cfg.HOSTINGER_FTP_REMOTE_DIR || '.').replace(/\\/g, '/').trim();
  if (remoteDir === '/' || remoteDir === '') remoteDir = '.';
  await client.ensureDir(remoteDir);
  await client.cd(remoteDir);

  for (const name of ['index.html', 'ajuda.html', 'index.php', '.htaccess']) {
    const local = path.join(deployDir, name);
    if (!fs.existsSync(local)) {
      console.error('Falta no pacote:', local);
      process.exit(1);
    }
    console.log('→', name);
    await client.uploadFrom(local, name);
  }

  const assetsLocal = path.join(deployDir, 'site-assets');
  console.log('→ site-assets/');
  await client.cd('/');
  await client.ensureDir('site-assets');
  await client.cd('site-assets');
  for (const name of fs.readdirSync(assetsLocal)) {
    const local = path.join(assetsLocal, name);
    if (!fs.statSync(local).isFile()) continue;
    await client.uploadFrom(local, name);
    console.log('   ', name);
  }

  await client.cd('/');
  const items = await client.list();
  const names = items.map((x) => x.name);
  console.log('\n✓ Raiz FTP:', names.filter((n) => ['index.html', 'index.php', 'landing-asset.php', '.htaccess', 'site-assets', 'api'].includes(n)).join(', '));

  await client.cd('site-assets');
  const assets = await client.list();
  console.log('✓ site-assets/:', assets.map((x) => x.name).join(', '));
  await client.cd('/');

  console.log('  Testar: https://ebd.adparaiso.com.br/');
} finally {
  client.close();
}
