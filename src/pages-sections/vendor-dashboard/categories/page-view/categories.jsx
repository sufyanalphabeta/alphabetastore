"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import PageWrapper from "../../page-wrapper";
import { fetchCategories } from "utils/catalog";
import { apiDelete, apiPatch } from "utils/api";

const PAGE_SIZE = 10;

function mapCategoryRow(category) {
  return {
    id: category?.id || "",
    name: category?.name || "Untitled Category",
    slug: category?.slug || "",
    isActive: category?.isActive !== false,
    isVisible: category?.isVisible !== false,
    sortOrder: category?.sortOrder ?? 0,
    icon: category?.icon || "",
    parentName: category?.parent?.name || "Root"
  };
}

export default function CategoriesPageView({
  initialCategories = []
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPage = Math.max(Number(searchParams.get("page") || 1), 1);
  const searchTerm = searchParams.get("q")?.trim() || "";
  const [categories, setCategories] = useState(Array.isArray(initialCategories) ? initialCategories : []);
  const [isLoading, setIsLoading] = useState(!initialCategories?.length);
  const [pageError, setPageError] = useState("");
  const [searchInput, setSearchInput] = useState(searchTerm);
  const [busyCategoryId, setBusyCategoryId] = useState("");

  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setPageError("");

    try {
      const data = await fetchCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to load categories.");
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const filteredCategories = useMemo(() => {
    const normalizedQuery = searchTerm.toLowerCase();

    return categories
      .map(mapCategoryRow)
      .filter(category => {
        if (!normalizedQuery) {
          return true;
        }

        return [category.name, category.slug, category.parentName]
          .some(value => String(value || "").toLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => {
        const orderDiff = (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
        return orderDiff !== 0 ? orderDiff : left.name.localeCompare(right.name, "ar");
      });
  }, [categories, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const visibleCategories = filteredCategories.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updateQuery = useCallback((nextQuery, nextPage = 1) => {
    const params = new URLSearchParams(searchParams.toString());
    const normalizedQuery = nextQuery.trim();

    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    } else {
      params.delete("q");
    }

    if (nextPage > 1) {
      params.set("page", String(nextPage));
    } else {
      params.delete("page");
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }, [pathname, router, searchParams]);

  const handleSearchChange = event => {
    const nextValue = event.target.value;
    setSearchInput(nextValue);
    updateQuery(nextValue, 1);
  };

  const handlePageChange = (_, nextPage) => {
    updateQuery(searchInput, nextPage);
  };

  const handleToggleActive = async category => {
    const nextValue = !category.isActive;
    setBusyCategoryId(category.id);

    try {
      await apiPatch(`/categories/${category.id}`, {
        isActive: nextValue
      });

      setCategories(current => current.map(item => item.id === category.id ? {
        ...item,
        isActive: nextValue
      } : item));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to update category.");
    } finally {
      setBusyCategoryId("");
    }
  };

  const handleToggleVisible = async category => {
    const nextValue = !category.isVisible;
    setBusyCategoryId(category.id);

    try {
      await apiPatch(`/categories/${category.id}`, {
        isVisible: nextValue
      });

      setCategories(current => current.map(item => item.id === category.id ? {
        ...item,
        isVisible: nextValue
      } : item));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to update category visibility.");
    } finally {
      setBusyCategoryId("");
    }
  };

  const handleDelete = async category => {
    if (busyCategoryId) {
      return;
    }

    const confirmed = window.confirm(`Delete category "${category.name}"?`);

    if (!confirmed) {
      return;
    }

    setBusyCategoryId(category.id);

    try {
      await apiDelete(`/categories/${category.id}`);
      setCategories(current => current.filter(item => item.id !== category.id));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to delete category.");
    } finally {
      setBusyCategoryId("");
    }
  };

  return <PageWrapper title="Product Categories">
      <Stack direction={{
      xs: "column",
      sm: "row"
    }} spacing={2} mb={2}>
        <TextField fullWidth placeholder="Search Category..." value={searchInput} onChange={handleSearchChange} />

        <Button component={Link} href="/admin/categories/create" variant="contained" color="info" startIcon={<Add />} sx={{
        minWidth: 180
      }}>
          Add Category
        </Button>
      </Stack>

      {pageError ? <Alert severity="error" sx={{
      mb: 3
    }}>{pageError}</Alert> : null}

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{
              backgroundColor: "grey.50"
            }}>
                <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Slug</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Parent</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Order</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Active</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Visible</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Action</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {isLoading ? <TableRow>
                  <TableCell colSpan={8}>
                    <Stack alignItems="center" justifyContent="center" py={6}>
                      <CircularProgress color="info" />
                    </Stack>
                  </TableCell>
                </TableRow> : visibleCategories.length ? visibleCategories.map(category => <TableRow key={category.id} hover>
                    <TableCell>#{category.id.split("-")[0]}</TableCell>
                    <TableCell>{category.name}</TableCell>
                    <TableCell>{category.slug || "-"}</TableCell>
                    <TableCell>{category.parentName}</TableCell>
                    <TableCell align="center">{category.sortOrder ?? 0}</TableCell>
                    <TableCell>
                      <Switch checked={category.isActive} color="info" disabled={busyCategoryId === category.id} onChange={() => handleToggleActive(category)} />
                    </TableCell>
                    <TableCell>
                      <Switch checked={category.isVisible} color="success" disabled={busyCategoryId === category.id} onChange={() => handleToggleVisible(category)} />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton component={Link} href={`/admin/categories/${category.slug}`} color="info" disabled={!category.slug || Boolean(busyCategoryId)}>
                        <Edit fontSize="small" />
                      </IconButton>

                      <IconButton color="error" onClick={() => handleDelete(category)} disabled={busyCategoryId === category.id}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>) : <TableRow>
                  <TableCell colSpan={8}>
                    <Stack alignItems="center" justifyContent="center" py={6}>
                      <Typography color="text.secondary">No categories found for the current search.</Typography>
                    </Stack>
                  </TableCell>
                </TableRow>}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack alignItems="center" my={4}>
          <Pagination color="primary" page={page} count={totalPages} onChange={handlePageChange} />
        </Stack>
      </Card>
    </PageWrapper>;
}