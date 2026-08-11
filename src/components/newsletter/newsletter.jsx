"use client";

import { useCallback, useEffect, useState } from "react";
import debounce from "lodash/debounce";

// MUI
import Grid from "@mui/material/Grid";
import Modal from "@mui/material/Modal";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import ClickAwayListener from "@mui/material/ClickAwayListener";

// MUI ICON COMPONENTS
import Clear from "@mui/icons-material/Clear";

// LOCAL CUSTOM COMPONENT
import SocialIcons from "./social-icons";

// STYLED COMPONENTS
import { Wrapper } from "./styles";


// ======================================================


// ======================================================

export default function Newsletter({
  image = "/assets/images/newsletter/bg-1.png"
}) {
  const [open, setOpen] = useState(false);
  const handleClose = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.sessionStorage.getItem("newsletter")) {
      debounce(() => {
        setOpen(true);
        window.sessionStorage.setItem("newsletter", "true");
      }, 2000)();
    }
  }, []);
  return <ClickAwayListener onClickAway={handleClose}>
      <Modal open={open} onClose={handleClose} aria-labelledby="Newsletter Modal" sx={{
      zIndex: 999999999
    }}>
        <Wrapper img={image}>
          <Grid container spacing={2}>
            <Grid size={{
            md: 6,
            xs: 12
          }} display={{
            md: "flex",
            xs: "none"
          }} />

            <Grid size={{
            md: 6,
            xs: 12
          }} alignItems="center">
              <div className="content">
                <Typography variant="body1" className="discount" sx={{
                fontSize: 22,
                fontWeight: 600,
                span: {
                  color: "primary.main"
                }
              }}>
                  UP TO <span>30% OFF</span>
                </Typography>

                <Typography variant="h1" sx={{
                mb: 2,
                fontSize: 36,
                fontWeight: 600,
                span: {
                  color: "primary.main"
                }
              }}>
                  Sign up to <span>ALPHABETA STORE</span>
                </Typography>

                <Typography variant="body1" sx={{
                color: "grey.600",
                mb: 5
              }}>
                  Subscribe to the ALPHABETA STORE newsletter to receive timely updates from your
                  favorite products.
                </Typography>

                <TextField fullWidth className="emailInput" placeholder="Enter your email address" />

                <Button variant="contained" fullWidth color="primary" sx={{
                p: 1.5
              }}>
                  SUBMIT
                </Button>

                <SocialIcons />

                <FormControlLabel control={<Checkbox defaultChecked />} label="No, Thanks" />
              </div>
            </Grid>
          </Grid>

          <IconButton onClick={handleClose} className="clear-btn">
            <Clear color="inherit" />
          </IconButton>
        </Wrapper>
      </Modal>
    </ClickAwayListener>;
}
