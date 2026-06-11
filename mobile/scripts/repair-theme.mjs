/**
 * Repara migração de tema: nomes createStyles, chaves extra e fechos em falta.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory() && name.name !== 'node_modules') walk(p, acc);
    else if (name.name.endsWith('.tsx') || name.name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

function repair(content, rel) {
  let next = content;

  // createstyles -> createStyles, createillus -> createIllus
  next = next.replace(/function create([a-z]\w*)\(/g, (_, name) => {
    const fixed = name.charAt(0).toUpperCase() + name.slice(1);
    return `function create${fixed}(`;
  });

  // Remove chaves soltas inseridas a meio de callbacks
  next = next.replace(/(\}\);)\n\}\n(\s+(?:return|const|let|void|api|set[A-Z]|Animated|await|if \())/g, '$1\n$2');
  next = next.replace(/(\);)\n\}\n(\s+(?:return|const|let|void|api|set[A-Z]|Animated|await|if \())/g, '$1\n$2');

  // Fechar createStyles no fim do ficheiro
  if (next.includes('function createStyles(') && !next.match(/function createStyles[\s\S]*?\n\}\n\s*$/)) {
    if (next.trimEnd().endsWith('});')) {
      next = `${next.trimEnd()}\n}\n`;
    }
  }

  // GreetingBar e similares: injetar hook se falta
  if (next.includes('function createStyles(') && next.includes('styles.') && !next.includes('useThemedStyles(createStyles)')) {
    next = next.replace(
      /export function (\w+)\([^)]*\) \{\n(?!\s*const styles = useThemedStyles)/,
      'export function $1() {\n  const styles = useThemedStyles(createStyles);\n',
    );
    next = next.replace(
      /export default function (\w+)\([^)]*\) \{\n(?!\s*const styles = useThemedStyles)/,
      'export default function $1() {\n  const styles = useThemedStyles(createStyles);\n',
    );
  }

  // Segundo bloco de estilos (ex.: illus em geral.tsx)
  if (next.includes('function createIllus(') && next.includes('illus.') && !next.includes('useThemedStyles(createIllus)')) {
    next = next.replace(
      /export default function (\w+)\([^)]*\) \{\n(?!\s*const illus = useThemedStyles)/,
      (m) => `${m}  const illus = useThemedStyles(createIllus);\n`,
    );
  }

  if (next.includes('function createIllus(') && !next.match(/function createIllus[\s\S]*?\n\}\n\s*$/)) {
    // Fechar createIllus antes de createStyles ou no fim
    next = next.replace(/(function createIllus[\s\S]*?\}\);\n)(?=function createStyles)/, '$1}\n');
  }

  // Limpar import useMemo duplicado / mal formatado
  next = next.replace(/useState , useMemo/g, 'useState, useMemo');

  if (next !== content) {
    return next;
  }
  return null;
}

const files = walk(mobileRoot);
let fixed = 0;
for (const abs of files) {
  const rel = path.relative(mobileRoot, abs).replace(/\\/g, '/');
  if (rel.startsWith('scripts/')) continue;
  const content = fs.readFileSync(abs, 'utf8');
  if (!content.includes('useThemedStyles') && !content.includes('ThemeColors')) continue;
  const repaired = repair(content, rel);
  if (repaired) {
    fs.writeFileSync(abs, repaired, 'utf8');
    fixed++;
    console.log('fixed:', rel);
  }
}
console.log('total fixed:', fixed);
