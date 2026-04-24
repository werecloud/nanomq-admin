import type { MetricsInfo, NodeInfo } from '@/api/nanomq';

const toSafeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const parseCpuinfoPercent = (cpuinfo: unknown): number => {
  if (typeof cpuinfo === 'number' && Number.isFinite(cpuinfo)) return cpuinfo;
  if (typeof cpuinfo !== 'string') return 0;
  const n = Number(cpuinfo.trim().replace(/%/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const unwrapMetricsPayload = (raw: unknown): Record<string, unknown> => {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  if ('data' in o && o.data !== null && typeof o.data === 'object' && !Array.isArray(o.data)) {
    return o.data as Record<string, unknown>;
  }
  return o;
};

export const parseUptimeToSeconds = (uptime: unknown): number | null => {
  if (typeof uptime === 'number' && Number.isFinite(uptime)) return uptime;
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
};

const parseNumberField = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : null;
};

const parsePrometheusText = (text: string): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const lastSpace = trimmed.lastIndexOf(' ');
    if (lastSpace <= 0) continue;
    const metricPart = trimmed.slice(0, lastSpace).trim();
    const valueStr = trimmed.slice(lastSpace + 1).trim().split(/\s+/)[0];
    const n = Number(valueStr);
    if (!Number.isFinite(n)) continue;
    const baseName = metricPart.includes('{') ? metricPart.slice(0, metricPart.indexOf('{')) : metricPart;
    out[baseName] = n;
  }
  return out;
};

const pickBytesFromPrometheus = (p: Record<string, number>): { rx: number | null; tx: number | null } => {
  const tryKeys = (keys: string[]): number | null => {
    for (const k of keys) {
      if (Number.isFinite(p[k])) return p[k];
    }
    return null;
  };
  let rx = tryKeys(['nanomq_bytes_received', 'nanomq_recv_bytes', 'nanomq_network_bytes_received']);
  let tx = tryKeys(['nanomq_bytes_sent', 'nanomq_sent_bytes', 'nanomq_network_bytes_sent']);
  if (rx === null && tx === null) {
    for (const [k, v] of Object.entries(p)) {
      if (!Number.isFinite(v)) continue;
      const kl = k.toLowerCase();
      if (!kl.includes('byte')) continue;
      if (kl.includes('recv') || kl.includes('receiv') || kl.includes('inbound')) rx = rx === null ? v : Math.max(rx, v);
      else if (kl.includes('sent') || kl.includes('transmit') || kl.includes('outbound'))
        tx = tx === null ? v : Math.max(tx, v);
    }
  }
  return { rx, tx };
};

/** 将 `/metrics` JSON 转为 `MetricsInfo` 基底（字段名与 v4 对齐） */
function baseMetricsInfoFromRaw(raw: unknown): MetricsInfo {
  const data = unwrapMetricsPayload(raw);
  const cpuFromCpuinfo = parseCpuinfoPercent(data.cpuinfo);
  const cpuUsage = toSafeNumber(data.cpu_usage, cpuFromCpuinfo);
  const memUsage = toSafeNumber(
    data.memory_usage !== undefined ? data.memory_usage : data.memory,
    0
  );
  const memTotalRaw = toSafeNumber(data.memory_total, 0);
  const memoryTotal =
    memTotalRaw > 0 ? Math.max(memTotalRaw, memUsage, 1) : Math.max(memUsage, 1);
  const connections = toSafeNumber(
    data.connections_count !== undefined ? data.connections_count : data.connections,
    0
  );
  const subs = toSafeNumber(
    data.subscriptions_count !== undefined ? data.subscriptions_count : data.subscribers,
    0
  );

  return {
    cpuinfo: typeof data.cpuinfo === 'string' ? data.cpuinfo : undefined,
    memory: typeof data.memory === 'string' || typeof data.memory === 'number' ? String(data.memory) : undefined,
    cpu_usage: cpuUsage,
    memory_usage: memUsage,
    memory_total: memoryTotal,
    connections_count: connections,
    connections_max: toSafeNumber(data.connections_max, 0),
    subscriptions_count: subs,
    subscriptions_max: toSafeNumber(data.subscriptions_max, 0),
    messages_received: toSafeNumber(data.messages_received, 0),
    messages_sent: toSafeNumber(data.messages_sent, 0),
    messages_dropped: toSafeNumber(data.messages_dropped, 0),
    messages_retained: toSafeNumber(data.messages_retained, 0),
    bytes_received: toSafeNumber(data.bytes_received, 0),
    bytes_sent: toSafeNumber(data.bytes_sent, 0),
    uptime: toSafeNumber(data.uptime, 0),
    metrics: Array.isArray(data.metrics) ? (data.metrics as Record<string, unknown>[]) : undefined,
  };
}

