import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  AuthConfig,
  getNanoMQAuthConfig,
  normalizeNanoMQBaseURL,
} from '@/api/user';

export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  msg?: string;
  message?: string;
  error?: string;
}

export interface BrokerInfo {
  datetime: string;
  node_status: string;
  sysdescr: string;
  uptime: string;
  version: string;
}

export interface NodeInfo {
  connections: number;
  node_status: string;
  uptime: string;
  version: string;
}

export type ClientState = 'connected' | 'idle' | 'disconnected';
export type ProtoName = 'MQTT' | 'CoAP' | 'LwM2M' | 'MQTT-SN';
export type QoS = 0 | 1 | 2;

export interface ClientInfo {
  client_id: string;
  username: string;
  proto_name: ProtoName | string;
  proto_ver: number;
  connected: boolean;
  keepalive: number;
  clean_start: boolean;
  recv_msg: number;
  conn_state: ClientState;
}

export interface SubscriptionInfo {
  clientid: string;
  topic: string;
  qos: QoS;
}

export interface MetricsInfo {
  cpu_usage?: number;
  memory_usage?: number;
  memory_total?: number;
  cpuinfo?: string;
  memory?: string;
  connections_count?: number;
  connections_max?: number;
  subscriptions_count?: number;
  subscriptions_max?: number;
  messages_received?: number;
  messages_sent?: number;
  messages_dropped?: number;
  messages_retained?: number;
  bytes_received?: number;
  bytes_sent?: number;
  uptime?: number;
  timestamp?: number;
  metrics?: Record<string, unknown>[];
}

export interface PublishMessage {
  topic?: string;
  topics?: string;
  clientid?: string;
  payload: string;
  encoding?: 'plain' | 'base64';
  qos?: QoS;
  retain?: boolean;
  properties?: Record<string, unknown>;
}

export type PublishBatchItem = PublishMessage;

export interface ApiEndpoint {
  path: string;
  name: string;
  method: string;
  descr: string;
}

export interface ReloadConfig {
  property_size?: number;
  msq_len?: number;
  qos_duration?: number;
  allow_anonymous?: boolean;
  max_packet_size?: number;
  client_max_packet_size?: number;
  keepalive_backoff?: number;
  [key: string]: unknown;
}

export interface TopicTreeNode {
  topic: string;
  cld_cnt: number;
  clientid?: string[];
  [key: string]: unknown;
}

export interface RuleAction {
  name: string;
  params: Record<string, unknown>;
}

export interface RuleInfo {
  id: string | number;
  rawsql: string;
  enabled: boolean;
  description?: string;
  actions?: RuleAction[];
  [key: string]: unknown;
}

export interface BridgeConfigResponse {
  bridge: {
    nodes: Array<Record<string, unknown>>;
  };
  [key: string]: unknown;
}

export interface GetFileResponse {
  path: string;
  content: string;
}

class NanoMQAPI {
  private client: AxiosInstance;

  private authConfig: AuthConfig | null = null;

