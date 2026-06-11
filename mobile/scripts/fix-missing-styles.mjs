/**
 * Garante hooks de tema em componentes exportados e corrige subcomponentes stepper/illus.
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
  if (next.includes('createStyles') && !next.includes("from '@/hooks/useThemedStyles'")) {
    next = next.replace(
      /import \{ type ThemeColors \} from '@\/constants\/theme';/,
      "import { type ThemeColors } from '@/constants/theme';\nimport { useThemedStyles } from '@/hooks/useThemedStyles';",
    );
  }
  if (/\bcolors\./.test(next) && !next.includes("from '@/context/AppThemeContext'")) {
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

function fixExportDefault(content) {
  if (!content.includes('function createStyles(')) return content;
  return content.replace(
    /export default function (\w+)\(([^)]*)\) \{\n(?!\s*const styles = useThemedStyles)/,
    'export default function $1($2) {\n  const styles = useThemedStyles(createStyles);\n  const { colors } = useAppTheme();\n',
  );
}

function fixExportNamedScreen(content) {
  if (!content.includes('function createStyles(')) return content;
  return content.replace(
    /export function (\w+)\(([^)]*)\) \{\n(?!\s*const styles = useThemedStyles)(?=[\s\S]{0,400}?styles\.)/,
    'export function $1($2) {\n  const styles = useThemedStyles(createStyles);\n  const { colors } = useAppTheme();\n',
  );
}

function fixStepperBar(content) {
  if (!content.includes('stepper.track') && !content.includes('stepper.fill')) return content;
  if (content.includes('useThemedStyles(createStepper)')) return content;

  if (!content.includes('function createStepper(')) {
    content = content.replace(
      /function createStyles\(colors: ThemeColors\) \{/,
      `function createStepper(colors: ThemeColors) {
  return StyleSheet.create({
  track: {
    alignSelf: 'center',
    width: screenW - 56,
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
  );
}

function fixPortalDrawer(content) {
  if (!content.includes('export function PortalDrawerMenu')) return content;
  return content.replace(
    /export function PortalDrawerMenu\(([^)]*)\) \{\n(?!\s*const styles = useThemedStyles)/,
    'export function PortalDrawerMenu($1) {\n  const styles = useThemedStyles(createStyles);\n  const { colors } = useAppTheme();\n',
  );
}

function fixConfetti(content) {
  if (!content.includes('export function AulaFinalizadaConfetti')) return content;
  return content.replace(
    /export function AulaFinalizadaConfetti\(\) \{\n(?!\s*const \{ colors \})/,
    'export function AulaFinalizadaConfetti() {\n  const { colors } = useAppTheme();\n  const styles = useThemedStyles(createStyles);\n',
  );
}

function removeDuplicateHooks(content) {
  return content
    .replace(
      /const styles = useThemedStyles\(createStyles\);\n\s*const \{ colors \} = useAppTheme\(\);\n([\s\S]*?)const \{ colors[^}]+\} = useAppTheme\(\);\n\s*const styles = useMemo\(\(\) => createStyles\(colors\), \[colors\]\);\n/g,
      'const { colors$1 } = useAppTheme();\n  const styles = useMemo(() => createStyles(colors), [colors]);\n',
    )
    .replace(
      /const styles = useThemedStyles\(createStyles\);\n\s*const \{ colors \} = useAppTheme\(\);\n\s*const styles = useThemedStyles\(createStyles\);\n/g,
      'const styles = useThemedStyles(createStyles);\n  const { colors } = useAppTheme();\n',
    );
}

for (const abs of walk(mobileRoot)) {
  const rel = path.relative(mobileRoot, abs);
  if (rel.startsWith('scripts/') || rel.includes('InicioPage') || rel.includes('InfoHintCard')) continue;

  let content = fs.readFileSync(abs, 'utf8');
  if (!content.includes('ThemeColors') && !content.includes('useThemedStyles')) continue;

  const original = content;
  content = ensureImports(content);
  content = removeDuplicateHooks(content);
  content = fixStepperBar(content);
  content = fixPortalDrawer(content);
  content = fixConfetti(content);
  content = fixExportDefault(content);
  content = fixExportNamedScreen(content);

  if (content !== original) {
    fs.writeFileSync(abs, content, 'utf8');
    console.log('fixed:', rel);
  }
}
