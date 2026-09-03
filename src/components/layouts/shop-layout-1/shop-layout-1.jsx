import { Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";

// GLOBAL CUSTOM COMPONENTS
import { Footer1, FooterApps, FooterContact, FooterLinksWidget, FooterSocialLinks } from "components/footer";
import Sticky from "components/sticky";
import { NavigationList } from "components/navbar";
import { CategoryList } from "components/categories";
import { MobileMenu } from "components/mobile-navbar";
import { SecondaryHeader } from "components/secondary-header";
import { MobileNavigationBar } from "components/mobile-navigation";
import { SearchInput2 } from "components/search-box";
import { TopbarLanguageSelector } from "components/topbar";
import { Header, HeaderCart, HeaderLogin, HeaderWishlist, MobileHeader, HeaderSearch } from "components/header";

// CUSTOM DATA MODEL


// ==============================================================


// ==============================================================

export default function ShopLayout1({
  children,
  data,
  hideSecondaryHeader = false
}) {
  const {
    footer,
    header,
    topbar,
    mobileNavigation
  } = data;
  const MOBILE_VERSION_HEADER = <MobileHeader>
      <MobileHeader.Left>
        <MobileMenu navigation={header.mobileNavigation || header.navigation} languages={topbar.languageOptions} />
      </MobileHeader.Left>

      <MobileHeader.Logo logoUrl={mobileNavigation.logo} siteName={mobileNavigation.siteName} />

      <MobileHeader.Right>
        <HeaderSearch>
          <SearchInput2 />
        </HeaderSearch>

        <HeaderLogin />
        <HeaderWishlist />
        <HeaderCart />
      </MobileHeader.Right>
    </MobileHeader>;
  return <Fragment>
      <Sticky fixedOn={0} scrollDistance={0}>
        <Header mobileHeader={MOBILE_VERSION_HEADER}>
          <Header.Left>
            <Header.Logo url={header.logo} siteName={header.siteName} />
          </Header.Left>

          <Header.Mid sx={{ flex: "1 1 0", minWidth: 0, px: { lg: 2, xl: 5 } }}>
            <SearchInput2 />
          </Header.Mid>

          <Header.Right>
            <TopbarLanguageSelector languages={topbar.languageOptions} />
            <HeaderLogin />
            <HeaderWishlist />
            <HeaderCart />
          </Header.Right>
        </Header>
        {!hideSecondaryHeader && <SecondaryHeader elevation={0}>
          <SecondaryHeader.Left>
            <CategoryList />
          </SecondaryHeader.Left>
          <SecondaryHeader.Right>
            <NavigationList navigation={header.navigation} />
          </SecondaryHeader.Right>
        </SecondaryHeader>}
      </Sticky>

      {children}

      <MobileNavigationBar navigation={mobileNavigation.version1} />

      <Footer1>
        <Footer1.Brand>
          <Link href="/">
            {footer.logo ? <Image src={footer.logo} alt={footer.siteName || "logo"} width={105} height={50} /> : <Typography variant="h6" sx={{ fontWeight: 700, color: "primary.main" }}>{footer.siteName || "Alphabeta Store"}</Typography>}
          </Link>

          <Typography variant="body1" sx={{
          mt: 1,
          mb: 3,
          maxWidth: 370,
          color: "white",
          lineHeight: 1.7
        }}>
            {footer.description}
          </Typography>

          <FooterApps playStoreUrl={footer.playStoreUrl} appleStoreUrl={footer.appStoreUrl} />
        </Footer1.Brand>

        <Footer1.Widget1>
          <FooterLinksWidget title={footer.aboutTitle} links={footer.about} />
        </Footer1.Widget1>

        <Footer1.Widget2>
          <FooterLinksWidget title={footer.customersTitle} links={footer.customers} />
        </Footer1.Widget2>

        <Footer1.Contact>
          <FooterContact title={footer.contact.title} emailLabel={footer.contact.emailLabel} phoneLabel={footer.contact.phoneLabel} phone={footer.contact.phone} email={footer.contact.email} address={footer.contact.address} />

          <FooterSocialLinks links={footer.socials} />
        </Footer1.Contact>

        <Footer1.Copyright>
          <Divider sx={{
          borderColor: "grey.800"
        }} />

          <Typography variant="body2" sx={{
          py: 3,
          textAlign: "center",
          span: {
            fontWeight: 500
          }
        }}>
            &copy; Copyright {new Date().getFullYear()} <span>Alphabeta Store</span>, {footer.copyright}
          </Typography>
        </Footer1.Copyright>
      </Footer1>
    </Fragment>;
}
