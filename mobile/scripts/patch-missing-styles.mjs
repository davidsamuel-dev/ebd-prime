import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');

const targets = [
  'app/acesso-administrativo/convidar.tsx',
  'app/acesso-administrativo/index.tsx',
  'app/resumo-turma.tsx',
  'app/historico.tsx',
  'app/dados-conta.tsx',
  'app/conta-alterar.tsx',
  'app/cadastros-inativos.tsx',
  'components/PortalDrawerMenu.tsx',
];

for (const rel of targets) {
  const abs = path.join(mobileRoot, rel);
  let content = fs.readFileSync(abs, 'utf8');

  if (!content.includes("import { useThemedStyles }")) {
    content = content.replace(
      /import \{ type ThemeColors \} from '@\/constants\/theme';/,
      "import { type ThemeColors } from '@/constants/theme';\nimport { useAppTheme } from '@/context/AppThemeContext';\nimport { useThemedStyles } from '@/hooks/useThemedStyles';",
    );
  }
  if (!content.includes("import { useAppTheme }")) {
    content = content.replace(
      /import \{ useThemedStyles \} from '@\/hooks\/useThemedStyles';/,
      "import { useAppTheme } from '@/context/AppThemeContext';\nimport { useThemedStyles } from '@/hooks/useThemedStyles';",
    );
  }

  if (rel.includes('PortalDrawerMenu')) {
    content = content.replace(
      /export function PortalDrawerMenu\(([^)]*)\) \{\n(?!\s*const styles = useThemedStyles)/,
      'export function PortalDrawerMenu($1) {\n  const styles = useThemedStyles(createStyles);\n  const { colors } = useAppTheme();\n',
    );
  } else {
    content = content.replace(
      /export default function (\w+)\([^)]*\) \{\n(?!\s*const styles = useThemedStyles)/,
      'export default function $1() {\n  const styles = useThemedStyles(createStyles);\n  const { colors } = useAppTheme();\n',
    );
  }

  // StepperBar helper
  if (content.includes('stepper.track')) {
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
    content = content.replace(
      /function StepperBar\([^)]*\) \{\n(?!\s*const stepper = useThemedStyles)/,
      'function StepperBar({ stepIndex }: { stepIndex: number }) {\n  const stepper = useThemedStyles(createStepper);\n',
    );
  }

  fs.writeFileSync(abs, content, 'utf8');
  console.log('patched', rel);
}
