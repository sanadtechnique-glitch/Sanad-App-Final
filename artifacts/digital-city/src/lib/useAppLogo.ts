import { useState, useEffect } from "react";
import { get } from "./admin-api";

const FALLBACK = "/sanad-logo-master.png";
let cached: string | null = null;
const listeners: Array<(url: string) => void> = [];

function notify(url: string) {
  cached = url;
  for (const fn of listeners) fn(url);
}

export function setLogoUrl(url: string) {
  notify(url);
}

export function useAppLogo(): string {
  const [logo, setLogo] = useState<string>(cached ?? FALLBACK);

  useEffect(() => {
    listeners.push(setLogo);
    if (!cached) {
      get<{ key: string; value: string | null }>("/app-settings/app_logo_url")
        .then(d => {
          const url = d?.value || FALLBACK;
          notify(url);
          setLogo(url);
        })
        .catch(() => {});
    }
    return () => {
      const i = listeners.indexOf(setLogo);
      if (i !== -1) listeners.splice(i, 1);
    };
  }, []);

  return logo;
}
