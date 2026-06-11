#!/usr/bin/env node
/**
 * Verifica se ficheiros sensíveis seriam commitados antes do push ao GitHub.
 * Uso: node scripts/verify-git-safe.mjs
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const FORBIDDEN_PATTERNS = [
  /^backend\/\.env$/,
  /^backend\/\.env\.production$/,
  /^backend\/\.env\.deploy$/,
  /^mobile\/\.env$/,
  /^mobile\/\.env\.local$/,
  /^deploy\//,
  /node_modules\//,
  /^backend\/vendor\//,
  /^u370088447_.*\.sql$/,
  /\.pem$/,
  /service-account.*\.json$/,
];

// Padrões de segredos reais — ignorar placeholders (sua_senha, senha_da_caixa, ebd_local, etc.)
const SECRET_SNIPPETS = [
  /HOSTINGER_FTP_PASS\s*=\s*"(?!sua_senha|sua_senha_ftp)[^"\s]{8,}"/i,
  /EBD_DB_PASS\s*=\s*"(?!ebd_local|senha_com)[^"]{12,}"/i,
  /EBD_SMTP_PASS\s*=\s*['"](?!senha)[^'"]{10,}['"]/i,
  /Adp@paiso/i,
  /Adp@raiso/i,
  /Da@0811/,
];

const SKIP_SECRET_SCAN = new Set([
  'scripts/verify-git-safe.mjs',
]);

function isGitRepo() {
  return fs.existsSync(path.join(root, '.git'));
}

function getStagedAndTracked() {
  if (!isGitRepo()) {
    return [];
  }
  try {
    const out = execSync('git ls-files -c --others --exclude-standard', {
      cwd: root,
      encoding: 'utf8',
    });
    return out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function rel(p) {
  return p.replace(/\\/g, '/');
}

const files = getStagedAndTracked();
const errors = [];

for (const file of files) {
  const norm = rel(file);
  if (FORBIDDEN_PATTERNS.some((re) => re.test(norm))) {
    errors.push(`BLOQUEADO: ${norm} (ficheiro sensível ou gerado)`);
    continue;
  }
  if (SKIP_SECRET_SCAN.has(norm)) continue;

  const full = path.join(root, file);
  if (!fs.existsSync(full) || fs.statSync(full).size > 512_000) continue;
  try {
    const text = fs.readFileSync(full, 'utf8');
    for (const re of SECRET_SNIPPETS) {
      if (re.test(text) && !norm.endsWith('.example')) {
        errors.push(`SEGREDO em ${norm} — padrão: ${re}`);
        break;
      }
    }
  } catch {
    // binário ou ilegível — ignorar
  }
}

const envOnDisk = [
  'backend/.env',
  'backend/.env.production',
  'backend/.env.deploy',
  'mobile/.env',
].filter((p) => fs.existsSync(path.join(root, p)));

console.log('--- Verificação de segurança Git ---\n');
console.log(`Repositório: ${isGitRepo() ? 'sim' : 'não (execute git init)'}`);
console.log(`Ficheiros a versionar: ${files.length}`);
if (envOnDisk.length) {
  console.log(`\n.env locais encontrados (devem estar no .gitignore):`);
  envOnDisk.forEach((p) => console.log(`  - ${p}`));
}

if (errors.length) {
  console.error('\n❌ Problemas encontrados:\n');
  errors.forEach((e) => console.error(`  • ${e}`));
  process.exit(1);
}

console.log('\n✅ Nenhum ficheiro sensível detectado na lista de versionamento.');
console.log('Pode prosseguir com git add, commit e push.\n');
