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
  reviewCount = 0,
  specs = null
}) {
  const [selectedOption, setSelectedOption] = useState(0);
  const handleChangeTab = (_, value) => setSelectedOption(value);

  const hasSpecs = specs && typeof specs === "object" && Object.keys(specs).length > 0;

  return <Fragment>
      <StyledTabs textColor="primary" value={selectedOption} indicatorColor="primary" onChange={handleChangeTab}>
        <Tab className="inner-tab" label="Description" />
        {hasSpecs && <Tab className="inner-tab" label="Specifications" />}
        <Tab className="inner-tab" label={`Review (${reviewCount})`} />
      </StyledTabs>

      <div className="mb-3">
        {selectedOption === 0 && description}
        {hasSpecs && selectedOption === 1 && <SpecsTable specs={specs} />}
        {selectedOption === (hasSpecs ? 2 : 1) && reviews}
      </div>
    </Fragment>;
}