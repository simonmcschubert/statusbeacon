import { useMemo } from 'react';
import { cn } from '../lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';

interface UptimeBarProps {
  uptimeHistory?: { date: string; uptime: number }[];
  days?: number;
  className?: string;
}

interface DayData {
  date: string;
  uptime: number;
  level: 0 | 1 | 2 | 3 | 4; // 0=no data, 1=bad, 2=poor, 3=good, 4=perfect
}

export function UptimeBar({ uptimeHistory, days = 90, className }: UptimeBarProps) {
  const barData = useMemo((): DayData[] => {
    // Optimization: Create a lookup map for faster history matching
    const historyMap = new Map<string, number>();
    uptimeHistory?.forEach(h => {
      if (h.date && h.uptime != null) {
        historyMap.set(h.date, typeof h.uptime === 'string' ? parseFloat(h.uptime) : h.uptime);
      }
    });

    // Generate the last N days
    const result: DayData[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const uptimeValueFromMap = historyMap.get(dateStr);
      
      let level: 0 | 1 | 2 | 3 | 4 = 0;
      let uptimeValue = 100;

      if (uptimeValueFromMap !== undefined) {
        uptimeValue = uptimeValueFromMap;

        if (!isNaN(uptimeValue)) {
          if (uptimeValue >= 99.9) level = 4;
          else if (uptimeValue >= 99) level = 3;
          else if (uptimeValue >= 95) level = 2;
          else level = 1;
        }
      }

      result.push({
        date: dateStr,
        uptime: uptimeValue,
        level
      });
    }

    return result;
  }, [uptimeHistory, days]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className={cn("flex items-center gap-[3px] h-8 overflow-hidden", className)}>
        {barData.map((day) => (
          <Tooltip key={day.date}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex-1 rounded-[1px] transition-all hover:scale-125 hover:z-10 cursor-help min-w-[3px] h-6 mb-1",
                  day.level === 0 && "bg-neutral-800", // No data
                  day.level === 1 && "bg-red-500", // < 95%
                  day.level === 2 && "bg-orange-400", // 95-99%
                  day.level === 3 && "bg-emerald-300", // 99-99.9%
                  day.level === 4 && "bg-emerald-500" // > 99.9%
                )}
                style={{ opacity: 1 }}
              />
            </TooltipTrigger>
            <TooltipContent className="text-xs bg-foreground text-background font-sans border-0 shadow-lg">
              <div className="font-semibold">{formatDate(day.date)}</div>
              <div>{day.level === 0 ? 'No Data' : `Uptime: ${day.uptime.toFixed(2)}%`}</div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
