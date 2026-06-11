#!/usr/bin/env node
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
  await client.cd('/');

  console.log('→ api/landing-asset.php');
  await client.uploadFrom(
    path.join(deployDir, 'api', 'landing-asset.php'),
    'api/landing-asset.php',
  );

  for (const img of ['logo1.png', 'logo_comprida.png', 'logo_fundo_azul.png']) {
    const local = path.join(deployDir, 'api', img);
    if (!fs.existsSync(local)) continue;
    console.log('→ api/' + img);
    await client.uploadFrom(local, `api/${img}`);
  }

  console.log('\n✓ Testar: https://ebd.adparaiso.com.br/api/landing-asset.php?f=logo_comprida.png');
} finally {
  client.close();
}
