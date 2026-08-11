import Image from "next/image";
import Link from "next/link";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Rating from "@mui/material/Rating";
import Avatar from "@mui/material/Avatar";
import AvatarGroup from "@mui/material/AvatarGroup";
import { ContentWrapper, ImageGroup, ImageWrapper, HeroSection, StatsContainer, TrustIndicators, GradientText, PulseButton } from "./styles";
export default function Section1() {
  return <HeroSection>
      <Container maxWidth="lg">
        <ContentWrapper>
          <Box maxWidth={580}>
            {/* Trust Indicator Badge */}
            <TrustIndicators>
              <Chip label="🔥 Trusted by 1,900+ developers" variant="filled" sx={{
              fontWeight: 600,
              color: "primary.main",
              bgcolor: "rgba(25, 118, 210, 0.1)",
              animation: "fadeInUp 0.6s ease-out"
            }} />
            </TrustIndicators>

            <GradientText variant="h1" fontSize={{
            xs: 36,
            sm: 42,
            md: 48
          }} lineHeight={1.2} fontWeight={800} sx={{
            mb: 3
          }}>
              Build Stunning <span>eCommerce</span> Stores with Alphabeta Store
            </GradientText>

            <Typography variant="h5" color="text.secondary" fontSize={{
            xs: 18,
            md: 20
          }} lineHeight={1.6} sx={{
            mt: 2,
            mb: 4,
            maxWidth: 550
          }}>
              The most complete Next.js eCommerce template with 30+ ready-to-use pages, TypeScript
              support, and modern design patterns that convert visitors into customers.
            </Typography>

            {/* Social Proof */}
            <Box mb={4}>
              <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                <AvatarGroup max={4} sx={{
                "& .MuiAvatar-root": {
                  width: 32,
                  height: 32,
                  fontSize: 14
                }
              }}>
                  <Avatar src="/assets/images/faces/face-1.jpg" />
                  <Avatar src="/assets/images/faces/face-2.jpg" />
                  <Avatar src="/assets/images/faces/face-3.jpg" />
                  <Avatar src="/assets/images/faces/face-4.jpg" />
                </AvatarGroup>
                <Typography variant="body2" color="text.secondary">
                  Join 1,000+ happy developers
                </Typography>
              </Stack>

              <Stack direction="row" spacing={2} alignItems="center">
                <Rating value={4.5} precision={0.1} readOnly size="small" />
                <Typography variant="body2" fontWeight={600}>
                  4.5/5 (19 reviews)
                </Typography>
              </Stack>
            </Box>

            <Stack direction={{
            xs: "column",
            sm: "row"
          }} spacing={2} mb={4}>
              <Link href="/">
                <PulseButton fullWidth disableElevation size="large" color="primary" variant="contained" sx={{
                px: 4,
                py: 1.5,
                fontSize: "1.1rem",
                fontWeight: 600,
                borderRadius: 3,
                textTransform: "none"
              }}>
                  🚀 Get Alphabeta Store Pro
                </PulseButton>
              </Link>

              <Button href="#demos" variant="outlined" size="large" sx={{
              px: 4,
              py: 1.5,
              fontSize: "1.1rem",
              fontWeight: 600,
              borderRadius: 3,
              textTransform: "none",
              borderWidth: 2,
              "&:hover": {
                borderWidth: 2,
                transform: "translateY(-2px)",
                boxShadow: "0 8px 25px rgba(0,0,0,0.1)"
              }
            }}>
                View Live Demo
              </Button>
            </Stack>

            {/* Key Stats */}
            <StatsContainer>
              <div>
                <Typography variant="h4" fontWeight={700} color="primary.main">
                  75+
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  Ready Pages
                </Typography>
              </div>

              <div>
                <Typography variant="h4" fontWeight={700} color="primary.main">
                  100%
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  TypeScript
                </Typography>
              </div>

              <div>
                <Typography variant="h4" fontWeight={700} color="primary.main">
                  SEO
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  Optimized
                </Typography>
              </div>

              {/* <div>
                <Typography variant="h4" fontWeight={700} color="primary.main">
                  1.9k+
                </Typography>
                 <Typography variant="body2" color="text.secondary">
                  Downloads
                </Typography>
               </div> */}
            </StatsContainer>
          </Box>

          <ImageGroup>
            <ImageWrapper>
              <Image priority width={800} height={417} src="/assets/images/landing/slide-1.jpg" alt="Market 1 Preview" />
            </ImageWrapper>

            <ImageWrapper sx={{
            marginTop: -10,
            marginRight: 10,
            zIndex: 1,
            opacity: 1
          }}>
              <Image priority width={800} height={417} src="/assets/images/landing/slide-2.jpg" alt="Gadget 1 Preview" />
            </ImageWrapper>

            <ImageWrapper sx={{
            marginTop: -10,
            marginRight: 2
          }}>
              <Image priority width={800} height={417} src="/assets/images/landing/slide-3.jpg" alt="Gadget 3 Preview" />
            </ImageWrapper>
          </ImageGroup>
        </ContentWrapper>
      </Container>
    </HeroSection>;
}
