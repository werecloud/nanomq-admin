import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import os from 'node:os';

// 从请求头获取认证配置
function getAuthConfig(request: NextRequest) {
  const authHeader = request.headers.get('x-nanomq-auth');
  if (authHeader) {
    try {
      return JSON.parse(authHeader);
    } catch (error) {
      console.error('Failed to parse auth header:', error);
    }
  }
  
  // 回退到环境变量
  return {
    baseURL: process.env.NANOMQ_API_URL || 'http://localhost:8081',
    username: process.env.NANOMQ_USERNAME || 'admin',
    password: process.env.NANOMQ_PASSWORD || 'public'
  };
}

// 创建 NanoMQ 客户端
function createNanoMQClient(config: { baseURL: string; username: string; password: string }) {
  return axios.create({
    baseURL: `${config.baseURL}/api/v4`,
    timeout: 10000,
    auth: {
      username: config.username,
      password: config.password
    },
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

function parsePercent(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace('%', '');
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : null;
}

function parseUptimeToSeconds(uptime: unknown): number | null {
  if (typeof uptime !== 'string') return null;
  const s = uptime.toLowerCase();
  const h = s.match(/(\d+)\s*hours?/);
  const m = s.match(/(\d+)\s*minutes?/);
  const sec = s.match(/(\d+)\s*seconds?/);
  const hours = h ? Number(h[1]) : 0;
  const minutes = m ? Number(m[1]) : 0;
  const seconds = sec ? Number(sec[1]) : 0;
  if (![hours, minutes, seconds].every(Number.isFinite)) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

function parsePrometheusText(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // format: name value
    const [name, value] = trimmed.split(/\s+/, 2);
    if (!name || value === undefined) continue;
    const n = Number(value);
    if (Number.isFinite(n)) out[name] = n;
  }
  return out;
}

export async function GET(request: NextRequest) {
  try {
    // 获取认证配置并创建客户端
    const authConfig = getAuthConfig(request);
    const nanomqClient = createNanoMQClient(authConfig);
    
    // 并行获取多个指标数据（尽量用真实数据；不再随机造值）
    const [metricsResponse, prometheusResponse, nodesResponse] = await Promise.all([
      nanomqClient.get('/metrics').catch(() => null),
      nanomqClient.get('/prometheus', { responseType: 'text' as const }).catch(() => null),
      nanomqClient.get('/nodes').catch(() => null),
    ]);

    const now = Date.now();
    const memoryTotal = os.totalmem();

    const responseData = {
      cpu_usage: 0,
      memory_usage: 0,
      memory_total: memoryTotal,
      connections_count: 0,
      subscriptions_count: 0,
      messages_received: 0,
      messages_sent: 0,
      bytes_received: 0,
      bytes_sent: 0,
      uptime: 0,
      timestamp: now,
    };

    // /metrics (v4) 返回示例：{"metrics":[],"cpuinfo":"0.00%","memory":"1945600","connections":1}
    if (metricsResponse?.data && typeof metricsResponse.data === 'object') {
      const m = metricsResponse.data as Record<string, unknown>;
      const cpu = parsePercent(m.cpuinfo);
      const mem = parseNumber(m.memory);
      const conns = parseNumber(m.connections);
      if (cpu !== null) responseData.cpu_usage = cpu;
      if (mem !== null) responseData.memory_usage = mem;
      if (conns !== null) responseData.connections_count = conns;
    }

    // /prometheus (v4) 里有更全的 counters/gauges
    if (typeof prometheusResponse?.data === 'string') {
      const p = parsePrometheusText(prometheusResponse.data);
      if (Number.isFinite(p.nanomq_cpu_usage)) responseData.cpu_usage = p.nanomq_cpu_usage;
      if (Number.isFinite(p.nanomq_memory_usage)) responseData.memory_usage = p.nanomq_memory_usage;
      if (Number.isFinite(p.nanomq_connections_count)) responseData.connections_count = p.nanomq_connections_count;
      if (Number.isFinite(p.nanomq_subscribers_count)) responseData.subscriptions_count = p.nanomq_subscribers_count;
      if (Number.isFinite(p.nanomq_messages_received)) responseData.messages_received = p.nanomq_messages_received;
      if (Number.isFinite(p.nanomq_messages_sent)) responseData.messages_sent = p.nanomq_messages_sent;
    }

    // /nodes 用于补 uptime（字符串）和连接数兜底
    if (nodesResponse?.data && typeof nodesResponse.data === 'object') {
      const obj = nodesResponse.data as { code?: number; data?: unknown };
      const node0 =
        Array.isArray(obj.data) && obj.data.length > 0 && typeof obj.data[0] === 'object'
          ? (obj.data[0] as Record<string, unknown>)
          : null;
      const uptime = node0 ? parseUptimeToSeconds(node0.uptime) : null;
      const conns = node0 ? parseNumber(node0.connections) : null;
      if (uptime !== null) responseData.uptime = uptime;
      if (conns !== null && responseData.connections_count === 0) responseData.connections_count = conns;
    }

    // 确保 memory_total > 0，避免前端除零
    if (!Number.isFinite(responseData.memory_total) || responseData.memory_total <= 0) {
      responseData.memory_total = Math.max(responseData.memory_usage, 1);
    }

    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('Get metrics error:', error);
    
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ECONNREFUSED') {
      return NextResponse.json(
        { error: '无法连接到 NanoMQ 服务器，请检查服务器状态' },
        { status: 503 }
      );
    }
    
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ETIMEDOUT') {
      return NextResponse.json(
        { error: '连接超时，请检查网络连接' },
        { status: 408 }
      );
    }
    
    if (error && typeof error === 'object' && 'response' in error && error.response) {
      const response = error.response as { status: number; data?: { error?: string; message?: string } };
      const status = response.status;
      const message = response.data?.error || response.data?.message || '获取指标失败';
      
      if (status === 401) {
        return NextResponse.json(
          { error: '认证失败，请检查用户名和密码' },
          { status: 401 }
        );
      }
      
      if (status === 403) {
        return NextResponse.json(
          { error: '权限不足，无法访问系统指标' },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { error: `服务器错误: ${message}` },
        { status: status }
      );
    }
    
    // 无法获取时直接返回错误（不再返回随机模拟数据，避免误导“CPU/内存很高”）
    return NextResponse.json(
      { error: '获取 NanoMQ 指标失败', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// 支持 OPTIONS 请求用于 CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-nanomq-auth',
    },
  });
}