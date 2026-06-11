import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');

const SKIP = new Set([
  'context/AppThemeContext.tsx',
  'constants/theme.ts',
  'components/tab-pages/InicioPage.tsx',
  'components/InfoHintCard.tsx',
  'components/MainPortalHeader.tsx',
  'components/MainTabBar.tsx',
  'components/MainSwipeHub.tsx',
  'hooks/useThemedStyles.ts',
]);

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory() && name.name !== 'node_modules') walk(p, acc);
    else if (name.name.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

function ensureImports(content) {
  let next = content;
  if (next.includes('function createStyles(') && !next.includes("from '@/hooks/useThemedStyles'")) {
    next = next.replace(
      /import \{ type ThemeColors \} from '@\/constants\/theme';/,
      "import { type ThemeColors } from '@/constants/theme';\nimport { useThemedStyles } from '@/hooks/useThemedStyles';",
    );
  }
  if (/\bcolors\./.test(next) && !next.includes("from '@/context/AppThemeContext'")) {
    next = next.replace(
      /import \{ useThemedStyles \} from '@\/hooks\/useThemedStyles';/,
      "import { useAppTheme } from '@/context/AppThemeContext';\nimport { useThemedStyles } from '@/hooks/useThemedStyles';",
    );
  }
  return next;
}

function dedupeHooks(content) {
  return content
    .replace(/(const styles = useThemedStyles\(createStyles\);\r?\n)+/g, 'const styles = useThemedStyles(createStyles);\n')
    .replace(/(const \{ colors \} = useAppTheme\(\);\r?\n)+/g, 'const { colors } = useAppTheme();\n')
    .replace(/(const illus = useThemedStyles\(createIllus\);\r?\n)+/g, 'const illus = useThemedStyles(createIllus);\n');
}

function injectScreenHooks(content) {
  if (!content.includes('function createStyles(')) return content;
  if (!/export default function \w+\(/.test(content)) return content;
  if (/export default function \w+\([^)]*\) \{[\s\S]{0,800}?const styles = useThemedStyles\(createStyles\)/.test(content)) {
    return content;
  }
  return content.replace(
    /(export default function \w+\([^)]*\) \{\r?\n)/,
    '$1  const styles = useThemedStyles(createStyles);\n  const { colors } = useAppTheme();\n',
  );
}

function injectPortalDrawerHooks(content) {
  if (!content.includes('export function PortalDrawerMenu')) return content;
  if (/export function PortalDrawerMenu[\s\S]{0,400}?const styles = useThemedStyles/.test(content)) return content;
  return content.replace(
    /(export function PortalDrawerMenu\([^)]*\) \{\r?\n)/,
    '$1  const styles = useThemedStyles(createStyles);\n  const { colors } = useAppTheme();\n',
  );
}

function injectSubcomponentStyles(content) {
  const names = [
    'StatBox',
    'TurmaResumoCard',
    'BarraPct',
    'BarraOferta',
    'TurmaFinanceiroCard',
    'MenuRow',
    'Divider',
    'ConfigRow',
    'ConfigSection',
  ];
  let next = content;
  for (const name of names) {
    const re = new RegExp(
      `function ${name}\\([^)]*\\) \\{\\r?\\n(?!\\s*const styles = useThemedStyles)`,
      'g',
    );
    next = next.replace(re, (match) => match.replace(/\{\r?\n$/, ' {\n  const styles = useThemedStyles(createStyles);\n'));
  }
  return next;
}

function injectStepper(content) {
  if (!content.includes('stepper.track')) return content;
  let next = content;
  if (!next.includes('function createStepper(')) {
    const widthExpr = next.includes('screenW - 48') ? 'screenW - 48' : 'screenW - 56';
    next = next.replace(
      /function createStyles\(colors: ThemeColors\) \{/,
      `function createStepper(colors: ThemeColors) {
  return StyleSheet.create({
  track: {
    alignSelf: 'center',
    width: ${widthExpr},
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginBottom: 20,
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  });
}

function createStyles(colors: ThemeColors) {`,
    );
  }
  next = next.replace(
    /function StepperBar\([^)]*\) \{\r?\n(?!\s*const stepper = useThemedStyles)/,
    'function StepperBar({ stepIndex }: { stepIndex: number }) {\n  const stepper = useThemedStyles(createStepper);\n',
  );
  return next;
}

function injectIllus(content) {
  if (!content.includes('illus.')) return content;
  return content.replace(
    /function IllustrationCircle\([\s\S]*?\) \{\r?\n(?!\s*const illus = useThemedStyles)/,
    (m) => `${m}  const illus = useThemedStyles(createIllus);\n`,
  );
}

function fixConfetti(content) {
  if (!content.includes('AulaFinalizadaConfetti')) return content;
  let next = content;
  if (next.includes('colors.primary,') && next.includes('const CELEBRATION_COLORS')) {
    next = next.replace(
      /const CELEBRATION_COLORS = \[[\s\S]*?\];\n/,
      `function celebrationPalette(primary: string) {
  return [primary, '#FFD700', '#FFA500', '#10B981', '#F472B6', '#FFFFFF'];
}
`,
    );
    next = next.replace(
      /const colors = \{ colors: CELEBRATION_COLORS \};/g,
      'const payload = { colors: celebrationPalette(colors.primary) };',
    );
    next = next.replace(/\.\.\.colors,/g, '...payload,');
  }
  return next;
}

let n = 0;
for (const abs of walk(mobileRoot)) {
  const rel = path.relative(mobileRoot, abs).replace(/\\/g, '/');
  if (rel.startsWith('scripts/') || SKIP.has(rel)) continue;

  let content = fs.readFileSync(abs, 'utf8');
  if (!content.includes('ThemeColors') && !content.includes('createStyles')) continue;

  const before = content;
  content = ensureImports(content);
  content = dedupeHooks(content);
  content = injectScreenHooks(content);
  content = injectPortalDrawerHooks(content);
  content = injectSubcomponentStyles(content);
  content = injectStepper(content);
  content = injectIllus(content);
  content = fixConfetti(content);

  if (content !== before) {
    fs.writeFileSync(abs, content, 'utf8');
    n++;
    console.log('ok', rel);
  }
}
console.log('patched', n);
