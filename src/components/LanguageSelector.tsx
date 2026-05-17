import { useLanguage, Language } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// PNG FLAG IMPORTS
import trFlag from "@/assets/flags/tr.png";
import enFlag from "@/assets/flags/en.png";
import deFlag from "@/assets/flags/de.png";

const languages: { code: Language; label: string; flag: string }[] = [
  { code: "tr", label: "Türkçe", flag: trFlag },
  { code: "en", label: "English", flag: enFlag },
  { code: "de", label: "Deutsch", flag: deFlag },
];

export const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage();
  const currentLang = languages.find((lang) => lang.code === language);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10 rounded-full p-0"
        >
          <img
            src={currentLang?.flag}
            alt="flag"
            className="w-8 h-8 rounded-full object-cover"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="bg-card border-border">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={`cursor-pointer flex items-center gap-2 ${
              language === lang.code ? "bg-secondary" : ""
            } hover:bg-secondary/50`}
          >
            <img
              src={lang.flag}
              alt={lang.label}
              className="w-6 h-6 rounded-full object-cover"
            />
            <span>{lang.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
