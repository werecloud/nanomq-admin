const DEFAULT_NANOMQ_PROXY_BASE_PATH = '/api/v4';

function normalizeProxyBasePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return DEFAULT_NANOMQ_PROXY_BASE_PATH;

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.replace(/\/+$/, '');
  return normalized || DEFAULT_NANOMQ_PROXY_BASE_PATH;
}

export const NANOMQ_PROXY_BASE_PATH = normalizeProxyBasePath(
  process.env.NEXT_PUBLIC_NANOMQ_PROXY_BASE_PATH || DEFAULT_NANOMQ_PROXY_BASE_PATH
);
