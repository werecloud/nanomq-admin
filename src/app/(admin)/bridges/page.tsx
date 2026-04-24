'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { nanomqAPI } from '@/api/nanomq';
import { RefreshCw, Save, AlertTriangle } from 'lucide-react';

type BridgeNode = {
  name?: string;
  enable?: boolean;
  [key: string]: unknown;
};

type BridgesData = {
  bridge?: {
    nodes?: BridgeNode[];
  };
  [key: string]: unknown;
};

export default function BridgesPage() {
  const { isAuthenticated, config } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bridges, setBridges] = useState<BridgesData | null>(null);
  const [bridgeName, setBridgeName] = useState('');
  const [payloadJson, setPayloadJson] = useState('{}');

  useEffect(() => {
    if (isAuthenticated && config) nanomqAPI.setAuthConfig(config);
  }, [isAuthenticated, config]);

  const loadBridges = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await nanomqAPI.getBridges();
      const data = (resp.data || null) as BridgesData | null;
      setBridges(data);
      const firstName = data?.bridge?.nodes?.[0]?.name && typeof data.bridge.nodes[0].name === 'string' ? data.bridge.nodes[0].name : '';
      if (!bridgeName && firstName) setBridgeName(firstName);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载桥接配置失败');
    } finally {
      setIsLoading(false);
    }
  }, [bridgeName]);

  useEffect(() => {
    if (isAuthenticated) loadBridges();
  }, [isAuthenticated, loadBridges]);

  const selectedBridge = useMemo(() => {
    const nodes = bridges?.bridge?.nodes;
    if (!Array.isArray(nodes)) return null;
    return nodes.find((n) => n?.name === bridgeName) || null;
  }, [bridges, bridgeName]);

  const updateBridge = async () => {
    if (!bridgeName.trim()) {
      setError('请输入 bridge_name');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload = JSON.parse(payloadJson) as Record<string, unknown>;
      await nanomqAPI.updateBridge(bridgeName.trim(), payload);
      await loadBridges();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新桥接失败（请检查 JSON）');
    } finally {
      setIsSaving(false);
    }
  };

  const addSubscriptions = async () => {
    if (!bridgeName.trim()) {
      setError('请输入 bridge_name');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload = JSON.parse(payloadJson) as Record<string, unknown>;
      await nanomqAPI.addBridgeSubscriptions(bridgeName.trim(), payload);
      await loadBridges();
    } catch (e) {
      setError(e instanceof Error ? e.message : '新增订阅失败（请检查 JSON）');
    } finally {
      setIsSaving(false);
    }
  };

  const removeSubscriptions = async () => {
    if (!bridgeName.trim()) {
      setError('请输入 bridge_name');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload = JSON.parse(payloadJson) as Record<string, unknown>;
      await nanomqAPI.removeBridgeSubscriptions(bridgeName.trim(), payload);
      await loadBridges();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除订阅失败（请检查 JSON）');
    } finally {
      setIsSaving(false);
    }
  };

  const dataExample = '{"data": {...}}';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">桥接管理</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">基于 NanoMQ v4 `/bridges` 动态更新桥接配置</p>
        </div>
        <button
          onClick={loadBridges}
          disabled={isLoading || isSaving}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3" />
            <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">当前桥接配置（只读）</h2>
          <pre className="text-xs leading-5 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-4 overflow-auto max-h-[70vh]">
            {bridges ? JSON.stringify(bridges, null, 2) : '暂无数据'}
          </pre>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">操作</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">bridge_name</label>
                <input
                  value={bridgeName}
                  onChange={(e) => setBridgeName(e.target.value)}
                  placeholder="例如: emqx"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {selectedBridge && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    已选择：{selectedBridge.name}（enable: {String(selectedBridge.enable)}）
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">payload（JSON）</label>
                <textarea
                  value={payloadJson}
                  onChange={(e) => setPayloadJson(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-xs"
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  - 更新桥接：PUT <code className="font-mono">/api/v4/bridges/{'{'}bridge_name{'}'}</code>（payload 顶层 key 需与 bridge_name 一致，按文档示例）
                  <br />
                  - 新增订阅：PUT <code className="font-mono">/api/v4/bridges/sub/{'{'}bridge_name{'}'}</code>（payload 形如 <code className="font-mono">{dataExample}</code>）
                  <br />
                  - 删除订阅：PUT <code className="font-mono">/api/v4/bridges/unsub/{'{'}bridge_name{'}'}</code>（payload 形如 <code className="font-mono">{dataExample}</code>）
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  onClick={updateBridge}
                  disabled={isSaving}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  更新桥接
                </button>
                <button
                  onClick={addSubscriptions}
                  disabled={isSaving}
                  className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  新增订阅
                </button>
                <button
                  onClick={removeSubscriptions}
                  disabled={isSaving}
                  className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  删除订阅
                </button>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3" />
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                动态更新桥接配置会触发桥接重连（具体行为以文档说明为准）。请谨慎在生产环境操作。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

