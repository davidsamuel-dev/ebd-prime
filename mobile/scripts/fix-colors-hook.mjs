/**
 * Adiciona useAppTheme().colors onde JSX usa colors.* e corrige ficheiros partidos.
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

function usesColorsInJsx(content) {
  const withoutFactories = content.replace(/function create\w+\([\s\S]*?\n\}/g, '');
  return /[^:]colors\.(primary|background|text|white|textMuted|danger|border|success|overlay|card|surface)/.test(
    withoutFactories,
  );
}

function repair(content) {
  let next = content;

  if (usesColorsInJsx(next) && !next.includes('const { colors } = useAppTheme()')) {
    if (!next.includes("from '@/context/AppThemeContext'")) {
      next = next.replace(
        /import \{ useThemedStyles \} from '@\/hooks\/useThemedStyles';/,
        "import { useAppTheme } from '@/context/AppThemeContext';\nimport { useThemedStyles } from '@/hooks/useThemedStyles';",
      );
      if (!next.includes("from '@/context/AppThemeContext'")) {
        next = next.replace(
          /import \{ type ThemeColors \} from '@\/constants\/theme';/,
          "import { type ThemeColors } from '@/constants/theme';\nimport { useAppTheme } from '@/context/AppThemeContext';\nimport { useThemedStyles } from '@/hooks/useThemedStyles';",
        );
      }
    }

    next = next.replace(
      /const styles = useThemedStyles\(createStyles\);\n(?!\s*const \{ colors \})/g,
      'const styles = useThemedStyles(createStyles);\n  const { colors } = useAppTheme();\n',
    );

    next = next.replace(
      /export function (\w+)\([^)]*\) \{\n(?!\s*const styles)(?=[\s\S]*?colors\.)/,
      (m) => `${m}  const { colors } = useAppTheme();\n`,
    );
  }

  // createillus -> createIllus in useThemedStyles calls
  next = next.replace(/useThemedStyles\(createillus\)/g, 'useThemedStyles(createIllus)');

  return next === content ? null : next;
}

for (const abs of walk(mobileRoot)) {
  const rel = path.relative(mobileRoot, abs);
  if (rel.startsWith('scripts/')) continue;
  const content = fs.readFileSync(abs, 'utf8');
  if (!content.includes('useThemedStyles') && !content.includes('ThemeColors')) continue;
  const repaired = repair(content);
  if (repaired) {
    fs.writeFileSync(abs, repaired, 'utf8');
    console.log('colors hook:', rel);
  }
}
