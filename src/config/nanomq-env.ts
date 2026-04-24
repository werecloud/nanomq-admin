export const DEFAULT_NANOMQ_API_URL = 'http://localhost:8081';

export const NANOMQ_API_URL =
  (process.env.NANOMQ_API_URL && process.env.NANOMQ_API_URL.trim()) || DEFAULT_NANOMQ_API_URL;
