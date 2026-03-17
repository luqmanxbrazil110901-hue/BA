"use client"

import { createContext, useContext, useState, ReactNode } from "react"
import { Locale, TranslationKey, t as translate } from "./i18n"

interface I18nContext {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

const Ctx = createContext<I18nContext>({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en")
  const t = (key: TranslationKey, vars?: Record<string, string | number>) =>
    translate(locale, key, vars)
  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>
}

export function useI18n() {
  return useContext(Ctx)
}
