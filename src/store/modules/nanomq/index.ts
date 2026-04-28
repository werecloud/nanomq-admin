import { defineStore } from 'pinia';
import { getNanoMQAuthConfig } from '@/api/user';
import {
  BrokerInfo,
  ClientInfo,
  MetricsInfo,
  NodeInfo,
  SubscriptionInfo,
  nanomqAPI,
} from '@/api/nanomq';
import { mergeNanoMqMetricsSnapshot } from '@/api/metrics';

interface NanoMQState {
  isConnected: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  isLoading: boolean;
  error: string | null;
  brokerInfo: BrokerInfo | null;
  nodeInfo: NodeInfo | null;
  clients: ClientInfo[];
  subscriptions: SubscriptionInfo[];
  metrics: MetricsInfo | null;
  lastUpdated: number | null;
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const useNanoMQStore = defineStore('nanomq', {
  state: (): NanoMQState => ({
    isConnected: false,
    connectionStatus: 'disconnected',
    isLoading: false,
    error: null,
    brokerInfo: null,
    nodeInfo: null,
    clients: [],
    subscriptions: [],
    metrics: null,
    lastUpdated: null,
  }),

  getters: {
    connectedClients(state) {
      return state.clients.filter((client) => client.conn_state === 'connected')
        .length;
    },
    totalSubscriptions(state) {
      return state.subscriptions.length;
    },
  },

  actions: {
    syncAuthConfig() {
      nanomqAPI.setAuthConfig(getNanoMQAuthConfig());
    },

    async testConnection(): Promise<boolean> {
      this.syncAuthConfig();
      this.isLoading = true;
      this.connectionStatus = 'connecting';
      this.error = null;
      try {
        const connected = await nanomqAPI.testConnection();
        this.isConnected = connected;
        this.connectionStatus = connected ? 'connected' : 'disconnected';
        if (!connected) this.error = '无法连接到 NanoMQ 服务器';
        return connected;
      } catch (error) {
        this.error = getErrorMessage(error, '连接测试失败');
        this.isConnected = false;
        this.connectionStatus = 'disconnected';
        return false;
      } finally {
        this.isLoading = false;
      }
    },

    async refreshBrokerInfo() {
      this.syncAuthConfig();
      const data = await nanomqAPI.getBrokerInfo();
      this.brokerInfo = data[0] || null;
      this.lastUpdated = Date.now();
    },

    async refreshNodeInfo() {
      this.syncAuthConfig();
      const data = await nanomqAPI.getNodeInfo();
      this.nodeInfo = data[0] || null;
      this.lastUpdated = Date.now();
    },

    async refreshClients() {
      this.syncAuthConfig();
      this.isLoading = true;
      try {
        this.clients = await nanomqAPI.getClients();
        this.lastUpdated = Date.now();
      } finally {
        this.isLoading = false;
      }
    },

    async refreshSubscriptions() {
      this.syncAuthConfig();
      this.isLoading = true;
      try {
        this.subscriptions = await nanomqAPI.getSubscriptions();
        this.lastUpdated = Date.now();
      } finally {
        this.isLoading = false;
      }
    },

    async refreshMetrics() {
      this.syncAuthConfig();
      this.isLoading = true;
      this.error = null;
      try {
        const [metricsRaw, promText, nodesList, subs] = await Promise.all([
          nanomqAPI.getMetrics(),
          nanomqAPI.getPrometheusMetrics().catch(() => ''),
          nanomqAPI.getNodeInfo().catch(() => []),
          nanomqAPI.getSubscriptions().catch(() => []),
        ]);
        this.metrics = mergeNanoMqMetricsSnapshot({
          metricsRaw,
          promText: typeof promText === 'string' ? promText : '',
          nodes: nodesList,
          subscriptionCount: subs.length,
        });
        this.lastUpdated = Date.now();
        this.isConnected = true;
        this.connectionStatus = 'connected';
      } catch (error) {
        this.isConnected = false;
        this.connectionStatus = 'disconnected';
        this.error = getErrorMessage(error, '获取统计信息失败');
      } finally {
        this.isLoading = false;
      }
    },

    async refreshData() {
      this.isLoading = true;
      try {
        const connected = await this.testConnection();
        if (connected) {
          await Promise.all([
            this.refreshBrokerInfo(),
            this.refreshNodeInfo(),
            this.refreshClients(),
            this.refreshSubscriptions(),
            this.refreshMetrics(),
          ]);
        }
      } catch (error) {
        this.isConnected = false;
        this.connectionStatus = 'disconnected';
        this.error = getErrorMessage(error, '刷新数据失败');
      } finally {
        this.isLoading = false;
      }
    },

    reset() {
      this.$reset();
    },
  },
});

export default useNanoMQStore;
