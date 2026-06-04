"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
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
import { deleteBrand, fetchBrands, reorderBrands, updateBrand } from "utils/admin-brands";

export default function BrandsAdminPageView() {
  const router = useRouter();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchBrands();
      setBrands(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load brands");
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? brands.filter(b =>
          [b.name, b.slug].some(v => String(v || "").toLowerCase().includes(q))
        )
      : brands;
    return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  }, [brands, search]);

  const togglePatch = async (brand, patch) => {
    setBusyId(brand.id);
    try {
      const updated = await updateBrand(brand.id, patch);
      setBrands(curr => curr.map(item => (item.id === brand.id ? { ...item, ...updated } : item)));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed to update brand");
    } finally {
      setBusyId("");
    }
  };

  const onDelete = async brand => {
    if (busyId) return;
    if (!window.confirm(`Delete brand "${brand.name}"?`)) return;
    setBusyId(brand.id);
    try {
      await deleteBrand(brand.id);
      setBrands(curr => curr.filter(item => item.id !== brand.id));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed to delete brand");
    } finally {
      setBusyId("");
    }
  };

  const move = async (brand, direction) => {
    const idx = filtered.findIndex(b => b.id === brand.id);
    const swap = filtered[idx + direction];
    if (!swap) return;
    setBusyId(brand.id);
    try {
      await reorderBrands([
        { id: brand.id, sortOrder: swap.sortOrder ?? 0 },
        { id: swap.id, sortOrder: brand.sortOrder ?? 0 }
      ]);
      await load();
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed to reorder");
    } finally {
      setBusyId("");
    }
  };

  return (
    <PageWrapper title="Brands">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} gap={2} flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Search brand…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ minWidth: 280 }}
        />
        <Button component={Link} href="/admin/brands/create" variant="contained" startIcon={<Add />}>
          Add Brand
        </Button>
      </Stack>

      <Card>
        {error ? (
          <Box p={2}>
            <Alert severity="error">{error}</Alert>
          </Box>
        ) : null}

        {loading ? (
          <Box display="flex" justifyContent="center" p={6}>
            <CircularProgress color="info" />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Logo</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Slug</TableCell>
                  <TableCell align="center">Products</TableCell>
                  <TableCell align="center">Sort</TableCell>
                  <TableCell align="center">Visible</TableCell>
                  <TableCell align="center">Featured</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>
                      No brands yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((brand, idx) => (
                    <TableRow key={brand.id} hover>
                      <TableCell>
                        <Avatar
                          variant="rounded"
                          src={brand.logoUrl || undefined}
                          alt={brand.name}
                          sx={{ width: 40, height: 40, bgcolor: "primary.light" }}
                        >
                          {brand.name?.charAt(0)?.toUpperCase()}
                        </Avatar>
                      </TableCell>
                      <TableCell>{brand.name}</TableCell>
                      <TableCell sx={{ color: "text.secondary" }}>{brand.slug}</TableCell>
                      <TableCell align="center">{brand.productCount}</TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                          <IconButton size="small" onClick={() => move(brand, -1)} disabled={idx === 0 || busyId === brand.id}>
                            ▲
                          </IconButton>
                          <Box minWidth={24}>{brand.sortOrder ?? 0}</Box>
                          <IconButton
                            size="small"
                            onClick={() => move(brand, 1)}
                            disabled={idx === filtered.length - 1 || busyId === brand.id}
                          >
                            ▼
                          </IconButton>
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        <Switch
                          color="info"
                          checked={brand.isVisible}
                          onChange={() => togglePatch(brand, { isVisible: !brand.isVisible })}
                          disabled={busyId === brand.id}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          onClick={() => togglePatch(brand, { isFeatured: !brand.isFeatured })}
                          disabled={busyId === brand.id}
                          color={brand.isFeatured ? "warning" : "default"}
                        >
                          {brand.isFeatured ? <StarIcon /> : <StarBorderIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton component={Link} href={`/admin/brands/${brand.slug}`}>
                          <Edit />
                        </IconButton>
                        <IconButton onClick={() => onDelete(brand)} disabled={busyId === brand.id} color="error">
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </PageWrapper>
  );
}
