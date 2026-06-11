import { format } from 'date-fns';

import { apiListEscala, apiListTurmas } from '@/lib/api';

export type PeriodoFiltro = 'ultima' | 'trimestre' | 'ano';

export function trimestreLabel(d: Date): string {
  const m = d.getMonth();
  const t = m < 3 ? 1 : m < 6 ? 2 : m < 9 ? 3 : 4;
  return `${t}º trimestre de ${d.getFullYear()}`;
}

export function buildPeriodoFixo(periodo: Exclude<PeriodoFiltro, 'ultima'>, ref = new Date()): {
  from: string;
  to: string;
} {
  const y = ref.getFullYear();
  if (periodo === 'ano') {
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  const m = ref.getMonth();
  if (m < 3) return { from: `${y}-01-01`, to: `${y}-03-31` };
  if (m < 6) return { from: `${y}-04-01`, to: `${y}-06-30` };
  if (m < 9) return { from: `${y}-07-01`, to: `${y}-09-30` };
  return { from: `${y}-10-01`, to: `${y}-12-31` };
}

export async function resolveUltimaAulaRange(congregacaoId: number): Promise<{ from: string; to: string } | null> {
  const tr = await apiListTurmas(congregacaoId);
  if (!tr.ok || tr.turmas.length === 0) return null;

  let maxDate = '';
  for (const turma of tr.turmas.slice(0, 30)) {
    const er = await apiListEscala(turma.id);
    if (!er.ok) continue;
    for (const row of er.escala) {
      const d = row.data_aula?.slice(0, 10) ?? '';
      if (d.length === 10 && d > maxDate) {
        maxDate = d;
      }
    }
  }

  if (maxDate === '') return null;
  return { from: maxDate, to: maxDate };
}

export function isoToday(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