  constructor() {
    this.client = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      this.applyClientConfig();
      return config;
    });
  }

  private static createApiV4BaseURL(url: string) {
    return `${normalizeNanoMQBaseURL(url)}/api/v4`;
  }

  private applyClientConfig(config?: AuthConfig | null) {
    const resolved = config || this.authConfig || getNanoMQAuthConfig();
    this.client.defaults.baseURL = NanoMQAPI.createApiV4BaseURL(
      resolved.baseURL
    );
    this.client.defaults.auth = {
      username: resolved.username,
      password: resolved.password,
    };
  }

  setAuthConfig(config: AuthConfig) {
    this.authConfig = config;
    this.applyClientConfig(config);
  }

  clearAuthConfig() {
    this.authConfig = null;
    this.applyClientConfig(null);
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get<ApiResponse<BrokerInfo[]>>(
        '/brokers'
      );
      return response.status === 200 && response.data.code === 0;
    } catch {
      return false;
    }
  }

  async getEndpoints(): Promise<ApiEndpoint[]> {
    const response = await this.client.get<ApiResponse<ApiEndpoint[]>>('');
    return response.data.data;
  }

  async getBrokerInfo(): Promise<BrokerInfo[]> {
    const response = await this.client.get<ApiResponse<BrokerInfo[]>>(
      '/brokers'
    );
    return response.data.data;
  }

  async getNodeInfo(): Promise<NodeInfo[]> {
    const response = await this.client.get<ApiResponse<NodeInfo[]>>('/nodes');
    return response.data.data;
  }

  async getMetrics(): Promise<MetricsInfo> {
    const response = await this.client.get<
      MetricsInfo | ApiResponse<MetricsInfo>
    >('/metrics');
    const { data } = response;
    if (data && typeof data === 'object' && 'data' in data) {
      return (data as ApiResponse<MetricsInfo>).data;
    }
    return data as MetricsInfo;
  }

  async getPrometheusMetrics(): Promise<string> {
    const response = await this.client.get<string>('/prometheus');
    return response.data;
  }

  async getClients(params?: {
    clientid?: string;
    username?: string;
    conn_state?: ClientState;
    clean_start?: boolean;
    proto_name?: ProtoName;
    proto_ver?: number;
  }): Promise<ClientInfo[]> {
    const response = await this.client.get<ApiResponse<ClientInfo[]>>(
      '/clients',
      { params }
    );
    return response.data.data;
  }

  async getClientById(clientid: string): Promise<ClientInfo[]> {
    const response = await this.client.get<ApiResponse<ClientInfo[]>>(
      `/clients/${encodeURIComponent(clientid)}`
    );
    return response.data.data;
  }

  async getClientByUsername(username: string): Promise<ClientInfo[]> {
    const response = await this.client.get<ApiResponse<ClientInfo[]>>(
      `/clients/username/${encodeURIComponent(username)}`
    );
    return response.data.data;
  }

  async getSubscriptions(params?: {
    clientid?: string;
    topic?: string;
    qos?: QoS;
    share?: string;
  }): Promise<SubscriptionInfo[]> {
    const response = await this.client.get<ApiResponse<SubscriptionInfo[]>>(
      '/subscriptions',
      { params }
    );
    return response.data.data;
  }

  async getSubscriptionsByClientId(
    clientid: string
  ): Promise<SubscriptionInfo[]> {
    const response = await this.client.get<ApiResponse<SubscriptionInfo[]>>(
      `/subscriptions/${encodeURIComponent(clientid)}`
    );
    return response.data.data;
  }

  async publishMessage(message: PublishMessage): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>(
      '/mqtt/publish',
      message
    );
    return response.data;
  }

  async publishBatch(
    messages: PublishBatchItem[]
  ): Promise<ApiResponse<{ data: Array<{ topic: string; code: number }> }>> {
    const response = await this.client.post<
      ApiResponse<{ data: Array<{ topic: string; code: number }> }>
    >('/mqtt/publish_batch', messages);
    return response.data;
  }

  async getTopicTree(): Promise<TopicTreeNode[][]> {
    const response = await this.client.get<ApiResponse<TopicTreeNode[][]>>(
      '/topic-tree'
    );
    return response.data.data;
  }

  async getReloadConfig(): Promise<ReloadConfig> {
    const response = await this.client.get<ApiResponse<ReloadConfig>>(
      '/reload'
    );
    return response.data.data;
  }

  async setReloadConfig(data: ReloadConfig): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>('/reload', { data });
    return response.data;
  }

  async configUpdate(hoconText: string): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>(
      '/config_update',
      hoconText,
      {
        headers: { 'Content-Type': 'text/plain' },
      }
    );
    return response.data;
  }

  async getFile(params: {
    path?: string;
    default?: boolean;
  }): Promise<ApiResponse<GetFileResponse>> {
    const response: AxiosResponse<ApiResponse<GetFileResponse>> =
      await this.client.get('/get_file', { params });
    return response.data;
  }

  async writeFile(path: string, content: string): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>('/write_file', {
      data: { path, content },
    });
    return response.data;
  }

  async setConfigurationAuth(
    payload: Record<string, unknown>
  ): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>(
      '/configuration/auth',
      payload
    );
    return response.data;
  }

  async getConfigurationAuth(): Promise<ApiResponse<{ auth: unknown[] }>> {
    const response = await this.client.get<ApiResponse<{ auth: unknown[] }>>(
      '/configuration/auth'
    );
    return response.data;
  }

  async getBridges(): Promise<ApiResponse<BridgeConfigResponse>> {
    const response = await this.client.get<ApiResponse<BridgeConfigResponse>>(
      '/bridges'
    );
    return response.data;
  }

  async getBridgeByName(
    bridgeName: string
  ): Promise<ApiResponse<BridgeConfigResponse>> {
    const response = await this.client.get<ApiResponse<BridgeConfigResponse>>(
      `/bridges/${encodeURIComponent(bridgeName)}`
    );
    return response.data;
  }

  async updateBridge(
    bridgeName: string,
    payload: Record<string, unknown>
  ): Promise<ApiResponse> {
    const response = await this.client.put<ApiResponse>(
      `/bridges/${encodeURIComponent(bridgeName)}`,
      payload
    );
    return response.data;
  }

  async addBridgeSubscriptions(
    bridgeName: string,
    payload: Record<string, unknown>
  ): Promise<ApiResponse> {
    const response = await this.client.put<ApiResponse>(
      `/bridges/sub/${encodeURIComponent(bridgeName)}`,
      payload
    );
    return response.data;
  }

  async removeBridgeSubscriptions(
    bridgeName: string,
    payload: Record<string, unknown>
  ): Promise<ApiResponse> {
    const response = await this.client.put<ApiResponse>(
      `/bridges/unsub/${encodeURIComponent(bridgeName)}`,
      payload
    );
    return response.data;
  }

  async getRules(params?: {
    enabled?: boolean;
  }): Promise<ApiResponse<RuleInfo[]>> {
    const response = await this.client.get<ApiResponse<RuleInfo[]>>('/rules', {
      params,
    });
    return response.data;
  }

  async getRule(ruleId: string): Promise<ApiResponse<RuleInfo>> {
    const response = await this.client.get<ApiResponse<RuleInfo>>(
      `/rules/${encodeURIComponent(ruleId)}`
    );
    return response.data;
  }

  async createRule(payload: {
    rawsql: string;
    actions: RuleAction[];
    description?: string;
  }): Promise<ApiResponse<RuleInfo>> {
    const response = await this.client.post<ApiResponse<RuleInfo>>(
      '/rules',
      payload
    );
    return response.data;
  }

  async updateRule(
    ruleId: string,
    payload: Partial<{
      rawsql: string;
      actions: RuleAction[];
      description: string;
      enabled: boolean;
    }>
  ): Promise<ApiResponse<RuleInfo>> {
    const response = await this.client.put<ApiResponse<RuleInfo>>(
      `/rules/${encodeURIComponent(ruleId)}`,
      payload
    );
    return response.data;
  }

  async deleteRule(ruleId: string): Promise<ApiResponse> {
    const response = await this.client.delete<ApiResponse>(
      `/rules/${encodeURIComponent(ruleId)}`
    );
    return response.data;
  }

  async getConfiguration(): Promise<ApiResponse<Record<string, unknown>>> {
    const response = await this.client.get<
      ApiResponse<Record<string, unknown>>
    >('/configuration');
    return response.data;
  }

  async setConfiguration(
    config: Record<string, unknown>
  ): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>(
      '/configuration',
      config
    );
    return response.data;
  }

  async controlBroker(action: 'stop' | 'restart'): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>(`/ctrl/${action}`);
    return response.data;
  }
}

export const nanomqAPI = new NanoMQAPI();
export default nanomqAPI;
