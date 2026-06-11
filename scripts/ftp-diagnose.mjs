#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'basic-ftp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, 'backend', '.env.deploy');

function parseEnvFile(filePath) {
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = val;
  }
  return out;
}

const cfg = parseEnvFile(envPath);
const client = new Client(30_000);

async function listHere(label) {
  console.log(`\n--- ${label} ---`);
  console.log('PWD:', await client.pwd());
  const items = await client.list();
  for (const it of items.slice(0, 30)) {
    console.log(`${it.isDirectory ? 'd' : 'f'} ${it.name}`);
  }
  if (items.length > 30) console.log(`... +${items.length - 30} more`);
}

async function tryPath(remotePath) {
  try {
    await client.cd(remotePath);
    await listHere(remotePath);
    const hasApi = (await client.list()).some((x) => x.name === 'api');
    const hasInativar = hasApi
      ? fs.existsSync(path.join(root, 'deploy', 'hostinger-ebd.adparaiso.com.br', 'api', 'usuarios', 'inativar.php'))
      : false;
    if (hasApi) {
      try {
        await client.cd('api/usuarios');
        const apiFiles = await client.list();
        const names = apiFiles.map((x) => x.name);
        console.log('api/usuarios has inativar.php:', names.includes('inativar.php'));
        console.log('api/usuarios files:', names.join(', '));
      } catch (e) {
        console.log('api/usuarios list failed:', e.message);
      }
    }
    return hasApi;
  } catch (e) {
    console.log(`Cannot cd ${remotePath}:`, e.message);
    return false;
  }
}

try {
  const accessOpts = {
    host: cfg.HOSTINGER_FTP_HOST,
    user: cfg.HOSTINGER_FTP_USER,
    password: cfg.HOSTINGER_FTP_PASS,
    port: parseInt(cfg.HOSTINGER_FTP_PORT || '21', 10),
    secure: String(cfg.HOSTINGER_FTP_SECURE ?? 'true').toLowerCase() !== 'false',
  };
  if (accessOpts.secure) accessOpts.secureOptions = { rejectUnauthorized: false };
  await client.access(accessOpts);
  await listHere('login root');

  const candidates = [
    '.',
    '/',
    '/public_html',
    '/domains/ebd.adparaiso.com.br/public_html',
    '/home/u370088447/domains/ebd.adparaiso.com.br/public_html',
  ];
  for (const p of candidates) {
    await client.cd('/');
    await tryPath(p);
  }
} finally {
  client.close();
}
