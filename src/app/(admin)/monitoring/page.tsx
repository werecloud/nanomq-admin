'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNanoMQ } from '@/context/NanoMQContext';
import { nanomqAPI, type NodeInfo } from '@/api/nanomq';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Cpu,
  MemoryStick,
  Network,
  Users,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Pause,
  Play,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
} from 'lucide-react';

interface MetricData {
  timestamp: number;
  value: number;
}

interface SystemMetrics {
  cpu_usage: number;
  memory_usage: number;
  memory_total: number;
  connections_count: number;
  subscriptions_count: number;
  messages_received: number;
  messages_sent: number;
  bytes_received: number;
  bytes_sent: number;
  uptime: number;
}

const toSafeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

/** NanoMQ v4 `/metrics` 常见字段：`cpuinfo`、`memory`、`connections`；也可能包在 `{ code, data }` 里 */
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

const normalizeMetrics = (raw: unknown): SystemMetrics => {
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
    cpu_usage: cpuUsage,
    memory_usage: memUsage,
    memory_total: memoryTotal,
    connections_count: connections,
    subscriptions_count: subs,
    messages_received: toSafeNumber(data.messages_received, 0),
    messages_sent: toSafeNumber(data.messages_sent, 0),
    bytes_received: toSafeNumber(data.bytes_received, 0),
    bytes_sent: toSafeNumber(data.bytes_sent, 0),
    uptime: toSafeNumber(data.uptime, 0),
  };
};

const parseNumberField = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : null;
};

