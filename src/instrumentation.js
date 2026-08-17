// Optional Sentry initialization for the frontend.
//
// Sentry is loaded only when:
//   - the `@sentry/nextjs` package is installed, AND
//   - the NEXT_PUBLIC_SENTRY_DSN env var is set.
//
// Otherwise this is a no-op so missing config / missing package never breaks
// the build or runtime.
//
// To enable:
//   1. npm install @sentry/nextjs
//   2. Set NEXT_PUBLIC_SENTRY_DSN, optionally SENTRY_ENVIRONMENT and
//      SENTRY_TRACES_SAMPLE_RATE (default 0.1).

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  let Sentry;
  try {
    // Use an indirect dynamic import so Sentry remains an optional dependency.
    Sentry = await importOptional('@sentry/nextjs');
  } catch {
    // Package not installed — silently skip.
    return;
  }

  const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1');

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
    sendDefaultPii: false,
  });
}

export async function onRequestError(err, request, errorContext) {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  try {
    const Sentry = await importOptional('@sentry/nextjs');
    if (!Sentry) return;
    if (typeof Sentry.captureRequestError === 'function') {
      Sentry.captureRequestError(err, request, errorContext);
    } else {
      Sentry.captureException(err);
    }
  } catch {
    // ignore
  }
}

async function importOptional(moduleName) {
  try {
    return await new Function('name', 'return import(name)')(moduleName);
  } catch {
    return null;
  }
}
