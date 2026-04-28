import type { RouteRecordNormalized } from 'vue-router';
import { UserState } from '@/store/modules/user/types';
import avatar from '@/assets/images/avatar.svg?url';

export interface LoginData {
  baseURL: string;
  username: string;
  password: string;
}

export interface AuthConfig {
  baseURL: string;
  username: string;
  password: string;
}

export interface LoginRes {
  token: string;
  config: AuthConfig;
}

const AUTH_KEY = 'nanomq-auth';
const CONFIG_KEY = 'nanomq-config';
const DEFAULT_NANOMQ_API_URL =
  import.meta.env.VITE_NANOMQ_API_URL || 'http://localhost:8081';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export function normalizeNanoMQBaseURL(url: string) {
  return url.trim().replace(/\/+$/, '');
}

export function getDefaultNanoMQConfig(): AuthConfig {
  return {
    baseURL: DEFAULT_NANOMQ_API_URL,
    username: import.meta.env.VITE_NANOMQ_USERNAME || '',
    password: import.meta.env.VITE_NANOMQ_PASSWORD || '',
  };
}

export function getStoredNanoMQConfig(): AuthConfig | null {
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const { baseURL, username, password } = parsed;
    if (
      typeof baseURL !== 'string' ||
      typeof username !== 'string' ||
      typeof password !== 'string'
    ) {
      return null;
    }
    return { baseURL, username, password };
  } catch {
    return null;
  }
}

export function getNanoMQAuthConfig(): AuthConfig {
  return getStoredNanoMQConfig() || getDefaultNanoMQConfig();
}

function validateLoginInput(data: LoginData) {
  if (!data.baseURL || !data.username || !data.password) {
    throw new Error('请填写完整的 NanoMQ 连接信息');
  }
  let url: URL;
  try {
    url = new URL(data.baseURL);
  } catch {
    throw new Error('请输入有效的服务器地址');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('服务器地址必须以 http:// 或 https:// 开头');
  }
}

function encodeBasicAuth(username: string, password: string) {
  return btoa(`${username}:${password}`);
}

export async function verifyNanoMQConnection(auth: AuthConfig) {
  const baseURL = normalizeNanoMQBaseURL(auth.baseURL);
  const response = await fetch(`${baseURL}/api/v4/brokers`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${encodeBasicAuth(auth.username, auth.password)}`,
    },
  });
  return response;
}

export async function login(data: LoginData): Promise<{ data: LoginRes }> {
  validateLoginInput(data);
  const config: AuthConfig = {
    baseURL: normalizeNanoMQBaseURL(data.baseURL),
    username: data.username,
    password: data.password,
  };

  let response: Response;
  try {
    response = await verifyNanoMQConnection(config);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : '无法连接到 NanoMQ，请检查网络和服务器地址'
    );
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error('用户名或密码错误');
    if (response.status === 403) throw new Error('访问被拒绝，请检查权限');
    if (response.status === 404) throw new Error('NanoMQ API 服务未找到');
    if (response.status >= 500) throw new Error('NanoMQ 服务器内部错误');
    throw new Error(`连接失败 (${response.status})`);
  }

  const authData = {
    isAuthenticated: true,
    timestamp: Date.now(),
  };
  const token = encodeBasicAuth(config.username, config.password);
  localStorage.setItem(AUTH_KEY, JSON.stringify(authData));
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));

  return {
    data: {
      token,
      config,
    },
  };
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(CONFIG_KEY);
  return Promise.resolve({
    data: {
      token: '',
      config: getDefaultNanoMQConfig(),
    },
  });
}

export async function getUserInfo(): Promise<{ data: UserState }> {
  const config = getNanoMQAuthConfig();
  return {
    data: {
      name: config.username,
      avatar,
      email: `${config.username}@werecloud.com`,
      job: 'Werecloud Operator',
      organization: 'Werecloud',
      location: config.baseURL,
      introduction: 'Werecloud ioT',
      role: 'admin',
    },
  };
}

export function getMenuList() {
  return Promise.resolve({ data: [] as RouteRecordNormalized[] });
}
