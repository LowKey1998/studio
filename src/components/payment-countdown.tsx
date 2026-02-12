
'use client';

import * as React from 'react';
import { differenceInSeconds, parseISO } from 'date-fns';
import { Timer, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type CountdownTime = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
};

export function PaymentCountdown({ deadlineDate, title }: { deadlineDate: string; title: string }) {
  const [timeLeft, setTimeLeft] = React.useState<CountdownTime | null>(null);

  React.useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const target = parseISO(deadlineDate);
      const diff = differenceInSeconds(target, now);

      if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
      }

      return {
        days: Math.floor(diff / (24 * 3600)),
        hours: Math.floor((diff % (24 * 3600)) / 3600),
        minutes: Math.floor((diff % 3600) / 60),
        seconds: diff % 60,
        isExpired: false,
      };
    };

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    setTimeLeft(calculateTimeLeft()); // Initial call

    return () => clearInterval(timer);
  }, [deadlineDate]);

  if (!timeLeft) return null;

  if (timeLeft.isExpired) {
    return (
      <div className="flex items-center gap-2 text-destructive font-bold text-sm bg-destructive/10 p-2 rounded-md border border-destructive/20 animate-in fade-in zoom-in">
        <AlertTriangle className="h-4 w-4" />
        <span>{title} EXPIRED</span>
      </div>
    );
  }

  const isUrgent = timeLeft.days < 3;

  return (
    <div className={cn(
      "flex flex-col gap-1 p-3 rounded-lg border shadow-sm transition-all",
      isUrgent ? "bg-orange-50 border-orange-200 text-orange-800" : "bg-primary/5 border-primary/20 text-primary"
    )}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{title}</span>
        <Timer className={cn("h-3 w-3", isUrgent && "animate-pulse")} />
      </div>
      <div className="flex gap-2 items-baseline">
        <div className="flex flex-col">
          <span className="text-2xl font-black leading-none">{timeLeft.days}</span>
          <span className="text-[8px] uppercase font-bold opacity-60">Days</span>
        </div>
        <span className="text-xl font-bold opacity-30">:</span>
        <div className="flex flex-col">
          <span className="text-2xl font-black leading-none">{timeLeft.hours.toString().padStart(2, '0')}</span>
          <span className="text-[8px] uppercase font-bold opacity-60">Hrs</span>
        </div>
        <span className="text-xl font-bold opacity-30">:</span>
        <div className="flex flex-col">
          <span className="text-2xl font-black leading-none">{timeLeft.minutes.toString().padStart(2, '0')}</span>
          <span className="text-[8px] uppercase font-bold opacity-60">Min</span>
        </div>
      </div>
    </div>
  );
}
