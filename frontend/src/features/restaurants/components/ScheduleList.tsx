import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ScheduleView } from '@/lib/api-types';
import { dayName, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getOpenState, scheduleForDay } from '../schedule';

// Display order Monday→Sunday (backend dayOfWeek: 0=Sun..6=Sat).
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

interface ScheduleListProps {
  schedules: ScheduleView[];
}

export function ScheduleList({ schedules }: ScheduleListProps) {
  const now = new Date();
  const todayDow = now.getDay();
  const { isOpen } = getOpenState(schedules, now);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-text">
          <Clock className="size-5 text-primary" aria-hidden="true" />
          Horarios
        </h2>
        <Badge variant={isOpen ? 'success' : 'neutral'}>
          <span
            className={cn(
              'size-2 rounded-full',
              isOpen ? 'bg-success' : 'bg-text-muted',
            )}
            aria-hidden="true"
          />
          {isOpen ? 'Abierto ahora' : 'Cerrado ahora'}
        </Badge>
      </div>

      <ul className="divide-y divide-border rounded-md border border-border">
        {WEEK_ORDER.map((dow) => {
          const row = scheduleForDay(schedules, dow);
          const isToday = dow === todayDow;
          return (
            <li
              key={dow}
              className={cn(
                'flex items-center justify-between px-4 py-2.5 text-sm',
                isToday && 'bg-surface-raised',
              )}
            >
              <span className={cn('text-text-muted', isToday && 'font-semibold text-text')}>
                {dayName(dow)}
                {isToday && <span className="ml-2 text-xs text-primary">Hoy</span>}
              </span>
              <span
                className={cn(
                  'tabular-nums',
                  row ? 'text-text' : 'text-text-muted',
                  isToday && 'font-medium',
                )}
              >
                {row
                  ? `${formatTime(row.opensAt)} – ${formatTime(row.closesAt)}`
                  : 'Cerrado'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
