"use client";

import { Fragment, useState } from "react";

// MUI
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { styled } from "@mui/material/styles";


// STYLED COMPONENT
const StyledTabs = styled(Tabs)(({
  theme
}) => ({
  minHeight: 0,
  marginTop: 80,
  marginBottom: 24,
  borderBottom: `1px solid ${theme.palette.divider}`,
  "& .inner-tab": {
    minHeight: 40,
    fontWeight: 500,
    textTransform: "capitalize"
  }
}));


// ==============================================================


// ==============================================================

function SpecsTable({ specs }) {
  if (!specs || typeof specs !== "object" || !Object.keys(specs).length) {
    return <Typography color="text.secondary">No specifications available.</Typography>;
  }

  return <Table size="small">
    <TableBody>
      {Object.entries(specs).map(([key, value]) => (
        <TableRow key={key} hover>
          <TableCell sx={{ fontWeight: 600, width: "35%", color: "text.secondary" }}>{key}</TableCell>
          <TableCell>{String(value)}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>;
}


export default function ProductTabs({
  reviews,
  description,
  qna,
  reviewCount = 0,
  specs = null
}) {
  const [selectedOption, setSelectedOption] = useState(0);
  const handleChangeTab = (_, value) => setSelectedOption(value);

  const hasSpecs = specs && typeof specs === "object" && Object.keys(specs).length > 0;

  // Build tabs dynamically
  const tabs = ["Description"];
  if (hasSpecs) tabs.push("Specifications");
  tabs.push(`Reviews (${reviewCount})`);
  tabs.push("Q&A");

  const panels = [description];
  if (hasSpecs) panels.push(<SpecsTable specs={specs} />);
  panels.push(reviews);
  panels.push(qna);

  return <Fragment>
      <StyledTabs textColor="primary" value={selectedOption} indicatorColor="primary" onChange={handleChangeTab}>
        {tabs.map((label, i) => (
          <Tab key={i} className="inner-tab" label={label} />
        ))}
      </StyledTabs>

      <div className="mb-3">
        {panels[selectedOption]}
      </div>
    </Fragment>;
}