/** 解析 NanoMQ `/nodes` 返回的 uptime 字符串，例如 `1 hours 2 minutes 3 seconds` */
const parseUptimeToSeconds = (uptime: unknown): number | null => {
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

/** 解析 `/prometheus` 文本行：`metric_name{labels} value` 或 `metric_name value` */
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

/** 合并 `/metrics` + `/prometheus` + `/nodes` + 订阅列表，与后端 metrics 代理逻辑对齐 */
const enrichMetricsFromApis = (
  base: SystemMetrics,
  promText: string | null | undefined,
  nodes: NodeInfo[] | null | undefined,
  subscriptionCount: number
): SystemMetrics => {
  const out = { ...base };

  if (typeof promText === 'string' && promText.length > 0) {
    const p = parsePrometheusText(promText);
    if (Number.isFinite(p.nanomq_cpu_usage)) out.cpu_usage = p.nanomq_cpu_usage;
    if (Number.isFinite(p.nanomq_memory_usage)) out.memory_usage = p.nanomq_memory_usage;
    if (Number.isFinite(p.nanomq_memory_usage_max) && p.nanomq_memory_usage_max > 0) {
      out.memory_total = Math.max(p.nanomq_memory_usage_max, out.memory_usage, 1);
    }
    if (Number.isFinite(p.nanomq_connections_count)) out.connections_count = p.nanomq_connections_count;
    if (Number.isFinite(p.nanomq_subscribers_count)) {
      out.subscriptions_count = Math.max(p.nanomq_subscribers_count, subscriptionCount);
    } else if (subscriptionCount > 0) {
      out.subscriptions_count = subscriptionCount;
    }
    if (Number.isFinite(p.nanomq_messages_received)) out.messages_received = p.nanomq_messages_received;
    if (Number.isFinite(p.nanomq_messages_sent)) out.messages_sent = p.nanomq_messages_sent;
    const { rx, tx } = pickBytesFromPrometheus(p);
    if (rx !== null) out.bytes_received = rx;
    if (tx !== null) out.bytes_sent = tx;
  } else if (subscriptionCount > 0) {
    out.subscriptions_count = Math.max(out.subscriptions_count, subscriptionCount);
  }

  if (nodes && nodes.length > 0) {
    const n0 = nodes[0] as unknown as Record<string, unknown>;
    const uptimeSec = parseUptimeToSeconds(n0.uptime);
    if (uptimeSec !== null && uptimeSec >= 0) out.uptime = uptimeSec;
    const conns = parseNumberField(n0.connections);
    if (conns !== null && out.connections_count === 0) out.connections_count = conns;
  }

  if (!Number.isFinite(out.memory_total) || out.memory_total <= 0) {
    out.memory_total = Math.max(out.memory_usage, 1);
  } else if (out.memory_total < out.memory_usage) {
    out.memory_total = Math.max(out.memory_usage, 1);
  }

  out.subscriptions_count = Math.max(out.subscriptions_count, subscriptionCount);

  return out;
};

const MonitorPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, config } = useAuth();
  const { connectionStatus } = useNanoMQ();
  const router = useRouter();
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5秒
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // 历史数据存储 (最近50个数据点)
  const [cpuHistory, setCpuHistory] = useState<MetricData[]>([]);
  const [memoryHistory, setMemoryHistory] = useState<MetricData[]>([]);
  const [connectionsHistory, setConnectionsHistory] = useState<MetricData[]>([]);
  const [messagesHistory, setMessagesHistory] = useState<MetricData[]>([]);

  // 认证检查
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/signin');
    }
  }, [isAuthenticated, authLoading, router]);

  // 获取系统指标（刷新后子组件 effect 可能早于 NanoMQProvider 的 setAuthConfig，需在此同步凭证）
  const fetchMetrics = useCallback(async () => {
    if (!isAuthenticated || !config?.baseURL || !config.username) return;

    setIsLoading(true);
    setError(null);

    try {
      nanomqAPI.setAuthConfig(config);
      const [metricsRaw, promText, nodesList, subscriptionsList] = await Promise.all([
        nanomqAPI.getMetrics(),
        nanomqAPI.getPrometheusMetrics().catch(() => ''),
        nanomqAPI.getNodeInfo().catch(() => []),
        nanomqAPI.getSubscriptions().catch(() => []),
      ]);
      const base = normalizeMetrics(metricsRaw);
      const promStr = typeof promText === 'string' ? promText : '';
      const data = enrichMetricsFromApis(base, promStr, nodesList, subscriptionsList.length);
      setMetrics(data);
      
      // 更新历史数据
      const timestamp = Date.now();
      const maxDataPoints = 50;
      
      setCpuHistory(prev => {
        const newData = [...prev, { timestamp, value: data.cpu_usage }];
        return newData.slice(-maxDataPoints);
      });
      
      setMemoryHistory(prev => {
        const memoryPercent = (data.memory_usage / data.memory_total) * 100;
        const newData = [...prev, { timestamp, value: memoryPercent }];
        return newData.slice(-maxDataPoints);
      });
      
      setConnectionsHistory(prev => {
        const newData = [...prev, { timestamp, value: data.connections_count }];
        return newData.slice(-maxDataPoints);
      });
      
      setMessagesHistory(prev => {
        const totalMessages = data.messages_received + data.messages_sent;
        const newData = [...prev, { timestamp, value: totalMessages }];
        return newData.slice(-maxDataPoints);
      });
      
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      const status =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 401) {
        setError('认证失败（401），请重新登录或检查 NanoMQ HTTP 账号密码');
      } else {
        setError(error instanceof Error ? error.message : '获取系统指标失败');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, config]);

  // 启动/停止监控（等 Auth 恢复完成且 config 就绪，避免无凭证请求 401）
  useEffect(() => {
    if (isMonitoring && isAuthenticated && !authLoading && config?.baseURL) {
      // 立即获取一次数据
      fetchMetrics();

      // 设置定时器
      intervalRef.current = setInterval(fetchMetrics, refreshInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isMonitoring, refreshInterval, isAuthenticated, authLoading, config?.baseURL, fetchMetrics]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}天 ${hours}小时 ${minutes}分钟`;
    } else if (hours > 0) {
      return `${hours}小时 ${minutes}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-600 dark:text-green-400';
      case 'connecting':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-red-600 dark:text-red-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-5 h-5" />;
      case 'connecting':
        return <Loader2 className="w-5 h-5 animate-spin" />;
      default:
        return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const SimpleChart: React.FC<{ data: MetricData[]; color: string; unit?: string }> = ({ 
    data, color, unit = '' 
  }) => {
    if (data.length === 0) {
      return (
        <div className="h-24 flex items-center justify-center text-gray-400 text-sm">
          暂无数据
        </div>
      );
    }

    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const range = maxValue - minValue || 1;

    return (
      <div className="h-24 relative">
        <svg className="w-full h-full">
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2"
            points={data.map((point, index) => {
              const denominator = Math.max(data.length - 1, 1);
              const x = (index / denominator) * 100;
              const y = 100 - ((point.value - minValue) / range) * 100;
              return `${x},${y}`;
            }).join(' ')}
          />
        </svg>
        <div className="absolute top-0 right-0 text-xs text-gray-500 dark:text-gray-400">
          {data[data.length - 1]?.value.toFixed(1)}{unit}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">实时监控</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            实时监控 NanoMQ 系统状态和性能指标
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* 刷新间隔选择 */}
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={1000}>1秒</option>
            <option value={5000}>5秒</option>
            <option value={10000}>10秒</option>
            <option value={30000}>30秒</option>
          </select>
          
          {/* 监控控制按钮 */}
          <button
            onClick={() => setIsMonitoring(!isMonitoring)}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
              isMonitoring
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isMonitoring ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                暂停
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                开始
              </>
            )}
          </button>
          
          {/* 手动刷新按钮 */}
          <button
            onClick={fetchMetrics}
            disabled={isLoading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {/* 连接状态 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`${getStatusColor(connectionStatus)}`}>
              {getStatusIcon(connectionStatus)}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                连接状态
              </h3>
              <p className={`text-sm ${getStatusColor(connectionStatus)}`}>
                {connectionStatus === 'connected' ? '已连接' : 
                 connectionStatus === 'connecting' ? '连接中' : '连接失败'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              最后更新: {new Date().toLocaleTimeString()}
            </p>
            {isMonitoring && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                自动刷新: {refreshInterval / 1000}秒
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* 系统指标卡片 */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* CPU 使用率 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">CPU 使用率</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {metrics.cpu_usage.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
            <SimpleChart data={cpuHistory} color="#3B82F6" unit="%" />
          </div>

          {/* 内存使用率 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <MemoryStick className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">内存使用</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatBytes(metrics.memory_usage)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    / {formatBytes(metrics.memory_total)}
                  </p>
                </div>
              </div>
            </div>
            <SimpleChart data={memoryHistory} color="#10B981" unit="%" />
          </div>

          {/* 连接数 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                  <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">活跃连接</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {metrics.connections_count}
                  </p>
                </div>
              </div>
            </div>
            <SimpleChart data={connectionsHistory} color="#8B5CF6" />
          </div>

          {/* 消息统计 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">总消息数</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(metrics.messages_received + metrics.messages_sent).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            <SimpleChart data={messagesHistory} color="#F59E0B" />
          </div>
        </div>
      )}

      {/* 详细统计 */}
      {metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 消息流量统计 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Network className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              消息流量统计
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center">
                  <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400 mr-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">接收消息</span>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {metrics.messages_received.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center">
                  <TrendingDown className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">发送消息</span>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {metrics.messages_sent.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center">
                  <Database className="w-4 h-4 text-purple-600 dark:text-purple-400 mr-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">接收字节</span>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {formatBytes(metrics.bytes_received)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center">
                  <Database className="w-4 h-4 text-orange-600 dark:text-orange-400 mr-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">发送字节</span>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {formatBytes(metrics.bytes_sent)}
                </span>
              </div>
            </div>
          </div>

          {/* 系统信息 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
              系统信息
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center">
                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">运行时间</span>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {formatUptime(metrics.uptime)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center">
                  <Users className="w-4 h-4 text-purple-600 dark:text-purple-400 mr-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">活跃订阅</span>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {metrics.subscriptions_count.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center">
                  <MemoryStick className="w-4 h-4 text-green-600 dark:text-green-400 mr-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">内存使用率</span>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {((metrics.memory_usage / metrics.memory_total) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center">
                  <Cpu className="w-4 h-4 text-red-600 dark:text-red-400 mr-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">CPU 负载</span>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {metrics.cpu_usage.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonitorPage;