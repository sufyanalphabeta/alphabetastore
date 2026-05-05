import Link from "next/link";
import Image from "next/image";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";

// LOCAL CUSTOM COMPONENTS
import Discount from "./discount";
import HoverActions from "./hover-actions";

// STYLED COMPONENTS
import { ImageWrapper, ContentWrapper, StyledCard } from "./styles";

// CUSTOM UTILS FUNCTION
import { currency } from "lib";


// ========================================================


// ========================================================

export default function ProductCard17({
  product,
  bgWhite = false
}) {
  const {
    slug,
    title,
    price,
    thumbnail,
    images,
    discount,
    categories,
    brand
  } = product;
  return <StyledCard elevation={0} bgWhite={bgWhite}>
      <ImageWrapper>
        <Discount discount={discount} />
        <HoverActions product={product} />

        <Link href={`/products/${slug}`} aria-label={`View ${title}`}>
          <Image width={750} height={750} src={thumbnail} alt={`Thumbnail for ${title}`} className={images.length > 1 ? "thumbnail" : ""} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" loading={images.length > 1 ? "lazy" : "eager"} />

          {images.length > 1 && <Image width={750} height={750} src={images[1]} loading="lazy" className="hover-thumbnail" alt={`Hover thumbnail for ${title}`} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />}
        </Link>
      </ImageWrapper>

      <ContentWrapper>
        <Box display="flex" alignItems="center" justifyContent="center" gap={0.75} flexWrap="wrap" mb={0.5}>
          <Typography noWrap variant="body2" className="category">
            {categories.length > 0 ? categories[0] : "N/A"}
          </Typography>
          {brand && (
            <Chip label={brand} size="small" variant="outlined" color="primary" sx={{ height: 18, fontSize: 11, fontWeight: 600 }} />
          )}
        </Box>

        <Link href={`/products/${slug}`} aria-label={`View ${title}`}>
          <Typography noWrap variant="h5" className="title">
            {title}
          </Typography>
        </Link>

        <Typography variant="subtitle1" color="primary" fontWeight={600}>
          {currency(price)}
        </Typography>
      </ContentWrapper>
    </StyledCard>;
}