/**
 * Corrige migração de tema: hooks duplicados, hooks em falta e subcomponentes.
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
    else if (name.name.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

function ensureImports(content) {
  let next = content;
  if (!next.includes("from '@/hooks/useThemedStyles'") && next.includes('function createStyles(')) {
    next = next.replace(
      /import \{ type ThemeColors \} from '@\/constants\/theme';/,
      "import { type ThemeColors } from '@/constants/theme';\nimport { useThemedStyles } from '@/hooks/useThemedStyles';",
    );
  }
  if (!next.includes("from '@/context/AppThemeContext'") && /\bcolors\./.test(next)) {
    if (next.includes("from '@/hooks/useThemedStyles'")) {
      next = next.replace(
        /import \{ useThemedStyles \} from '@\/hooks\/useThemedStyles';/,
        "import { useAppTheme } from '@/context/AppThemeContext';\nimport { useThemedStyles } from '@/hooks/useThemedStyles';",
      );
    } else {
      next = next.replace(
        /import \{ type ThemeColors \} from '@\/constants\/theme';/,
        "import { type ThemeColors } from '@/constants/theme';\nimport { useAppTheme } from '@/context/AppThemeContext';",
      );
    }
  }
  return next;
}

function removeDuplicateHooks(content) {
  let next = content;
  // Remove linhas duplicadas consecutivas de hooks
  next = next.replace(
    /const styles = useThemedStyles\(createStyles\);\n/g,
    '___STYLES_HOOK___\n',
  );
  next = next.replace(/___STYLES_HOOK___\n(?:___STYLES_HOOK___\n)+/g, '___STYLES_HOOK___\n');
  next = next.replace(/___STYLES_HOOK___\n/g, 'const styles = useThemedStyles(createStyles);\n');

  next = next.replace(/const \{ colors \} = useAppTheme\(\);\n/g, '___COLORS_HOOK___\n');
  next = next.replace(/___COLORS_HOOK___\n(?:___COLORS_HOOK___\n)+/g, '___COLORS_HOOK___\n');
  next = next.replace(/___COLORS_HOOK___\n/g, 'const { colors } = useAppTheme();\n');

  next = next.replace(
    /const illus = useThemedStyles\(createIllus\);\n/g,
    '___ILLUS_HOOK___\n',
  );
  next = next.replace(/___ILLUS_HOOK___\n(?:___ILLUS_HOOK___\n)+/g, '___ILLUS_HOOK___\n');
  next = next.replace(/___ILLUS_HOOK___\n/g, 'const illus = useThemedStyles(createIllus);\n');

  return next;
}

function addHooksToExportDefault(content) {
  if (!content.includes('function createStyles(')) return content;
  if (!content.includes('export default function')) return content;

  return content.replace(
    /export default function (\w+)\([^)]*\) \{\n(?!\s*const styles = useThemedStyles)/,
    'export default function $1() {\n  const styles = useThemedStyles(createStyles);\n  const { colors } = useAppTheme();\n',
  );
}

function addHooksToExportNamed(content) {
  if (!content.includes('function createStyles(')) return content;

  return content.replace(
    /export function PortalDrawerMenu\(([^)]*)\) \{\n(?!\s*const styles = useThemedStyles)/,
    'export function PortalDrawerMenu($1) {\n  const styles = useThemedStyles(createStyles);\n  const { colors } = useAppTheme();\n',
  );
}

function fixMenuRow(content) {
  if (!content.includes('function MenuRow(')) return content;
  if (content.includes('function MenuRow(') && content.match(/function MenuRow[\s\S]*?const styles = useThemedStyles/)) {
    return content;
  }
  return content.replace(
    /function MenuRow\([^)]*\) \{\n(?!\s*const styles = useThemedStyles)/,
    'function MenuRow({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {\n  const styles = useThemedStyles(createStyles);\n',
  );
}

function fixDivider(content) {
  if (!content.includes('function Divider()')) return content;
  return content.replace(
    /function Divider\(\) \{\n(?!\s*const styles = useThemedStyles)/,
    'function Divider() {\n  const styles = useThemedStyles(createStyles);\n',
  );
}

function fixStepperBar(content) {
  if (!content.includes('stepper.track')) return content;

  if (!content.includes('function createStepper(')) {
    const barW = content.includes('screenW - 48') ? 'screenW - 48' : 'screenW - 56';
    content = content.replace(
      /function createStyles\(colors: ThemeColors\) \{/,
      `function createStepper(colors: ThemeColors) {
  return StyleSheet.create({
  track: {
    alignSelf: 'center',
    width: ${barW},
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

  return content.replace(
    /function StepperBar\([^)]*\) \{\n(?!\s*const stepper = useThemedStyles)/,
    'function StepperBar({ stepIndex }: { stepIndex: number }) {\n  const stepper = useThemedStyles(createStepper);\n',
  ).replace(
    /backgroundColor: colors\.primary \}\]\}/g,
    '}]}',
  );
}

function fixIllusSubcomponents(content) {
  if (!content.includes('illus.circle') && !content.includes('illus.phone')) return content;

  if (content.includes('function IllustrationCircle(') && !content.match(/function IllustrationCircle[\s\S]{0,200}?const illus = useThemedStyles/)) {
    content = content.replace(
      /function IllustrationCircle\([^)]*\) \{\n(?!\s*const illus = useThemedStyles)/,
      (m) => `${m}  const illus = useThemedStyles(createIllus);\n`,
    );
  }

  return content;
}

function fixConfetti(content) {
  if (!content.includes('AulaFinalizadaConfetti')) return content;

  content = content.replace(
    /const CELEBRATION_COLORS = \[\n  colors\.primary,[\s\S]*?\];\n/,
    `function celebrationColors(primary: string) {
  return [primary, '#FFD700', '#FFA500', '#10B981', '#F472B6', '#FFFFFF'];
}
`,
  );

  content = content.replace(
    /const colors = \{ colors: CELEBRATION_COLORS \};/,
    'const payload = { colors: celebrationColors(colors.primary) };',
  );

  content = content.replace(
    /fire\(\{ \.\.\.presets\.(\w+), \.\.\.colors,/g,
    'fire({ ...presets.$1, ...payload,',
  );

  return content;
}

function fixHelperComponentsWithStyles(content) {
  // aula-resumo subcomponents pattern
  const helpers = ['ResumoCard', 'ResumoLinha', 'ResumoHeader'];
  for (const name of helpers) {
    const re = new RegExp(`function ${name}\\([^)]*\\) \\{\\n(?!\\s*const styles = useThemedStyles)`);
    if (content.includes(`function ${name}(`) && re.test(content)) {
      content = content.replace(
        re,
        `function ${name}($1) {\n  const styles = useThemedStyles(createStyles);\n`,
      );
    }
  }
  return content;
}

let fixed = 0;
for (const abs of walk(mobileRoot)) {
  const rel = path.relative(mobileRoot, abs).replace(/\\/g, '/');
  if (rel.startsWith('scripts/') || rel.includes('InicioPage') || rel.includes('InfoHintCard') || rel.includes('MainPortalHeader') || rel.includes('MainTabBar') || rel.includes('MainSwipeHub')) continue;

  let content = fs.readFileSync(abs, 'utf8');
  if (!content.includes('ThemeColors') && !content.includes('useThemedStyles') && !content.includes('useAppTheme')) continue;

  const original = content;
  content = ensureImports(content);
  content = removeDuplicateHooks(content);
  content = addHooksToExportDefault(content);
  content = addHooksToExportNamed(content);
  content = fixMenuRow(content);
  content = fixDivider(content);
  content = fixStepperBar(content);
  content = fixIllusSubcomponents(content);
  content = fixConfetti(content);

  if (content !== original) {
    fs.writeFileSync(abs, content, 'utf8');
    fixed++;
    console.log('fixed:', rel);
  }
}
console.log('total:', fixed);
