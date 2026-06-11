#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'basic-ftp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, 'backend', '.env.deploy');
const deployDir = path.join(root, 'deploy', 'hostinger-ebd.adparaiso.com.br');

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

const files = [
  'api/usuarios/inativar.php',
  'api/usuarios/ativar.php',
  'api/usuarios/store.php',
  'api/usuarios/_helpers.php',
  'api/usuarios/ausentes-list.php',
  'api/frequencia/get.php',
  'api/frequencia/store.php',
  'api/frequencia/professores-chamada.php',
  'api/turmas/alunos-chamada.php',
  'api/turmas/list.php',
  'api/turmas/resumo-intervalo.php',
  'api/usuarios/list.php',
  'api/usuarios/inativos-list.php',
  'api/escala/update.php',
  'api/escala/delete.php',
  'api/escala/list.php',
  'api/turmas/store.php',
  'api/turmas/delete.php',
  'api/relatorios/geral-resumo.php',
  'api/relatorios/aula-resumo.php',
  'api/relatorios/get.php',
  'api/conta/get.php',
  'api/congregacao/update.php',
  'api/congregacao/smtp-get.php',
  'api/congregacao/smtp-update.php',
  'api/auth/forgot-lookup.php',
  'api/auth/forgot-send.php',
  'api/auth/reset-form.php',
  'api/bootstrap.php',
  'api/lib/ebd_mailer.php',
  'api/lib/ebd_smtp_config.php',
  'api/lib/ebd_password_recovery.php',
];

const cfg = parseEnvFile(envPath);
const client = new Client(60_000);

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

  for (const rel of files) {
    const local = path.join(deployDir, rel.replace(/\//g, path.sep));
    if (!fs.existsSync(local)) {
      console.warn('SKIP (missing local):', rel);
      continue;
    }
    const remoteSubdir = path.posix.dirname(rel);
    const remoteName = path.posix.basename(rel);
    await client.ensureDir('/' + remoteSubdir);
    await client.uploadFrom(local, '/' + rel.replace(/\\/g, '/'));
    console.log('OK', rel, fs.statSync(local).size, 'bytes');
  }
} finally {
  client.close();
}

console.log('\nVerifique: curl https://ebd.adparaiso.com.br/api/usuarios/inativar.php');
