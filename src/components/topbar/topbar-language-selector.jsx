"use client";

import MenuItem from "@mui/material/MenuItem";
import TouchRipple from "@mui/material/ButtonBase";
import ExpandMore from "@mui/icons-material/ExpandMore";
import { useTranslation } from "react-i18next";
import AppMenu from "components/AppMenu";
import useSettings from "hooks/useSettings";


// ==============================================================


// ==============================================================

export function TopbarLanguageSelector({
  languages
}) {
  const {
    i18n
  } = useTranslation();
  const {
    settings,
    updateSettings
  } = useSettings();

  const normalizedLanguages = (() => {
    const fallbackLanguage = {
      ar: {
        title: "AR",
        value: "ar"
      },
      en: {
        title: "EN",
        value: "en"
      }
    };

    if (Array.isArray(languages)) {
      const mappedLanguages = languages.reduce((accumulator, item, index) => {
        if (!item || typeof item !== "object") {
          return accumulator;
        }

        const rawCode = String(item.value || "").trim().toLowerCase();
        const fallbackCode = String(item.title || "").trim().toLowerCase() || `lang-${index}`;
        const code = rawCode || fallbackCode;

        accumulator[code] = {
          title: String(item.title || code.toUpperCase()),
          value: code
        };

        return accumulator;
      }, {});

      return Object.keys(mappedLanguages).length ? mappedLanguages : fallbackLanguage;
    }

    if (languages && typeof languages === "object") {
      const mappedLanguages = Object.keys(languages).reduce((accumulator, key) => {
        const item = languages[key];

        if (!item || typeof item !== "object") {
          return accumulator;
        }

        const code = String(item.value || key).trim().toLowerCase();

        accumulator[code] = {
          title: String(item.title || code.toUpperCase()),
          value: code
        };

        return accumulator;
      }, {});

      return Object.keys(mappedLanguages).length ? mappedLanguages : fallbackLanguage;
    }

    return fallbackLanguage;
  })();

  const languageCodes = Object.keys(normalizedLanguages);
  const resolvedLanguage = String(i18n.resolvedLanguage || i18n.language || settings.default_language || "ar").toLowerCase();
  const baseLanguage = resolvedLanguage.split("-")[0];
  const selectedLanguage = normalizedLanguages[resolvedLanguage] || normalizedLanguages[baseLanguage] || normalizedLanguages[languageCodes[0]];

  const handleChangeLanguage = lang => {
    i18n.changeLanguage(lang);
    updateSettings({
      default_language: lang,
      direction: lang === "ar" ? "rtl" : "ltr"
    });

    if (typeof window !== "undefined") {
      window.localStorage.setItem("alphabeta_locale", lang);
      window.location.reload();
    }
  };

  return <AppMenu handler={e => <TouchRipple onClick={e} sx={{
    svg: {
      fontSize: 16
    },
    span: {
      fontSize: 13
    }
  }}>
          <span>{selectedLanguage.title}</span>
          <ExpandMore fontSize="small" />
        </TouchRipple>} options={onClose => {
    return languageCodes.map(code => <MenuItem key={code} onClick={() => {
      handleChangeLanguage(code);
      onClose();
    }}>
            {normalizedLanguages[code].title}
          </MenuItem>);
  }} />;
}
