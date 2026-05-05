"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@mui/material/Avatar";

// MUI ICON COMPONENTS
import Edit from "@mui/icons-material/Edit";
import Delete from "@mui/icons-material/Delete";

// GLOBAL CUSTOM COMPONENT
import AppSwitch from "components/AppSwitch";
import { apiDelete, apiPatch } from "utils/api";

// STYLED COMPONENTS
import { StyledTableRow, CategoryWrapper, StyledTableCell, StyledIconButton } from "../styles";


// ========================================================================


// ========================================================================

export default function CategoryRow({
  category,
  onChanged,
  onDeleted
}) {
  const {
    name,
    level,
    isActive,
    isVisible,
    id,
    slug,
    parentName,
    sortOrder,
    icon
  } = category;
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState(Boolean(isActive));
  const [visibleCategory, setVisibleCategory] = useState(Boolean(isVisible ?? true));
  const [isDeleting, setIsDeleting] = useState(false);

  const handleToggleActive = async () => {
    const nextValue = !activeCategory;

    setActiveCategory(nextValue);

    try {
      await apiPatch(`/categories/${id}`, {
        isActive: nextValue
      });

      onChanged?.();
      router.refresh();
    } catch (error) {
      setActiveCategory(!nextValue);
      window.alert(error instanceof Error ? error.message : "Failed to update category");
    }
  };

  const handleToggleVisible = async () => {
    const nextValue = !visibleCategory;

    setVisibleCategory(nextValue);

    try {
      await apiPatch(`/categories/${id}`, {
        isVisible: nextValue
      });

      onChanged?.();
      router.refresh();
    } catch (error) {
      setVisibleCategory(!nextValue);
      window.alert(error instanceof Error ? error.message : "Failed to update category visibility");
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;

    const confirmed = window.confirm(`Delete category "${name}"?`);

    if (!confirmed) return;

    setIsDeleting(true);

    try {
      await apiDelete(`/categories/${id}`);

      onDeleted?.(id);
      onChanged?.();
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to delete category");
    } finally {
      setIsDeleting(false);
    }
  };

  return <StyledTableRow tabIndex={-1} role="checkbox">
      <StyledTableCell align="left">#{id.split("-")[0]}</StyledTableCell>

      <StyledTableCell align="left">
        <CategoryWrapper>{name}</CategoryWrapper>
      </StyledTableCell>

      <StyledTableCell align="left">
        <Avatar variant="rounded" sx={{ fontSize: "0.75rem", bgcolor: "primary.light" }}>
          {icon ? <span style={{ fontSize: "1rem" }}>{icon.charAt(0).toUpperCase()}</span> : name?.charAt(0)?.toUpperCase() || "C"}
        </Avatar>
      </StyledTableCell>

      <StyledTableCell align="left">{level ? parentName : "Root"}</StyledTableCell>

      <StyledTableCell align="center">{sortOrder ?? 0}</StyledTableCell>

      <StyledTableCell align="left">
        <AppSwitch color="info" checked={activeCategory} onChange={handleToggleActive} />
      </StyledTableCell>

      <StyledTableCell align="left">
        <AppSwitch color="success" checked={visibleCategory} onChange={handleToggleVisible} />
      </StyledTableCell>

      <StyledTableCell align="center">
        <Link href={`/admin/categories/${slug}`}>
          <StyledIconButton>
            <Edit />
          </StyledIconButton>
        </Link>

        <StyledIconButton onClick={handleDelete} disabled={isDeleting}>
          <Delete />
        </StyledIconButton>
      </StyledTableCell>
    </StyledTableRow>;
}
