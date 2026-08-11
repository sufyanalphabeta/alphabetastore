
// LOCAL CUSTOM COMPONENTS
import LogoWithTitle from "./components/logo-title";
import SocialButtons from "./components/social-buttons";

// GLOBAL CUSTOM COMPONENTS
import FlexRowCenter from "components/flex-box/flex-row-center";

// COMMON STYLED COMPONENT
import { Wrapper } from "./styles";


// ==============================================================


// ==============================================================

export default function AuthLayout({
  children,
  bottomContent
}) {
  return (
    <FlexRowCenter
      flexDirection="column"
      minHeight="100vh"
      px={2}
      sx={{
        background: "linear-gradient(135deg, #f0f4ff 0%, #fafafa 60%, #f5f5f5 100%)",
      }}
    >
      <Wrapper elevation={0}>
        <LogoWithTitle />

        {children}

        <SocialButtons />

        {/* RENDER BOTTOM CONTENT BASED ON CONDITION */}
        {bottomContent}
      </Wrapper>
    </FlexRowCenter>
  );
}