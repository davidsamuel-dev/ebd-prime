import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** RF01 + doc: saudação por horário local (05–11:59 / 12–17:59 / 18–04:59). */
export function getTimeOfDayGreeting(date: Date = new Date()): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const minutes = h * 60 + m;
  // 18:00 – 04:59  => noite; 05:00 – 11:59 => dia; 12:00 – 17:59 => tarde
  if (minutes >= 18 * 60 || minutes < 5 * 60) return 'Boa noite';
  if (minutes < 12 * 60) return 'Bom dia';
  return 'Boa tarde';
}

export function formatTodayPt(date: Date = new Date()): string {
  return format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
}
