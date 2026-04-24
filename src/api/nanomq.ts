'use client';

import axios, { AxiosInstance, AxiosResponse } from 'axios';

// API 响应类型定义
export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
}

// Broker 信息类型
export interface BrokerInfo {
  datetime: string;
  node_status: string;
  sysdescr: string;
  uptime: string;
  version: string;
}

// 节点信息类型
export interface NodeInfo {
  connections: number;
  node_status: string;
  uptime: string;
  version: string;
}

// 客户端信息类型
export interface ClientInfo {
  client_id: string;
  username: string;
  proto_name: string;
  proto_ver: number;
  connected: boolean;
  keepalive: number;
  clean_start: boolean;
  recv_msg: number;
  conn_state: 'connected' | 'idle' | 'disconnected';
}

// 订阅信息类型
export interface SubscriptionInfo {
  clientid: string;
  topic: string;
  qos: number;
}

// 统计信息类型
export interface MetricsInfo {
  // CPU 和内存信息
  cpu_usage?: number;
  memory_usage?: number;
  memory_total?: number;
  cpuinfo?: string;
  memory?: string;
  
  // 连接和订阅统计
  connections_count?: number;
  connections_max?: number;
  subscriptions_count?: number;
  subscriptions_max?: number;
  
  // 消息统计
  messages_received?: number;
  messages_sent?: number;
  messages_dropped?: number;
  messages_retained?: number;
  
  // 字节统计
  bytes_received?: number;
  bytes_sent?: number;
  
  // 运行时间
  uptime?: number;
  
  // 时间戳
  timestamp?: number;
  
  // 原始 metrics 数据（兼容性）
  metrics?: Record<string, unknown>[];
}

// 发布消息参数类型
export interface PublishMessage {
  topic?: string;
  topics?: string;
  clientid?: string;
  payload: string;
  encoding?: 'plain' | 'base64';
  qos?: 0 | 1 | 2;
  retain?: boolean;
  properties?: Record<string, unknown>;
}

export type PublishBatchItem = PublishMessage;

// API 端点类型
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
  [key: string]: unknown;
}

export interface BridgeConfigResponse {
  bridge: {
    nodes: Array<Record<string, unknown>>;
  };
  [key: string]: unknown;
}

/** Runtime auth (password/acl includes, anonymous, defaults). POST /configuration/auth */
export interface NanoMQAuthRuntimeConfig {
  allow_anonymous?: boolean;
  no_match?: string;
  deny_action?: string;
  password?: { include?: string } | Record<string, unknown>;
  acl?: { include?: string } | Record<string, unknown>;
  [key: string]: unknown;
}

export interface GetFileResponse {
  path: string;
  content: string;
}

class NanoMQAPI {
  private client: AxiosInstance;
  private baseURL: string;
  private authConfig: { baseURL: string; username: string; password: string } | null = null;

  constructor() {
    // 使用 Next.js API 路由作为代理
    this.baseURL = '/api/nanomq';

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        }
        
