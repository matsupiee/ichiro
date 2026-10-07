import { useEffect, useState } from "react";

// 認証コードの再送を待つ秒数。送信から60秒間は再送できない
export function useResendTimer(initiallyWaiting = false) {
  const [nextSend, setNextSend] = useState(() => (initiallyWaiting ? Date.now() + 60_000 : 0));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return {
    remaining: Math.max(0, Math.ceil((nextSend - now) / 1000)),
    restart: () => {
      const sentAt = Date.now();
      setNow(sentAt);
      setNextSend(sentAt + 60_000);
    },
  };
}
