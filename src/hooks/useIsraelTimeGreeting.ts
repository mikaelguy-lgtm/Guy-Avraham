import {useEffect, useState} from "react";
import {formatIsraelTimeGreeting} from "../utils/formatters";

const millisecondsUntilNextMinute = (date: Date): number =>
  60_050 - (date.getSeconds() * 1_000 + date.getMilliseconds());

export function useIsraelTimeGreeting(firstName: string): string {
  const [greeting, setGreeting] = useState(() => formatIsraelTimeGreeting(firstName));

  useEffect(() => {
    let timeoutId: number | undefined;

    const refresh = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      const now = new Date();
      setGreeting(formatIsraelTimeGreeting(firstName, now));
      timeoutId = window.setTimeout(refresh, millisecondsUntilNextMinute(now));
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    refresh();
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refresh);
    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [firstName]);

  return greeting;
}