        // 添加认证信息到请求头
        if (this.authConfig) {
          config.headers['x-nanomq-auth'] = JSON.stringify(this.authConfig);
        }
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        // 直接返回响应，错误处理由 API 代理层处理
        return response;
      },
      (error) => {
        // 统一错误处理
        if (process.env.NODE_ENV !== 'production') {
          console.error('API Error:', error.response?.data || error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  // 设置认证配置
  setAuthConfig(config: { baseURL: string; username: string; password: string }) {
    this.authConfig = config;
  }

  // 清除认证配置
  clearAuthConfig() {
    this.authConfig = null;
  }

  // 测试连接
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/brokers');
      return response.status === 200 && response.data && response.data.code === 0;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  // 获取所有 API 端点
  async getEndpoints(): Promise<ApiEndpoint[]> {
    const response = await this.client.get('');
    return response.data.data;
  }

  // 获取 Broker 信息
  async getBrokerInfo(): Promise<BrokerInfo[]> {
    const response = await this.client.get('/brokers');
    return response.data.data;
  }

  // 获取节点信息
  async getNodeInfo(): Promise<NodeInfo[]> {
    const response = await this.client.get('/nodes');
    return response.data.data;
  }

  // 获取统计信息
  async getMetrics(): Promise<MetricsInfo> {
    const response = await this.client.get('/metrics');
    return response.data;
  }

  // 获取 Prometheus 统计数据
  async getPrometheusMetrics(): Promise<string> {
    const response = await this.client.get('/prometheus');
    return response.data;
  }

  // 获取客户端列表
  async getClients(params?: {
    clientid?: string;
    username?: string;
    conn_state?: 'connected' | 'idle' | 'disconnected';
    clean_start?: boolean;
    proto_name?: 'MQTT' | 'CoAP' | 'LwM2M' | 'MQTT-SN';
    proto_ver?: number;
  }): Promise<ClientInfo[]> {
    const response = await this.client.get('/clients', {
      params,
    });
    return response.data.data;
  }

  // 根据 ClientID 获取客户端信息
  async getClientById(clientid: string): Promise<ClientInfo[]> {
    const response = await this.client.get(`/clients/${encodeURIComponent(clientid)}`);
    return response.data.data;
  }

  // 根据用户名获取客户端信息
  async getClientByUsername(username: string): Promise<ClientInfo[]> {
    const response = await this.client.get(`/clients/username/${encodeURIComponent(username)}`);
    return response.data.data;
  }

  // 获取订阅列表
  async getSubscriptions(params?: {
    clientid?: string;
    topic?: string;
    qos?: 0 | 1 | 2;
    share?: string;
  }): Promise<SubscriptionInfo[]> {
    const response = await this.client.get('/subscriptions', {
      params,
    });
    return response.data.data;
  }

  // 根据 ClientID 获取订阅信息
  async getSubscriptionsByClientId(clientid: string): Promise<SubscriptionInfo[]> {
    const response = await this.client.get(`/subscriptions/${encodeURIComponent(clientid)}`);
    return response.data.data;
  }

  // 发布消息
  async publishMessage(message: PublishMessage): Promise<ApiResponse> {
    const response = await this.client.post('/mqtt/publish', message);
    return response.data;
  }

  // 批量发布消息
  async publishBatch(messages: PublishBatchItem[]): Promise<ApiResponse<{ data: Array<{ topic: string; code: number }>; code: number }>> {
    const response = await this.client.post('/mqtt/publish_batch', messages);
    return response.data;
  }

  // 获取主题树
  async getTopicTree(): Promise<TopicTreeNode[][]> {
    const response = await this.client.get('/topic-tree');
    return response.data.data;
  }

  // 获取热更新配置
  async getReloadConfig(): Promise<ReloadConfig> {
    const response = await this.client.get('/reload');
    return response.data.data;
  }

  // 设置热更新配置
  async setReloadConfig(data: ReloadConfig): Promise<ApiResponse> {
    const response = await this.client.post('/reload', { data });
    return response.data;
  }

  // 更新配置文件（HOCON 文本）
  async configUpdate(hoconText: string): Promise<ApiResponse> {
    const response = await this.client.post('/config_update', hoconText, {
      headers: { 'Content-Type': 'text/plain' },
    });
    return response.data;
  }

  /** 读取任意路径文件（HOCON 文本）；或 default=true 读取主 nanomq.conf */
  async getFile(params: { path?: string; default?: boolean }): Promise<ApiResponse<GetFileResponse>> {
    const response = await this.client.get('/get_file', { params });
    return response.data;
  }

  /** 写入文件；content 须为可被 NanoMQ HOCON 解析的文本 */
  async writeFile(path: string, content: string): Promise<ApiResponse> {
    const response = await this.client.post('/write_file', { data: { path, content } });
    return response.data;
  }

  /** 热更新 auth（引用 include 路径等），不修改磁盘上的主 nanomq.conf */
  async setConfigurationAuth(payload: Record<string, unknown>): Promise<ApiResponse> {
    const response = await this.client.post('/configuration/auth', payload);
    return response.data;
  }

  async getConfigurationAuth(): Promise<ApiResponse<{ auth: unknown[] }>> {
    const response = await this.client.get('/configuration/auth');
    return response.data;
  }

  // 获取桥接配置（全部）
  async getBridges(): Promise<ApiResponse<BridgeConfigResponse>> {
    const response = await this.client.get('/bridges');
    return response.data;
  }

  // 获取桥接配置（按名称）
  async getBridgeByName(bridgeName: string): Promise<ApiResponse<BridgeConfigResponse>> {
    const response = await this.client.get(`/bridges/${encodeURIComponent(bridgeName)}`);
    return response.data;
  }

  // 动态更新桥接配置（触发重连）
  async updateBridge(bridgeName: string, payload: Record<string, unknown>): Promise<ApiResponse> {
    const response = await this.client.put(`/bridges/${encodeURIComponent(bridgeName)}`, payload);
    return response.data;
  }

  // 动态新增桥接订阅主题
  async addBridgeSubscriptions(bridgeName: string, payload: Record<string, unknown>): Promise<ApiResponse> {
    const response = await this.client.put(`/bridges/sub/${encodeURIComponent(bridgeName)}`, payload);
    return response.data;
  }

  // 动态删除桥接订阅主题
  async removeBridgeSubscriptions(bridgeName: string, payload: Record<string, unknown>): Promise<ApiResponse> {
    const response = await this.client.put(`/bridges/unsub/${encodeURIComponent(bridgeName)}`, payload);
    return response.data;
  }

  // 规则：获取列表
  async getRules(params?: { enabled?: boolean }): Promise<ApiResponse<RuleInfo[]>> {
    const response = await this.client.get('/rules', { params });
    return response.data;
  }

  // 规则：获取详情
  async getRule(ruleId: string): Promise<ApiResponse<RuleInfo>> {
    const response = await this.client.get(`/rules/${encodeURIComponent(ruleId)}`);
    return response.data;
  }

  // 规则：创建
  async createRule(payload: {
    rawsql: string;
    actions: RuleAction[];
    description?: string;
  }): Promise<ApiResponse<RuleInfo>> {
    const response = await this.client.post('/rules', payload);
    return response.data;
  }

  // 规则：更新（enabled/rawsql/actions/description 等）
  async updateRule(ruleId: string, payload: Partial<{ rawsql: string; actions: RuleAction[]; description: string; enabled: boolean }>): Promise<ApiResponse<RuleInfo>> {
    const response = await this.client.put(`/rules/${encodeURIComponent(ruleId)}`, payload);
    return response.data;
  }

  // 规则：删除
  async deleteRule(ruleId: string): Promise<ApiResponse> {
    const response = await this.client.delete(`/rules/${encodeURIComponent(ruleId)}`);
    return response.data;
  }

  // 获取配置
  async getConfiguration(): Promise<ApiResponse<Record<string, unknown>>> {
    const response = await this.client.get('/configuration');
    return response.data;
  }

  // 设置配置
  async setConfiguration(config: Record<string, unknown>): Promise<ApiResponse> {
    const response = await this.client.post('/configuration', config);
    return response.data;
  }

  // 控制 Broker（停止或重启）
  async controlBroker(action: 'stop' | 'restart'): Promise<ApiResponse> {
    const response = await this.client.post(`/ctrl/${action}`);
    return response.data;
  }
}

// 导出单例实例
export const nanomqAPI = new NanoMQAPI();
export default nanomqAPI;