"use client";

import { useEffect } from "react";
import { useLanguage } from "./language-provider";

export function HtmlLang() {
  const { language } = useLanguage();

  useEffect(() => {
    document.documentElement.lang = language === "id" ? "id" : "en";
  }, [language]);

  return null;
}
