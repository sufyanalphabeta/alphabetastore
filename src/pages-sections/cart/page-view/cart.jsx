"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";

// GLOBAL CUSTOM HOOK
import useCart from "hooks/useCart";

// CUSTOM COMPONENTS
import Trash from "icons/Trash";
import CartItem from "../cart-item";
import EmptyCart from "../empty-cart";
import CheckoutForm from "../checkout-form";
export default function CartPageView() {
  const { state, dispatch, ready, cartMessage } = useCart();

  if (!ready) {
    return (
      <Stack alignItems="center" justifyContent="center" py={8}>
        <CircularProgress
          color="info"
          sx={{
            mb: 2
          }}
        />
        <Typography variant="body2" color="text.secondary">
          Loading cart...
        </Typography>
      </Stack>
    );
  }

  if (state.cart.length === 0) {
    return <EmptyCart />;
  }
  return (
    <Grid container spacing={3}>
      {cartMessage ? (
        <Grid size={12}>
          <Alert severity="warning">{cartMessage}</Alert>
        </Grid>
      ) : null}
      <Grid
        size={{
          md: 8,
          xs: 12
        }}
      >
        {state.cart.map((item) => (
          <CartItem key={item.id} item={item} />
        ))}

        <Box textAlign="end">
          <Button
            disableElevation
            color="error"
            variant="outlined"
            startIcon={<Trash fontSize="small" />}
            onClick={() =>
              dispatch({
                type: "CLEAR_CART"
              })
            }
          >
            Clear Cart
          </Button>
        </Box>
      </Grid>

      <Grid
        size={{
          md: 4,
          xs: 12
        }}
      >
        <CheckoutForm />
      </Grid>
    </Grid>
  );
}