function mergePrometheusNodesAndSubs(
  out: MetricsInfo,
  promText: string,
  nodes: NodeInfo[] | null | undefined,
  subscriptionCount: number
): MetricsInfo {
  const merged = { ...out };

  if (promText.length > 0) {
    const p = parsePrometheusText(promText);
    if (Number.isFinite(p.nanomq_cpu_usage)) merged.cpu_usage = p.nanomq_cpu_usage;
    if (Number.isFinite(p.nanomq_memory_usage)) merged.memory_usage = p.nanomq_memory_usage;
    if (Number.isFinite(p.nanomq_memory_usage_max) && p.nanomq_memory_usage_max > 0) {
      merged.memory_total = Math.max(p.nanomq_memory_usage_max, merged.memory_usage ?? 0, 1);
    }
    if (Number.isFinite(p.nanomq_connections_count)) merged.connections_count = p.nanomq_connections_count;
    if (Number.isFinite(p.nanomq_connections_max)) merged.connections_max = p.nanomq_connections_max;
    if (Number.isFinite(p.nanomq_subscribers_count)) {
      merged.subscriptions_count = Math.max(p.nanomq_subscribers_count, subscriptionCount);
    } else if (subscriptionCount > 0) {
      merged.subscriptions_count = subscriptionCount;
    }
    if (Number.isFinite(p.nanomq_subscribers_max)) merged.subscriptions_max = p.nanomq_subscribers_max;
    if (Number.isFinite(p.nanomq_messages_received)) merged.messages_received = p.nanomq_messages_received;
    if (Number.isFinite(p.nanomq_messages_sent)) merged.messages_sent = p.nanomq_messages_sent;
    if (Number.isFinite(p.nanomq_messages_dropped)) merged.messages_dropped = p.nanomq_messages_dropped;
    if (Number.isFinite(p.nanomq_messages_retained)) merged.messages_retained = p.nanomq_messages_retained;
    const { rx, tx } = pickBytesFromPrometheus(p);
    if (rx !== null) merged.bytes_received = rx;
    if (tx !== null) merged.bytes_sent = tx;
  } else if (subscriptionCount > 0) {
    merged.subscriptions_count = Math.max(merged.subscriptions_count ?? 0, subscriptionCount);
  }

  if (nodes && nodes.length > 0) {
    const n0 = nodes[0] as unknown as Record<string, unknown>;
    const uptimeSec = parseUptimeToSeconds(n0.uptime);
    if (uptimeSec !== null && uptimeSec >= 0) merged.uptime = uptimeSec;
    const conns = parseNumberField(n0.connections);
    if (conns !== null && (merged.connections_count === 0 || merged.connections_count === undefined)) {
      merged.connections_count = conns;
    }
  }

  if (!Number.isFinite(merged.memory_total ?? NaN) || (merged.memory_total ?? 0) <= 0) {
    merged.memory_total = Math.max(merged.memory_usage ?? 0, 1);
  } else if ((merged.memory_total ?? 0) < (merged.memory_usage ?? 0)) {
    merged.memory_total = Math.max(merged.memory_usage ?? 0, 1);
  }

  merged.subscriptions_count = Math.max(merged.subscriptions_count ?? 0, subscriptionCount);
  merged.timestamp = Date.now();

  return merged;
}

export type MergedMetricsInput = {
  metricsRaw: unknown;
  promText: string;
  nodes: NodeInfo[];
  subscriptionCount: number;
};

/** 合并 `/metrics` + `/prometheus` + `/nodes` + 订阅数，供 Context 与监控页共用 */
export function mergeNanoMqMetricsSnapshot(input: MergedMetricsInput): MetricsInfo {
  const base = baseMetricsInfoFromRaw(input.metricsRaw);
  const prom = typeof input.promText === 'string' ? input.promText : '';
  return mergePrometheusNodesAndSubs(base, prom, input.nodes, input.subscriptionCount);
}
