import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import {
  formatCountdownUnit,
  getCountdownTimeLeft,
  type CountdownTimeLeft,
} from "@/lib/promotionCountdown";

interface ProductCountdownTimerProps {
  endsAt: string;
  label?: string | null;
  primaryColor?: string;
}

const ProductCountdownTimer = ({
  endsAt,
  label = "Oferta termina em",
  primaryColor = "#6a1b9a",
}: ProductCountdownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<CountdownTimeLeft | null>(() =>
    getCountdownTimeLeft(endsAt),
  );

  useEffect(() => {
    setTimeLeft(getCountdownTimeLeft(endsAt));
    if (!endsAt) return;
    const interval = setInterval(() => {
      const next = getCountdownTimeLeft(endsAt);
      setTimeLeft(next);
      if (!next || next.totalMs <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  if (!timeLeft || timeLeft.totalMs <= 0) return null;

  const displayLabel = label?.trim() || "Oferta termina em";
  const ariaLabel = `${displayLabel} ${timeLeft.days} dias, ${timeLeft.hours} horas, ${timeLeft.minutes} minutos e ${timeLeft.seconds} segundos`;

  const units: Array<{ value: number; label: string }> = [
    { value: timeLeft.days, label: "d" },
    { value: timeLeft.hours, label: "h" },
    { value: timeLeft.minutes, label: "min" },
    { value: timeLeft.seconds, label: "s" },
  ];

  return (
    <div
      aria-label={ariaLabel}
      className="rounded-md border px-2 py-1.5 text-xs"
      style={{
        borderColor: `${primaryColor}40`,
        backgroundColor: `${primaryColor}10`,
        color: primaryColor,
      }}
    >
      <div className="flex items-center gap-1 mb-1 opacity-80">
        <Clock className="h-3 w-3" />
        <span className="truncate font-medium">{displayLabel}</span>
      </div>
      <div className="flex items-center gap-1 justify-between">
        {units.map((u, i) => (
          <div key={u.label} className="flex items-center gap-1">
            <div className="flex flex-col items-center leading-none">
              <span className="font-bold tabular-nums text-[0.85rem]">
                {formatCountdownUnit(u.value)}
              </span>
              <span className="text-[0.6rem] opacity-70">{u.label}</span>
            </div>
            {i < units.length - 1 && (
              <span className="opacity-40 text-[0.7rem]">:</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductCountdownTimer;
