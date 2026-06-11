#!/usr/bin/env node
/**
 * Deploy EBD Prime → Hostinger por FTP/FTPS (um comando).
 *
 * Uso:
 *   npm run deploy:hostinger
 *   npm run deploy:hostinger -- --dry-run
 *   npm run deploy:hostinger -- --pack-only
 *
 * Configuração: backend/.env.deploy (modelo: backend/.env.deploy.example)
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'basic-ftp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const deployDir = path.join(root, 'deploy', 'hostinger-ebd.adparaiso.com.br');
const envDeployPath = path.join(root, 'backend', '.env.deploy');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const packOnly = args.includes('--pack-only');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const out = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function walkFiles(dir, base = dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(base, full).replace(/\\/g, '/');
    if (fs.statSync(full).isDirectory()) {
      walkFiles(full, base, out);
    } else {
      out.push({ local: full, remote: rel });
    }
  }
  return out;
}

function runPack() {
  const phpScript = path.join(root, 'backend', 'scripts', 'prepare-hostinger-deploy.php');
  console.log('→ A gerar pacote (prepare-hostinger-deploy.php)...');
  const r = spawnSync('php', [phpScript], { cwd: root, stdio: 'inherit', shell: false });
  if (r.status !== 0) {
    console.error('\nFalha ao gerar pacote. Verifique PHP e backend/.env.production');
    process.exit(1);
  }
  if (!fs.existsSync(deployDir)) {
    console.error('Pasta de deploy não encontrada:', deployDir);
    process.exit(1);
  }
}

async function uploadFtp(cfg) {
  const host = cfg.HOSTINGER_FTP_HOST;
  const user = cfg.HOSTINGER_FTP_USER;
  const password = cfg.HOSTINGER_FTP_PASS;
  const port = parseInt(cfg.HOSTINGER_FTP_PORT || '21', 10);
  const secure = String(cfg.HOSTINGER_FTP_SECURE ?? 'true').toLowerCase() !== 'false';
  let remoteDir = (cfg.HOSTINGER_FTP_REMOTE_DIR || '.').replace(/\\/g, '/').trim();
  if (remoteDir === '/' || remoteDir === '') remoteDir = '.';

  if (!host || !user || !password) {
    console.error('Defina HOSTINGER_FTP_HOST, HOSTINGER_FTP_USER e HOSTINGER_FTP_PASS em backend/.env.deploy');
    process.exit(1);
  }

  const files = walkFiles(deployDir);
  console.log(`→ ${files.length} ficheiros → ${remoteDir}`);

  if (dryRun) {
    console.log('  Pasta local:', deployDir);
    console.log('\n(dry-run — nada foi enviado)');
    return;
  }

  const client = new Client(300_000);
  client.ftp.verbose = false;

  try {
    console.log(`→ A ligar a ${host}:${port} (secure=${secure})...`);
    const accessOpts = { host, user, password, port, secure };
    if (secure) {
      // Hostinger usa certificado *.hstgr.io no FTP — evita erro de hostname
      accessOpts.secureOptions = { rejectUnauthorized: false };
    }
    await client.access(accessOpts);

    await client.ensureDir(remoteDir);
    await client.cd(remoteDir);

    let ok = 0;
    const failed = [];
    const skipFiles = new Set(['lib/ebd_mailer.php']);

    console.log('→ Envio por pastas (api → lib → vendor → raiz)...');

    for (const name of fs.readdirSync(deployDir)) {
      const localPath = path.join(deployDir, name);
      if (!fs.statSync(localPath).isDirectory()) {
        try {
          await client.cd(remoteDir);
          await client.uploadFrom(localPath, name);
          ok += 1;
        } catch (err) {
          failed.push({ remote: name, msg: err.message || String(err) });
        }
        continue;
      }
      try {
        await client.cd(remoteDir);
        await client.ensureDir(name);
        await client.uploadFromDir(localPath, name);
        const subCount = walkFiles(localPath).length;
        ok += subCount;
        process.stdout.write(`\r→ Pasta ${name}/ (${subCount} ficheiros)...`);
      } catch (err) {
        console.warn(`\n⚠ Pasta ${name}/: ${err.message || err}`);
        for (const { local, remote } of walkFiles(localPath, localPath)) {
          if (skipFiles.has(`${name}/${remote}`) || skipFiles.has(remote)) continue;
          const fullRemote = `${name}/${remote}`;
          try {
            await client.cd(remoteDir);
            await client.ensureDir(path.posix.dirname(fullRemote));
            await client.uploadFrom(local, fullRemote);
            ok += 1;
          } catch (e2) {
            failed.push({ remote: fullRemote, msg: e2.message || String(e2) });
          }
        }
      }
    }
    console.log('');

    console.log('');
    if (failed.length > 0) {
      console.warn(`⚠ ${failed.length} ficheiro(s) não enviados (permissão ou bloqueio):`);
      failed.slice(0, 8).forEach((f) => console.warn(`   - ${f.remote}: ${f.msg}`));
      if (failed.length > 8) console.warn(`   ... e mais ${failed.length - 8}`);
    }
    console.log(`✓ Upload: ${ok}/${files.length} ficheiros.`);
    console.log('  Testar: https://ebd.adparaiso.com.br/api/health.php');

    if (ok < files.length * 0.85) {
      console.warn(
        '\nAlguns ficheiros falharam. Execute `npm run deploy:hostinger` outra vez ou envie a pasta `api/` pelo Gestor de ficheiros do hPanel.',
      );
      process.exitCode = 1;
    }
  } finally {
    client.close();
  }
}

async function main() {
  console.log('EBD Prime — deploy Hostinger (FTP)\n');

  if (!fs.existsSync(envDeployPath)) {
    console.error('Crie backend/.env.deploy a partir de backend/.env.deploy.example');
    console.error('  copy backend\\.env.deploy.example backend\\.env.deploy');
    process.exit(1);
  }

  const cfg = parseEnvFile(envDeployPath);
  runPack();

  if (packOnly) {
    console.log('\n--pack-only: pacote pronto em', deployDir);
    return;
  }

  await uploadFtp(cfg);
}

main().catch((err) => {
  console.error('\nErro no deploy:', err.message || err);
  process.exit(1);
});
