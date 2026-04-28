import type { ClientState, QoS } from '@/api/nanomq';

export interface MetricPoint {
  timestamp: number;
  value: number;
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1
  );
  return `${Number((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export function formatNumber(num: number) {
  if (!Number.isFinite(num)) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}

export function formatUptime(seconds: number | string | undefined) {
  let value = 0;
  if (typeof seconds === 'number') {
    value = seconds;
  } else if (typeof seconds === 'string') {
    const parsed = Number(seconds);
    value = Number.isFinite(parsed) ? parsed : 0;
  }
  if (!Number.isFinite(value) || value < 0) return '-';
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function qosText(qos: QoS | number) {
  const map: Record<number, string> = {
    0: 'At most once',
    1: 'At least once',
    2: 'Exactly once',
  };
  return map[qos] || 'Unknown';
}

export function stateColor(state: ClientState | string) {
  if (state === 'connected') return 'green';
  if (state === 'idle') return 'orange';
  if (state === 'disconnected') return 'red';
  return 'gray';
}

export function qosColor(qos: QoS | number) {
  if (qos === 0) return 'gray';
  if (qos === 1) return 'orange';
  return 'red';
}

export function protocolColor(protocol: string) {
  if (protocol === 'MQTT') return 'blue';
  if (protocol === 'CoAP') return 'purple';
  if (protocol === 'LwM2M') return 'orange';
  if (protocol === 'MQTT-SN') return 'cyan';
  return 'gray';
}

export function isWildcardTopic(topic: string) {
  return topic.includes('+') || topic.includes('#');
}

export function uniqueId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}${Math.random().toString(16).slice(2)}`;
}

export function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'response' in error) {
    const { response } = error as { response?: { data?: unknown } };
    const data = response?.data;
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      if (typeof record.message === 'string') return record.message;
      if (typeof record.error === 'string') return record.error;
      if (typeof record.msg === 'string') return record.msg;
    }
  }
  return error instanceof Error ? error.message : fallback;
}
