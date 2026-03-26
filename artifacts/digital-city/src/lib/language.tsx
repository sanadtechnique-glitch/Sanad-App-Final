import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Lang = "ar" | "fr";

interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  isRTL: boolean;
  t: (ar: string, fr: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "ar",
  setLang: () => {},
  isRTL: true,
  t: (ar) => ar,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return (localStorage.getItem("dc_lang") as Lang) || "ar"; } catch { return "ar"; }
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("dc_lang", l); } catch {}
  };

  const isRTL = lang === "ar";

  // Apply RTL/LTR and font to document
  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = isRTL ? "ar" : "fr";
  }, [isRTL]);

  const t = (ar: string, fr: string) => (lang === "ar" ? ar : fr);

  return (
    <LanguageContext.Provider value={{ lang, setLang, isRTL, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
