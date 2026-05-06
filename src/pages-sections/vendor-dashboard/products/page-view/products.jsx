"use client";

import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";

import { getComparator, stableSort } from "hooks/useMuiTable";
import PageWrapper from "../../page-wrapper";
import { currency } from "lib";
import { ACTIVE_STATUS, ALL_PRODUCT_STATUS, INACTIVE_STATUS, deleteAdminProduct, fetchAdminProducts, mapAdminProduct, updateAdminProductStatus } from "utils/admin-catalog";

const PAGE_SIZE = 10;

const TABLE_COLUMNS = [{
  id: "name",
  label: "Name",
  align: "left"
}, {
  id: "categoryName",
  label: "Category",
  align: "left"
}, {
  id: "price",
  label: "Price",
  align: "left"
}, {
  id: "status",
  label: "Status",
  align: "left"
}, {
  id: "action",
  label: "Action",
  align: "center"
}];

function getStatusColor(isActive) {
  return isActive ? "success" : "default";
}

export default function ProductsPageView(props) {
  return (
    <Suspense fallback={null}>
      <ProductsContent {...props} />
    </Suspense>
  );
}

function ProductsContent({
  products: initialProducts = []
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchTerm = searchParams.get("q")?.trim() || "";
  const currentPage = Math.max(Number(searchParams.get("page") || 1), 1);
  const statusFilter = searchParams.get("status") || ALL_PRODUCT_STATUS;
  const [products, setProducts] = useState(Array.isArray(initialProducts) ? initialProducts : []);
  const [pagination, setPagination] = useState({
    page: currentPage,
    limit: PAGE_SIZE,
    total: Array.isArray(initialProducts) ? initialProducts.length : 0,
    totalPages: 1
  });
  const [isLoading, setIsLoading] = useState(!initialProducts?.length);
  const [pageError, setPageError] = useState("");
  const [order, setOrder] = useState("asc");
  const [orderBy, setOrderBy] = useState("name");
  const [searchInput, setSearchInput] = useState(searchTerm);

  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setPageError("");

    try {
      const response = await fetchAdminProducts({
        q: searchTerm,
        status: statusFilter,
        page: currentPage,
        limit: PAGE_SIZE
      });

      setProducts(Array.isArray(response?.items) ? response.items : []);
      setPagination(response?.pagination || {
        page: currentPage,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 1
      });
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to load products");
      setProducts([]);
      setPagination({
        page: currentPage,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 1
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchTerm, statusFilter]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredProducts = useMemo(() => stableSort(products.map(mapAdminProduct), getComparator(order, orderBy)), [order, orderBy, products]);

  const handleRequestSort = property => {
    if (property === "action") {
      return;
    }

    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleChangePage = (_, nextPage) => {
    const params = new URLSearchParams(searchParams);

    if (nextPage <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(nextPage));
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  const handleStatusChange = event => {
    const params = new URLSearchParams(searchParams);
    const nextStatus = event.target.value;

    params.delete("page");

    if (nextStatus === ALL_PRODUCT_STATUS) {
      params.delete("status");
    } else {
      params.set("status", nextStatus);
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  const handleSearchChange = event => {
    const nextValue = event.target.value;
    setSearchInput(nextValue);

    const params = new URLSearchParams(searchParams.toString());
    const normalizedQuery = nextValue.trim();

    params.delete("page");

    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    } else {
      params.delete("q");
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  const handleToggleActive = async product => {
    const nextValue = !product.isActive;

    setProducts(current => current.map(item => item.id === product.id ? {
      ...item,
      status: nextValue ? ACTIVE_STATUS : INACTIVE_STATUS
    } : item));

    try {
      await updateAdminProductStatus(product.id, nextValue);
      await loadProducts();
    } catch (error) {
      setProducts(current => current.map(item => item.id === product.id ? {
        ...item,
        status: product.status
      } : item));
      window.alert(error instanceof Error ? error.message : "Failed to update product status");
    }
  };

  const handleDelete = async product => {
    const confirmed = window.confirm(`Delete product \"${product.name}\"?`);

    if (!confirmed) {
      return;
    }

    try {
      await deleteAdminProduct(product.id);
      setProducts(current => current.filter(item => item.id !== product.id));
      setPagination(current => ({
        ...current,
        total: Math.max(0, current.total - 1)
      }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to delete product");
    }
  };

  return <PageWrapper title="Product List">
      <Stack direction={{
      xs: "column",
      md: "row"
    }} spacing={2} mb={3} alignItems={{
      xs: "stretch",
      md: "center"
    }} justifyContent="space-between">
        <Stack direction={{
        xs: "column",
        sm: "row"
      }} spacing={2} flex={1}>
          <TextField fullWidth placeholder="Search Product..." value={searchInput} onChange={handleSearchChange} />

          <TextField select size="medium" label="Status" value={statusFilter} onChange={handleStatusChange} sx={{
          minWidth: 180
        }}>
            <MenuItem value={ALL_PRODUCT_STATUS}>All statuses</MenuItem>
            <MenuItem value={ACTIVE_STATUS}>Active</MenuItem>
            <MenuItem value={INACTIVE_STATUS}>Inactive</MenuItem>
          </TextField>
        </Stack>

        <Button component={Link} href="/admin/products/create" variant="contained" color="primary" sx={{
        alignSelf: {
          xs: "stretch",
          md: "center"
        },
        minWidth: 160
      }}>
          Add Product
        </Button>
      </Stack>

      {pageError ? <Alert severity="error" sx={{
      mb: 3
    }}>{pageError}</Alert> : null}

      <Card>
        <TableContainer sx={{
        minWidth: 900
      }}>
          <Table>
            <TableHead>
              <TableRow sx={{
              backgroundColor: "grey.50"
            }}>
                {TABLE_COLUMNS.map(column => <TableCell key={column.id} align={column.align} sx={{
              fontWeight: 600
            }}>
                    {column.id === "action" ? column.label : <button type="button" onClick={() => handleRequestSort(column.id)} style={{
                background: "none",
                border: 0,
                cursor: "pointer",
                font: "inherit",
                fontWeight: 600,
                padding: 0,
                color: "inherit"
              }}>
                        {column.label}
                      </button>}
                  </TableCell>)}
              </TableRow>
            </TableHead>

            <TableBody>
              {isLoading ? <TableRow>
                  <TableCell colSpan={5}>
                    <Stack alignItems="center" justifyContent="center" py={6}>
                      <CircularProgress color="info" />
                    </Stack>
                  </TableCell>
                </TableRow> : filteredProducts.length ? filteredProducts.map(product => {
              const statusLabel = product.isActive ? "Active" : product.status || "Inactive";

              return <TableRow key={product.id} hover>
                      <TableCell align="left">
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar variant="rounded">
                            <Box component="img" src={product.image} alt={product.name} sx={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover"
                    }} />
                          </Avatar>

                          <Box>
                            <Typography variant="h6">{product.name}</Typography>
                            <Typography variant="body2" color="text.secondary">#{String(product.id).split("-")[0]}</Typography>
                          </Box>
                        </Stack>
                      </TableCell>

                      <TableCell align="left">{product.categoryName}</TableCell>
                      <TableCell align="left">{currency(product.price)}</TableCell>
                      <TableCell align="left">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Switch color="info" checked={Boolean(product.isActive)} onChange={() => handleToggleActive(product)} />
                          <Chip size="small" label={statusLabel} color={getStatusColor(Boolean(product.isActive))} variant="outlined" />
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        {product.editHref ? <IconButton component={Link} href={product.editHref} size="small" color="info">
                            <Edit fontSize="small" />
                          </IconButton> : <IconButton size="small" disabled>
                            <Edit fontSize="small" />
                          </IconButton>}
                        <IconButton size="small" color="error" onClick={() => handleDelete(product)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>;
            }) : <TableRow>
                  <TableCell colSpan={5}>
                    <Stack alignItems="center" justifyContent="center" py={6}>
                      <Typography color="text.secondary">No products found for the current filters.</Typography>
                    </Stack>
                  </TableCell>
                </TableRow>}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack alignItems="center" my={4}>
          <Pagination color="primary" onChange={handleChangePage} page={pagination.page} count={Math.max(1, Number(pagination.totalPages || 1))} />
        </Stack>
      </Card>
    </PageWrapper>;
}