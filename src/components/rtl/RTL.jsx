"use client";

import { useEffect, useMemo } from "react";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import stylisRTLPlugin from "stylis-plugin-rtl";

// GLOBAL CUSTOM HOOKS
import useSettings from "hooks/useSettings";
export default function RTL({
  children
}) {
  const {
    settings
  } = useSettings();
  useEffect(() => {
    document.dir = settings.direction;
  }, [settings.direction]);
  const cacheRtl = useMemo(() => createCache({
    key: "muirtl",
    stylisPlugins: [stylisRTLPlugin]
  }), []);
  if (settings.direction === "rtl") {
    return <CacheProvider value={cacheRtl}>{children}</CacheProvider>;
  }
  return <>{children}</>;
}