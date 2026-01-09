"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { HtmlLang } from "./html-lang";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Language = "en" | "id";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

const LANGUAGE_STORAGE_KEY = "jujurnal-language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(
      LANGUAGE_STORAGE_KEY
    ) as Language | null;
    if (stored && (stored === "en" || stored === "id")) {
      setLanguageState(stored);
    }
    setIsInitialized(true);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
      {isInitialized && (
        <>
          <LanguageSelectorDialog />
          <HtmlLang />
        </>
      )}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}

function LanguageSelectorDialog() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (!stored) {
      setOpen(true);
    }
  }, []);

  const handleConfirm = () => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored) {
      setOpen(false);
    } else if (language) {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      setOpen(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored) {
      setOpen(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Select Languange</DialogTitle>
          <DialogDescription>Choose your preferred language</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <FieldGroup>
            <FieldSet>
              <RadioGroup
                value={language}
                onValueChange={(value) => setLanguage(value as Language)}
              >
                <FieldLabel htmlFor="en">
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>English</FieldTitle>
                    </FieldContent>
                    <RadioGroupItem value="en" id="en" />
                  </Field>
                </FieldLabel>
                <FieldLabel htmlFor="id">
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>Bahasa Indonesia</FieldTitle>
                    </FieldContent>
                    <RadioGroupItem value="id" id="id" />
                  </Field>
                </FieldLabel>
              </RadioGroup>
            </FieldSet>
          </FieldGroup>
        </div>
        <DialogFooter>
          <Button onClick={handleConfirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
