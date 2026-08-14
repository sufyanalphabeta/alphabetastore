"use client";

import SvgIcon from "@mui/material/SvgIcon";
import Typography from "@mui/material/Typography";

// GLOBAL CUSTOM COMPONENTS
import { CategoryMenu } from "components/categories";

// CUSTOM ICON COMPONENT
import ChevronRight from "icons/ChevronRight";

// STYLED COMPONENT
import { CategoryMenuButton } from "./styles";
import useSettings from "hooks/useSettings";
export default function CategoryDropdown({
  children
}) {
  const { settings } = useSettings();
  const isArabic = settings.default_language !== "en";
  return <CategoryMenu render={handler => <CategoryMenuButton onClick={handler}>
          <div className="prefix">
            <SvgIcon fontSize="small" className="icon">
              <svg viewBox="0 0 24 24">
                <path fill="currentColor" d="M3 4h18v2H3zm0 7h18v2H3zm0 7h18v2H3z" />
              </svg>
            </SvgIcon>

            <Typography variant="h6">{isArabic ? "جميع الفئات" : "All categories"}</Typography>
          </div>

          <ChevronRight className="dropdown-icon" fontSize="small" />
        </CategoryMenuButton>}>
      {children}
    </CategoryMenu>;
}
