import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import trTranslations from '@/locales/tr.json';
import enTranslations from '@/locales/en.json';
import deTranslations from '@/locales/de.json';

export type Language = 'tr' | 'en' | 'de';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: any;
}

const translations = {
  tr: trTranslations,
  en: enTranslations,
  de: deTranslations,
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [isDetecting, setIsDetecting] = useState(true);

  useEffect(() => {
    const detectLanguage = async () => {
      const saved = localStorage.getItem('language');
      
      if (saved) {
        setLanguageState(saved as Language);
        setIsDetecting(false);
        return;
      }

      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        const country = data.country_code;

        let detectedLang: Language = 'en';

        if (country === 'TR') {
          detectedLang = 'tr';
        } else if (['DE', 'NL', 'AT', 'CH', 'BE', 'LU'].includes(country)) {
          detectedLang = 'de';
        }

        setLanguageState(detectedLang);
        localStorage.setItem('language', detectedLang);
      } catch (error) {
        console.log('Language detection failed, using English');
        setLanguageState('en');
        localStorage.setItem('language', 'en');
      } finally {
        setIsDetecting(false);
      }
    };

    detectLanguage();
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const value = {
    language,
    setLanguage,
    t: translations[language],
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
