"use client";

import { useCallback, useEffect, useState } from "react";
import { AppLanguage, isAppLanguage, translate } from "@/lib/i18n";

const STORAGE_KEY = "lista-language";

export function useAppLanguage(initialLanguage: AppLanguage = "pt-BR", preferStored = false) {
  const [language, setLanguageState] = useState<AppLanguage>(initialLanguage);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = localStorage.getItem(STORAGE_KEY);
      const next = preferStored && isAppLanguage(stored) ? stored : initialLanguage;
      setLanguageState(next);
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialLanguage, preferStored]);

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }, []);

  const t = useCallback(
    (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) => translate(language, key, values),
    [language],
  );

  return { language, setLanguage, t };
}
