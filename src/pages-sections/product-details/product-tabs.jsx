"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Download from "@mui/icons-material/Download";
import { styled } from "@mui/material/styles";

const StyledTabs = styled(Tabs)(({ theme }) => ({
  minHeight: 0,
  marginTop: 48,
  marginBottom: 24,
  borderBottom: `1px solid ${theme.palette.divider}`,
  "& .inner-tab": { minHeight: 44, fontWeight: 700, textTransform: "none" },
  [theme.breakpoints.down("sm")]: { marginTop: 32 }
}));

function hasContent(value) {
  return typeof value === "string" && value.trim() !== "" && value.trim() !== "-";
}

function isSafeDocumentUrl(url) {
  return typeof url === "string" && /^(https?:\/\/|\/)(?!\/)/i.test(url.trim());
}

function SpecValue({ value }) {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (Array.isArray(value)) {
    return <Stack component="span" spacing={0.5}>{value.map((item, index) => <SpecValue key={index} value={item} />)}</Stack>;
  }
  if (typeof value === "object") {
    return (
      <Stack component="span" spacing={0.5}>
        {Object.entries(value).filter(([, nested]) => nested != null && nested !== "").map(([key, nested]) => (
          <Typography component="span" variant="body2" key={key}>
            <strong>{key}:</strong> <SpecValue value={nested} />
          </Typography>
        ))}
      </Stack>
    );
  }
  return String(value);
}

function SpecsTable({ specs }) {
  const rows = Object.entries(specs || {}).filter(([, value]) => value != null && value !== "");
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small" aria-label="مواصفات المنتج">
        <TableBody>
          {rows.map(([key, value]) => (
            <TableRow key={key} hover>
              <TableCell component="th" scope="row" sx={{ fontWeight: 700, width: { xs: "42%", md: "30%" }, color: "text.secondary" }}>
                {key}
              </TableCell>
              <TableCell sx={{ wordBreak: "break-word" }}><SpecValue value={value} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function Highlights({ highlights }) {
  return (
    <List disablePadding sx={{ listStyle: "disc", pr: 2.5 }}>
      {highlights.map((item, index) => (
        <ListItem key={index} sx={{ display: "list-item", py: 0.35 }}>
          <ListItemText primary={item} primaryTypographyProps={{ variant: "body1", lineHeight: 1.8 }} />
        </ListItem>
      ))}
    </List>
  );
}

function SupportInfo({ warrantyText, datasheetUrl }) {
  return (
    <Stack spacing={2} alignItems="flex-start">
      {hasContent(warrantyText) ? (
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>الضمان</Typography>
          <Typography color="text.secondary">{warrantyText}</Typography>
        </Box>
      ) : null}
      {isSafeDocumentUrl(datasheetUrl) ? (
        <Button component={Link} href={datasheetUrl} target="_blank" rel="noopener noreferrer" variant="outlined" startIcon={<Download />}>
          تحميل ورقة المواصفات
        </Button>
      ) : null}
    </Stack>
  );
}

export default function ProductTabs({
  reviews,
  description,
  descriptionText,
  qna,
  reviewCount = 0,
  specs = null,
  highlights = null,
  warrantyText = null,
  datasheetUrl = null
}) {
  const tabs = useMemo(() => {
    const items = [];
    if (Array.isArray(highlights) && highlights.some(hasContent)) {
      items.push({ label: "نظرة عامة", panel: <Highlights highlights={highlights.filter(hasContent)} /> });
    }
    if (specs && typeof specs === "object" && !Array.isArray(specs) && Object.keys(specs).length > 0) {
      items.push({ label: "المواصفات", panel: <SpecsTable specs={specs} /> });
    }
    if (hasContent(descriptionText)) items.push({ label: "الوصف", panel: description });
    if (hasContent(warrantyText) || isSafeDocumentUrl(datasheetUrl)) {
      items.push({ label: "الضمان والملفات", panel: <SupportInfo warrantyText={warrantyText} datasheetUrl={datasheetUrl} /> });
    }
    items.push({ label: `التقييمات (${reviewCount})`, panel: reviews });
    items.push({ label: "الأسئلة والأجوبة", panel: qna });
    return items;
  }, [datasheetUrl, description, descriptionText, highlights, qna, reviewCount, reviews, specs, warrantyText]);
  const [selectedOption, setSelectedOption] = useState(0);

  useEffect(() => {
    if (selectedOption >= tabs.length) setSelectedOption(0);
  }, [selectedOption, tabs.length]);

  return (
    <Fragment>
      <StyledTabs
        textColor="primary"
        value={selectedOption}
        indicatorColor="primary"
        onChange={(_, value) => setSelectedOption(value)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
      >
        {tabs.map(item => <Tab key={item.label} className="inner-tab" label={item.label} />)}
      </StyledTabs>
      <Box sx={{ minHeight: 120 }}>{tabs[selectedOption]?.panel}</Box>
    </Fragment>
  );
}
