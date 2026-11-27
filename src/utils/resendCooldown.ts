import {useEffect, useState} from "react";

export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_EMAIL_SEND_ATTEMPTS = 5;

function remainingCooldown(lastSentAt: string | null, cooldownSeconds: number): number {
  if (!lastSentAt) return 0;
  const elapsedSeconds = Math.floor((Date.now() - new Date(lastSentAt).getTime()) / 1000);
  return Math.max(0, cooldownSeconds - elapsedSeconds);
}

export function useResendCooldown(lastSentAt: string | null, cooldownSeconds = RESEND_COOLDOWN_SECONDS): number {
  const [remainingSeconds, setRemainingSeconds] = useState(() => remainingCooldown(lastSentAt, cooldownSeconds));

  useEffect(() => {
    const calculate = () => remainingCooldown(lastSentAt, cooldownSeconds);
    setRemainingSeconds(calculate());
    const timer = window.setInterval(() => setRemainingSeconds(calculate()), 1000);
    return () => window.clearInterval(timer);
  }, [lastSentAt, cooldownSeconds]);

  return remainingSeconds;
}
