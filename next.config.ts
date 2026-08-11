import type { NextConfig } from "next";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:3001/api/v1";

type RemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

function buildUploadsPattern(urlString: string): RemotePattern | null {
  try {
    const url = new URL(urlString);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return {
      protocol: url.protocol === "https:" ? "https" : "http",
      hostname: url.hostname,
      port: url.port,
      pathname: "/uploads/**"
    };
  } catch {
    return null;
  }
}

const backendUploadsPattern = buildUploadsPattern(apiBaseUrl);

const staticRemotePatterns: RemotePattern[] = [
  {
    protocol: "https",
    hostname: "ui-lib.com"
  },
  {
    protocol: "https",
    hostname: "cloudflare-ipfs.com"
  },
  {
    protocol: "http",
    hostname: "localhost",
    port: "3001",
    pathname: "/uploads/**"
  },
  {
    protocol: "http",
    hostname: "127.0.0.1",
    port: "3001",
    pathname: "/uploads/**"
  }
];

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: staticRemotePatterns.concat(backendUploadsPattern ? [backendUploadsPattern] : [])
  },
  async headers() {
    return [
      {
        source: "/api/v1/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type,Authorization,X-Cart-Session-Id" },
          { key: "Access-Control-Allow-Credentials", value: "true" }
        ]
      }
    ];
  },
  async rewrites() {
    const internalApiUrl =
      process.env.INTERNAL_API_BASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
      "http://localhost:3001/api/v1";
    // Derive backend base URL (strip /api/v1 suffix)
    const backendBaseUrl = internalApiUrl.replace(/\/api\/v1$/, "");
    return [
      {
        source: "/api/v1/:path*",
        destination: `${internalApiUrl}/:path*`
      },
      {
        source: "/uploads/:path*",
        destination: `${backendBaseUrl}/uploads/:path*`
      }
    ];
  }
};

export default nextConfig;
