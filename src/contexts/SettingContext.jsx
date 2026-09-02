"use client";

import { createContext, useCallback, useEffect, useMemo, useState } from "react";

import { apiGet } from "utils/api";
import { configureCurrency } from "utils/currency";
import i18n from "i18n";
import { normalizeThemeKey } from "theme/theme-presets";


// ============================================================


// ============================================================


const initialSettings = {
  direction: "rtl",
  site_name: "Alphabeta Store",
  site_logo_url: "",
  theme: "TECH_MODERN",
  primary_color: "#f59331",
  enable_whatsapp: "true",
  default_language: "ar",
  default_currency: "LYD",
  exchange_rate_usd_to_lyd: "5.2",
  auto_round_prices: "false",
  shop_phone: "+218000000000",
  shop_address: "Tripoli, Libya",
  min_order: "0",
  support_email: "support@alphabeta.com",
  app_store_url: "",
  google_play_url: "",
  terms_and_conditions_text: "باستخدامك لهذه المنصة وتسجيل حساب جديد، فأنت توافق على الالتزام بشروط الاستخدام وسياسات المتجر.",
  privacy_policy_text: "نقوم بجمع البيانات الأساسية اللازمة لتقديم الخدمة ومعالجة الطلبات، مع الحفاظ على خصوصية بياناتك وعدم مشاركتها خارج نطاق التشغيل القانوني."
};

function normalizeSettings(value) {
  if (!value || typeof value !== "object") {
    return initialSettings;
  }

  const source = value;

  return {
    default_language: source.default_language === "en" ? "en" : "ar",
    direction: source.direction === "ltr" ? "ltr" : source.default_language === "en" ? "ltr" : "rtl",
    site_name: String(source.site_name || initialSettings.site_name),
    site_logo_url: String(source.site_logo_url || ""),
    theme: normalizeThemeKey(source.theme || initialSettings.theme),
    primary_color: String(source.primary_color || initialSettings.primary_color),
    enable_whatsapp: String(source.enable_whatsapp ?? initialSettings.enable_whatsapp),
    // USD is an internal pricing currency only. Customers always see LYD.
    default_currency: "LYD",
    exchange_rate_usd_to_lyd: String(source.exchange_rate_usd_to_lyd || initialSettings.exchange_rate_usd_to_lyd),
    auto_round_prices: String(source.auto_round_prices ?? "false"),
    shop_phone: String(source.shop_phone || initialSettings.shop_phone),
    shop_address: String(source.shop_address || initialSettings.shop_address),
    min_order: String(source.min_order || initialSettings.min_order),
    support_email: String(source.support_email || initialSettings.support_email),
    app_store_url: String(source.app_store_url || ""),
    google_play_url: String(source.google_play_url || ""),
    terms_and_conditions_text: String(source.terms_and_conditions_text || initialSettings.terms_and_conditions_text),
    privacy_policy_text: String(source.privacy_policy_text || initialSettings.privacy_policy_text)
  };
}

export const SettingsContext = createContext({
  settings: initialSettings,
  loading: true,
  updateSettings: arg => {},
  refreshSettings: async () => ({})
});
export default function SettingsProvider({
  children
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(true);

  const updateSettings = useCallback(updatedSetting => {
    setSettings(prev => ({
      ...prev,
      ...updatedSetting
    }));
  }, []);

  const refreshSettings = useCallback(async () => {
    const remoteSettings = await apiGet("/settings");
    const normalized = normalizeSettings(remoteSettings);
    const localLanguage = typeof window !== "undefined" ? window.localStorage.getItem("alphabeta_locale") : null;

    if (localLanguage === "ar" || localLanguage === "en") {
      normalized.default_language = localLanguage;
      normalized.direction = localLanguage === "ar" ? "rtl" : "ltr";
    }

    const previewTheme = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("theme") : null;
    if (previewTheme) {
      normalized.theme = normalizeThemeKey(previewTheme);
    }

    setSettings(prev => ({
      ...prev,
      ...normalized
    }));
    return normalized;
  }, []);

  useEffect(() => {
    refreshSettings().catch(() => null).finally(() => {
      setLoading(false);
    });
  }, [refreshSettings]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.lang = settings.default_language;
    document.documentElement.dir = settings.direction;

    if (settings.site_name) {
      document.title = settings.site_name;
    }

    i18n.changeLanguage(settings.default_language).catch(() => null);

    configureCurrency({
      default_currency: settings.default_currency,
      exchange_rate_usd_to_lyd: settings.exchange_rate_usd_to_lyd,
      default_language: settings.default_language
    });
  }, [
    settings.default_language,
    settings.default_currency,
    settings.direction,
    settings.exchange_rate_usd_to_lyd,
    settings.site_name
  ]);

  const contextValue = useMemo(() => ({
    settings,
    loading,
    updateSettings,
    refreshSettings
  }), [settings, loading, updateSettings, refreshSettings]);

  return <SettingsContext value={contextValue}>{children}</SettingsContext>;
}
