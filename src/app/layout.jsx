import { GoogleAnalytics } from "@next/third-parties/google";

// Keep the storefront build independent from external font downloads.
// The production server can use the system Arabic sans-serif stack offline.
export const geist = {
  className: "",
  style: { fontFamily: "Arial, Tahoma, sans-serif" }
};
import "overlayscrollbars/overlayscrollbars.css";


// THEME PROVIDER
import ThemeProvider from "theme/theme-provider";


// PRODUCT CART PROVIDER
import CartProvider from "contexts/CartContext";
import { AuthProvider } from "contexts/AuthContext";
import { CompareProvider } from "contexts/CompareContext";


// SITE SETTINGS PROVIDER
import SettingsProvider from "contexts/SettingContext";

// REACT QUERY PROVIDER
import ReactQueryProvider from "contexts/ReactQueryProvider";


// GLOBAL CUSTOM COMPONENTS
import RTL from "components/rtl";
import ProgressBar from "components/progress";
import CompareBar from "components/compare/CompareBar";


// IMPORT i18n SUPPORT FILE
import "i18n";

export default function RootLayout({
  children,
  modal
}) {
  return <html lang="ar" dir="rtl" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body id="body" className={geist.className}>
        <ReactQueryProvider>
          <AuthProvider>
            <CartProvider>
              <CompareProvider>
              <SettingsProvider>
                <ThemeProvider>
                  <RTL>
                    {modal}
                    {children}
                  </RTL>

                  <CompareBar />
                  <ProgressBar />
                </ThemeProvider>
              </SettingsProvider>
              </CompareProvider>
            </CartProvider>
          </AuthProvider>
        </ReactQueryProvider>

        <GoogleAnalytics gaId="G-XKPD36JXY0" />
      </body>
    </html>;
}
