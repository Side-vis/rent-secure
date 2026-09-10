const defaultAppUrl = "https://10antscore.com";

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

export function resolveCanonicalAppBaseUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || null;

  if (configuredUrl && configuredUrl.trim().length > 0) {
    return normalizeBaseUrl(configuredUrl.trim());
  }

  return defaultAppUrl;
}

export function resolveInviteBaseUrl(requestOrigin: string) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || null;

  if (configuredUrl && configuredUrl.trim().length > 0) {
    return normalizeBaseUrl(configuredUrl.trim());
  }

  if (process.env.NODE_ENV === "development") {
    return normalizeBaseUrl(requestOrigin);
  }

  return defaultAppUrl;
}