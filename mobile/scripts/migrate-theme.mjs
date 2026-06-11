/**
 * Migra ficheiros que usam Theme estático para createStyles(colors) + useThemedStyles.
 * Uso: node scripts/migrate-theme.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');

const SKIP = new Set([
  'constants/theme.ts',
  'context/AppThemeContext.tsx',
  'components/tab-pages/InicioPage.tsx',
  'components/InfoHintCard.tsx',
  'components/MainTabBar.tsx',
  'components/MainSwipeHub.tsx',
  'components/MainPortalHeader.tsx',
  'hooks/useThemedStyles.ts',
]);

const FILES = [
  'app/index.tsx',
  'app/+not-found.tsx',
  'app/login.tsx',
  'app/configuracoes.tsx',
  'app/(tabs)/_layout.tsx',
  'app/(tabs)/geral.tsx',
  'components/GreetingBar.tsx',
  'components/AulaFinalizadaConfetti.tsx',
  'components/TurmaCadastroSuccessToast.tsx',
  'components/GeralRelatorioDashboard.tsx',
  'components/PortalDrawerMenu.tsx',
  'components/tab-pages/TurmasPage.tsx',
  'components/tab-pages/CadastrosPage.tsx',
  'app/dados-escola.tsx',
  'app/selecionar-aula.tsx',
  'app/aula-resumo-geral.tsx',
  'app/aula-resumo.tsx',
  'app/ausentes.tsx',
  'app/esqueci-senha/index.tsx',
  'app/aniversariantes.tsx',
  'app/nova-aula.tsx',
  'app/cadastro.tsx',
  'app/conta-alterar.tsx',
  'app/resumo-turma.tsx',
  'app/acesso-administrativo/index.tsx',
  'app/acesso-administrativo/convidar.tsx',
  'app/aula-sessao.tsx',
  'app/cadastros-inativos.tsx',
  'app/cadastro-escola/index.tsx',
  'app/dados-conta.tsx',
  'app/nova-turma.tsx',
  'app/historico.tsx',
];

function ensureReactImport(content) {
  if (/import React[^;]*useMemo/.test(content) || /import \{[^}]*useMemo[^}]*\} from 'react'/.test(content)) {
    return content;
  }
  if (/import React, \{([^}]+)\} from 'react'/.test(content)) {
    return content.replace(/import React, \{([^}]+)\} from 'react'/, (m, inner) => {
      if (inner.includes('useMemo')) return m;
      return `import React, {${inner}, useMemo} from 'react'`;
    });
  }
  if (/import \{([^}]+)\} from 'react'/.test(content) && !content.includes("import React")) {
    return content.replace(/import \{([^}]+)\} from 'react'/, (m, inner) => {
      if (inner.includes('useMemo')) return m;
      return `import {${inner}, useMemo} from 'react'`;
    });
  }
  return content.replace(
    /^(import .+\n)/,
    "$1import { useMemo } from 'react';\n",
  );
}

function migrateFile(relPath) {
  if (SKIP.has(relPath.replace(/\\/g, '/'))) return 'skip';

  const abs = path.join(mobileRoot, relPath);
  if (!fs.existsSync(abs)) return 'missing';

  let content = fs.readFileSync(abs, 'utf8');
  if (!content.includes("import { Theme } from '@/constants/theme'")) {
    if (content.includes('useThemedStyles') || content.includes('useAppTheme')) return 'done';
    return 'no-theme-import';
  }

  content = content.replace(
    /import \{ Theme \} from '@\/constants\/theme';?\n?/,
    "import { type ThemeColors } from '@/constants/theme';\nimport { useThemedStyles } from '@/hooks/useThemedStyles';\n",
  );

  content = content.replace(/Theme\./g, 'colors.');

  // StyleSheet blocks at module level
  content = content.replace(
    /const (styles\w*) = StyleSheet\.create\(\{/g,
    'function create$1(colors: ThemeColors) {\n  return StyleSheet.create({',
  );

  // Named style objects like `illus` or `styles` - handle `const xxx = StyleSheet.create`
  // Close StyleSheet.create blocks: replace trailing `});` before next function/export
  // Only for blocks we opened - add closing brace before next top-level declaration
  content = content.replace(
    /^(\}\);)\n(?=(export |function |const [A-Z_]|\/\*\*))/gm,
    '$1\n}\n',
  );

  // Also handle StyleSheet at end of file
  content = content.replace(/\}\);\n\s*$/m, '});\n}\n');

  // Secondary style objects (e.g. illus, sheetStyles)
  content = content.replace(
    /const (illus\w*) = StyleSheet\.create\(\{/g,
    'function create$1(colors: ThemeColors) {\n  return StyleSheet.create({',
  );

  content = ensureReactImport(content);

  // Inject useThemedStyles in exported default function components
  content = content.replace(
    /export default function (\w+)\([^)]*\) \{\n(?!\s*const styles = useThemedStyles)/,
    (m, name) => `${m}  const styles = useThemedStyles(createStyles);\n`,
  );

  // Named export function components that use styles
  content = content.replace(
    /export function (\w+)\([^)]*\) \{\n(?!\s*const styles = useThemedStyles)(?=[\s\S]*?styles\.)/,
    (m) => `${m}  const styles = useThemedStyles(createStyles);\n`,
  );

  // GreetingBar pattern
  content = content.replace(
    /export function GreetingBar\(\) \{\n(?!\s*const styles)/,
    "export function GreetingBar() {\n  const styles = useThemedStyles(createStyles);\n",
  );

  // Handle secondary style vars like illus in geral.tsx
  if (content.includes('illus.') && content.includes('function createillus')) {
    content = content.replace(
      /export default function (\w+)\([^)]*\) \{\n(?!\s*const illus)/,
      (m) => `${m}  const illus = useThemedStyles(createillus);\n`,
    );
  }

  fs.writeFileSync(abs, content, 'utf8');
  return 'migrated';
}

const results = {};
for (const f of FILES) {
  results[f] = migrateFile(f);
}
console.log(JSON.stringify(results, null, 2));
