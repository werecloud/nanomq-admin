'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { nanomqAPI, RuleAction, RuleInfo } from '@/api/nanomq';
import { RefreshCw, Plus, Trash2, Save, AlertTriangle } from 'lucide-react';

type DraftRule = {
  rawsql: string;
  actionsJson: string; // JSON 字符串（数组）
  description: string;
};

export default function RulesPage() {
  const { isAuthenticated, config } = useAuth();
  const [rules, setRules] = useState<RuleInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [draft, setDraft] = useState<DraftRule>({
    rawsql: 'select * from "#"',
    actionsJson: '[]',
    description: '',
  });

  useEffect(() => {
    if (isAuthenticated && config) nanomqAPI.setAuthConfig(config);
  }, [isAuthenticated, config]);

  const selectedRule = useMemo(() => rules.find((r) => String(r.id) === selectedRuleId) || null, [rules, selectedRuleId]);

  const loadRules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await nanomqAPI.getRules();
      setRules(Array.isArray(resp.data) ? resp.data : []);
      if (!selectedRuleId && Array.isArray(resp.data) && resp.data[0]) {
        setSelectedRuleId(String(resp.data[0].id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载规则失败');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRuleId]);

  useEffect(() => {
    if (isAuthenticated) loadRules();
  }, [isAuthenticated, loadRules]);

  const createRule = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const actions = JSON.parse(draft.actionsJson) as RuleAction[];
      if (!Array.isArray(actions)) throw new Error('actions 必须是 JSON 数组');
      const resp = await nanomqAPI.createRule({
        rawsql: draft.rawsql,
        actions,
        description: draft.description || undefined,
      });
      await loadRules();
      if (resp.data?.id !== undefined) setSelectedRuleId(String(resp.data.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建规则失败');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRule = async (enabled: boolean) => {
    if (!selectedRule) return;
    setIsSaving(true);
    setError(null);
    try {
      await nanomqAPI.updateRule(String(selectedRule.id), { enabled });
      await loadRules();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新规则失败');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRule = async () => {
    if (!selectedRule) return;
    setIsSaving(true);
    setError(null);
    try {
      await nanomqAPI.deleteRule(String(selectedRule.id));
      setSelectedRuleId('');
      await loadRules();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除规则失败');
    } finally {
      setIsSaving(false);
    }
  };

  const actionExample =
    '[{"name":"repub","params":{"topic":"repub1","address":"mqtt-tcp://broker.emqx.io:1883","proto_ver":4}}]';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">规则引擎</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">基于 NanoMQ v4 `/rules` 管理规则</p>
        </div>
        <button
          onClick={loadRules}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">规则列表</h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">{rules.length}</span>
          </div>
          <div className="p-2 max-h-[70vh] overflow-auto">
            {rules.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 dark:text-gray-400">暂无规则</div>
            ) : (
              rules.map((r) => {
                const id = String(r.id);
                const active = id === selectedRuleId;
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedRuleId(id)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">rule:{id}</div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          r.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {r.enabled ? 'enabled' : 'disabled'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{r.rawsql}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">创建规则</h2>
              <button
                onClick={createRule}
                disabled={isSaving}
                className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                创建
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">rawsql *</label>
                <input
                  value={draft.rawsql}
                  onChange={(e) => setDraft((p) => ({ ...p, rawsql: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">actions（JSON 数组）*</label>
                <textarea
                  value={draft.actionsJson}
                  onChange={(e) => setDraft((p) => ({ ...p, actionsJson: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">description（可选）</label>
                <input
                  value={draft.description}
                  onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                动作示例：
                <code className="ml-1 font-mono">{actionExample}</code>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">当前规则</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleRule(true)}
                  disabled={!selectedRule || isSaving}
                  className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  启用
                </button>
                <button
                  onClick={() => toggleRule(false)}
                  disabled={!selectedRule || isSaving}
                  className="flex items-center px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  停用
                </button>
                <button
                  onClick={deleteRule}
                  disabled={!selectedRule || isSaving}
                  className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  删除
                </button>
              </div>
            </div>

            <div className="mt-4">
              {!selectedRule ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  请选择左侧规则
                  {rules.length === 0 ? '（当前暂无规则）' : ''}
                </div>
              ) : (
                <pre className="text-xs leading-5 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-4 overflow-auto max-h-[45vh]">
                  {JSON.stringify(selectedRule, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

