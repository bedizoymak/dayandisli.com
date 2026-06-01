const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

const DEFAULT_PUBLIC_BASE_URL = "https://dayandisli.com";
const DEFAULT_ERP_BASE_URL = "https://erp.dayandisli.com";

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function getHostnameFromUrl(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function isLocalhost(hostname = window.location.hostname) {
  return LOCAL_HOSTNAMES.has(hostname);
}

export function getPublicBaseUrl() {
  return normalizeBaseUrl(import.meta.env.VITE_PUBLIC_BASE_URL || DEFAULT_PUBLIC_BASE_URL);
}

export function getErpBaseUrl() {
  return normalizeBaseUrl(import.meta.env.VITE_ERP_BASE_URL || DEFAULT_ERP_BASE_URL);
}

export function isPublicDomain(hostname = window.location.hostname) {
  const publicHostname = getHostnameFromUrl(getPublicBaseUrl());
  return hostname === publicHostname || hostname === `www.${publicHostname}`;
}

export function isErpDomain(hostname = window.location.hostname) {
  return hostname === getHostnameFromUrl(getErpBaseUrl());
}

export function isPublicRuntimeDomain(hostname = window.location.hostname) {
  return !isLocalhost(hostname) && isPublicDomain(hostname);
}

export function isErpRuntimeDomain(hostname = window.location.hostname) {
  return !isLocalhost(hostname) && isErpDomain(hostname);
}

export function shouldExposePublicRoutes(hostname = window.location.hostname) {
  return isLocalhost(hostname) || isPublicDomain(hostname);
}

export function shouldExposeErpRoutes(hostname = window.location.hostname) {
  return isLocalhost(hostname) || isErpDomain(hostname);
}

export function getPublicLoginRedirectUrl(location: Location = window.location) {
  if (isLocalhost(location.hostname) || isErpDomain(location.hostname) || !isPublicDomain(location.hostname)) {
    return null;
  }

  if (location.pathname !== "/login") {
    return null;
  }

  const target = new URL("/login", getErpBaseUrl());
  target.search = location.search;
  target.hash = location.hash;
  return target.toString();
}

export function buildErpPath(path = "/dashboard") {
  return path.startsWith("/") ? path : `/${path}`;
}

export function buildErpUrl(path = "/apps") {
  return `${getErpBaseUrl()}${buildErpPath(path)}`;
}
