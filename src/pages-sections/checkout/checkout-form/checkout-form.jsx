"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

// MUI
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

// GLOBAL CUSTOM COMPONENTS
import { FormProvider, TextField } from "components/form-hook";

// GLOBAL CUSTOM HOOK
import useCart from "hooks/useCart";
import { useAuth } from "contexts/AuthContext";
import { formatLibyaPhone, isValidLibyaPhone, LIBYA_PHONE_PREFIX, LIBYAN_CITIES, stripLibyaPhonePrefix } from "utils/libya";
import { createOrderPayment, fetchPaymentMethods } from "utils/payments";

// API
import { apiPost } from "utils/api";
import { fetchMyAddresses } from "utils/addresses";
import { purchaseQuantityErrorMessage } from "utils/purchase-quantity";

// STYLED COMPONENT
import { ButtonWrapper, CardRoot, FormWrapper } from "./styles";

export default function CheckoutForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { state, refreshCart, ready } = useCart();
  const [submitError, setSubmitError] = useState("");
  // Stable per-attempt idempotency key — regenerated only after a successful order.
  const idempotencyKeyRef = useRef(typeof crypto !== "undefined" ? crypto.randomUUID() : null);
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);
  const [paymentMethodsError, setPaymentMethodsError] = useState("");
  const [selectedPaymentCode, setSelectedPaymentCode] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState("manual");
  const cartItemsCount = state.cart.length;
  const initialValues = {
    fullName: "",
    phone: "",
    city: "",
    address: "",
    notes: ""
  };
  const validationSchema = yup.object().shape({
    fullName: yup.string().trim().required(t("validationNameRequired")),
    phone: yup
      .string()
      .required(t("validationPhoneRequired"))
      .test("libya-phone", t("validationPhoneInvalid"), value => isValidLibyaPhone(value || "")),
    city: yup.string().oneOf(LIBYAN_CITIES, t("validationCityInvalid")).required(t("validationCityRequired")),
    address: yup.string().trim().required(t("validationAddressRequired")),
    notes: yup.string().trim().optional()
  });

  const methods = useForm({
    defaultValues: initialValues,
    resolver: yupResolver(validationSchema)
  });

  const {
    handleSubmit,
    reset,
    formState: { isSubmitting }
  } = methods;

  useEffect(() => {
    let active = true;

    const loadPaymentMethods = async () => {
      setPaymentMethodsLoading(true);
      setPaymentMethodsError("");

      try {
        const nextMethods = await fetchPaymentMethods();

        if (!active) {
          return;
        }

        setPaymentMethods(nextMethods);
        setSelectedPaymentCode(current => current || nextMethods[0]?.code || "");
      } catch (error) {
        if (active) {
          setPaymentMethods([]);
          setPaymentMethodsError(error instanceof Error ? error.message : t("checkoutPaymentMethodsFailed"));
        }
      } finally {
        if (active) {
          setPaymentMethodsLoading(false);
        }
      }
    };

    loadPaymentMethods();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!isAuthenticated) {
      setAddresses([]);
      setSelectedAddressId("manual");
      return () => {
        active = false;
      };
    }

    const loadAddresses = async () => {
      setAddressesLoading(true);

      try {
        const nextAddresses = await fetchMyAddresses();
        if (!active) return;

        setAddresses(nextAddresses);

        const nextDefaultAddress = nextAddresses.find(item => item.isDefault) || nextAddresses[0] || null;

        if (nextDefaultAddress) {
          setSelectedAddressId(nextDefaultAddress.id);
          reset({
            fullName: nextDefaultAddress.fullName || "",
            phone: stripLibyaPhonePrefix(nextDefaultAddress.phone || ""),
            city: nextDefaultAddress.city || "",
            address: nextDefaultAddress.addressLine || "",
            notes: nextDefaultAddress.notes || ""
          });
        }
      } catch {
        if (active) {
          setAddresses([]);
        }
      } finally {
        if (active) {
          setAddressesLoading(false);
        }
      }
    };

    loadAddresses();

    return () => {
      active = false;
    };
  }, [isAuthenticated, reset]);

  const handleSelectAddress = event => {
    const nextAddressId = event.target.value;
    setSelectedAddressId(nextAddressId);

    if (nextAddressId === "manual") {
      return;
    }

    const selectedAddress = addresses.find(item => item.id === nextAddressId);

    if (!selectedAddress) {
      return;
    }

    reset({
      fullName: selectedAddress.fullName || "",
      phone: stripLibyaPhonePrefix(selectedAddress.phone || ""),
      city: selectedAddress.city || "",
      address: selectedAddress.addressLine || "",
      notes: selectedAddress.notes || ""
    });
  };

  const handleSubmitForm = handleSubmit(async values => {
    if (cartItemsCount === 0) {
      setSubmitError(t("checkoutCartEmpty"));
      return;
    }

    if (!selectedPaymentCode) {
      setSubmitError(t("checkoutSelectPaymentMethod"));
      return;
    }

    setSubmitError("");

    try {
      const order = await apiPost("/orders", {
        ...(isAuthenticated && selectedAddressId !== "manual"
          ? {
              addressId: selectedAddressId
            }
          : {}),
        fullName: values.fullName.trim(),
        phone: formatLibyaPhone(values.phone),
        city: values.city.trim(),
        address: values.address.trim(),
        notes: values.notes?.trim() || undefined,
        ...(idempotencyKeyRef.current ? { idempotencyKey: idempotencyKeyRef.current } : {})
      });

      const payment = await createOrderPayment(order.id, selectedPaymentCode);

      await refreshCart();
      // Rotate the key so a subsequent order (e.g. after cart refill) gets a fresh key.
      idempotencyKeyRef.current = typeof crypto !== "undefined" ? crypto.randomUUID() : null;

      const nextParams = new URLSearchParams({
        orderId: order.id,
        ...(order.orderNumber ? { orderNumber: order.orderNumber } : {}),
        paymentId: payment.id,
        paymentMethod: payment.paymentMethodCode
      });

      router.push(`/order-confirmation?${nextParams.toString()}`);
    } catch (error) {
      if (["OUT_OF_STOCK", "INSUFFICIENT_STOCK", "MAX_PURCHASE_QUANTITY_EXCEEDED", "CART_STOCK_CHANGED"].includes(error?.code)) {
        await refreshCart().catch(() => undefined);
        setSubmitError(purchaseQuantityErrorMessage(error, t("checkoutSubmitFailed")));
      } else {
        setSubmitError(error instanceof Error ? error.message : t("checkoutSubmitFailed"));
      }
    }
  });

  return (
    <FormProvider methods={methods} onSubmit={handleSubmitForm}>
      <CardRoot elevation={0}>
        <Typography
          variant="h5"
          sx={{
            mb: 2
          }}
        >
          {t("checkoutTitle")}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 3
          }}
        >
          {t("checkoutSubtitle")}
        </Typography>

        {submitError ? (
          <Alert
            severity="error"
            sx={{
              mb: 3
            }}
          >
            {submitError}
          </Alert>
        ) : null}

        {paymentMethodsError ? (
          <Alert
            severity="error"
            sx={{
              mb: 3
            }}
          >
            {paymentMethodsError}
          </Alert>
        ) : null}

        <TextField
          select
          fullWidth
          size="medium"
          label={t("checkoutPaymentMethod")}
          value={selectedPaymentCode}
          onChange={event => setSelectedPaymentCode(event.target.value)}
          disabled={paymentMethodsLoading || !paymentMethods.length}
          sx={{
            mb: 3
          }}
        >
          {paymentMethods.map(method => (
            <MenuItem key={method.id} value={method.code}>
              {method.name}
            </MenuItem>
          ))}
        </TextField>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 3
          }}
        >
          {selectedPaymentCode === "BANK_TRANSFER" ? t("checkoutBankTransferHint") : t("checkoutCodHint")}
        </Typography>

        {isAuthenticated ? (
          <>
            <TextField
              select
              fullWidth
              size="medium"
              label={t("checkoutSavedAddress")}
              value={selectedAddressId}
              onChange={handleSelectAddress}
              disabled={addressesLoading}
              sx={{
                mb: 3
              }}
            >
              <MenuItem value="manual">{t("checkoutManualAddress")}</MenuItem>
              {addresses.map(address => (
                <MenuItem value={address.id} key={address.id}>
                  {address.label}
                  {address.isDefault ? ` ${t("checkoutDefaultAddressSuffix")}` : ""}
                </MenuItem>
              ))}
            </TextField>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mb: 3
              }}
            >
              {addresses.length ? t("checkoutSavedAddressHint") : t("checkoutNoSavedAddressesHint")} <Link href="/address">{t("checkoutManageAddresses")}</Link>
            </Typography>
          </>
        ) : null}

        <FormWrapper>
          <TextField size="medium" fullWidth label={t("checkoutFullName")} name="fullName" />
          <TextField
            size="medium"
            fullWidth
            label={t("checkoutPhoneNumber")}
            name="phone"
            type="tel"
            helperText={t("checkoutPhoneHelper")}
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start">{LIBYA_PHONE_PREFIX}</InputAdornment>,
                inputProps: {
                  inputMode: "numeric",
                  maxLength: 9
                }
              }
            }}
          />
          <TextField select size="medium" fullWidth label={t("checkoutCity")} name="city">
            {LIBYAN_CITIES.map(city => (
              <MenuItem key={city} value={city}>
                {city}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="medium" fullWidth label={t("checkoutAddress")} name="address" />
          <TextField
            multiline
            rows={4}
            sx={{
              gridColumn: {
                sm: "1 / -1"
              }
            }}
            size="medium"
            fullWidth
            label={t("checkoutNotesOptional")}
            name="notes"
          />
        </FormWrapper>

        {!ready ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 3
            }}
          >
            {t("checkoutLoadingCart")}
          </Typography>
        ) : null}

        {addressesLoading ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 2
            }}
          >
            {t("checkoutLoadingAddresses")}
          </Typography>
        ) : null}

        {paymentMethodsLoading ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 2
            }}
          >
            {t("checkoutLoadingPayments")}
          </Typography>
        ) : null}
      </CardRoot>

      <ButtonWrapper>
        <Button size="large" fullWidth href="/cart" color="primary" variant="outlined" LinkComponent={Link}>
          {t("checkoutBackToCart")}
        </Button>

        <Button size="large" fullWidth type="submit" color="primary" variant="contained" disabled={!ready || cartItemsCount === 0 || isSubmitting || paymentMethodsLoading || !selectedPaymentCode}>
          {isSubmitting ? t("checkoutPlacingOrder") : t("checkoutPlaceOrder")}
        </Button>
      </ButtonWrapper>
    </FormProvider>
  );
}
