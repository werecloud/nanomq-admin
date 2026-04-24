'use client';

import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Database,
  Zap,
} from 'lucide-react';
import { nanomqAPI, ReloadConfig } from '@/api/nanomq';
import { useAuth } from '@/context/AuthContext';

const stripNullChars = (text: string) => text.replace(/\u0000/g, '');
const reloadNumberFields = [
  'property_size',
  'msq_len',
  'qos_duration',
  'max_packet_size',
  'client_max_packet_size',
  'keepalive_backoff',
] as const;
const reloadBooleanFields = ['allow_anonymous'] as const;
const reloadFieldOrder = [...reloadNumberFields, ...reloadBooleanFields] as const;

const ConfigurationPage: React.FC = () => {
  const { isAuthenticated, config } = useAuth();
  const [activeTab, setActiveTab] = useState<'reload' | 'config_update'>('config_update');

  const [reloadConfig, setReloadConfig] = useState<ReloadConfig | null>(null);
  const [reloadDraft, setReloadDraft] = useState<ReloadConfig | null>(null);
  const [hoconText, setHoconText] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [nullCharWarn, setNullCharWarn] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && config) nanomqAPI.setAuthConfig(config);
  }, [isAuthenticated, config]);

  const loadAll = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [reload, mainConf] = await Promise.all([
        nanomqAPI.getReloadConfig(),
        nanomqAPI.getFile({ default: true }),
      ]);
      setReloadConfig(reload);
      const normalizedReload: ReloadConfig = { ...reload };
      reloadNumberFields.forEach((key) => {
        const v = normalizedReload[key];
        if (typeof v !== 'number') normalizedReload[key] = Number(v ?? 0);
      });
      reloadBooleanFields.forEach((key) => {
        normalizedReload[key] = Boolean(normalizedReload[key]);
      });
      setReloadDraft(normalizedReload);
      const rawMainConf = mainConf.data?.content || '';
      const cleanedMainConf = stripNullChars(rawMainConf);
      setHoconText(cleanedMainConf);
      setNullCharWarn(
        rawMainConf.length === cleanedMainConf.length
          ? null
          : '检测到配置内容包含 NUL(\\0) 字符，已自动清理后回填。'
      );
      setSaveStatus('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载配置失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadAll();
  }, [isAuthenticated]);

  const saveReload = async () => {
    if (!reloadDraft) return;
    setIsSaving(true);
    setError(null);
    try {
      await nanomqAPI.setReloadConfig(reloadDraft);
      setSaveStatus('success');
      await loadAll();
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e) {
      setSaveStatus('error');
      setError(e instanceof Error ? e.message : '保存热更新配置失败');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  const saveConfigUpdate = async () => {
    const cleaned = stripNullChars(hoconText);
    if (cleaned !== hoconText) {
      setHoconText(cleaned);
      setNullCharWarn('检测到配置内容包含 NUL(\\0) 字符，提交前已自动清理。');
    }
    const text = cleaned.trim();
    if (!text) {
      setError('请输入 HOCON 配置内容');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await nanomqAPI.configUpdate(text);
      setSaveStatus('success');
      await loadAll();
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e) {
      setSaveStatus('error');
      setError(e instanceof Error ? e.message : '配置文件更新失败');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  const fillConfigEditorWithMainConf = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const mainConf = await nanomqAPI.getFile({ default: true });
      const rawMainConf = mainConf.data?.content || '';
      const cleanedMainConf = stripNullChars(rawMainConf);
      setHoconText(cleanedMainConf);
      setNullCharWarn(
        rawMainConf.length === cleanedMainConf.length
          ? null
          : '检测到配置内容包含 NUL(\\0) 字符，已自动清理后回填。'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '回填主配置失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">系统配置</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            基于 NanoMQ v4 HTTP API 获取/更新真实配置
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {saveStatus === 'success' && (
            <div className="flex items-center text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4 mr-2" />
              <span className="text-sm">保存成功</span>
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <span className="text-sm">保存失败</span>
            </div>
          )}
          <button
            onClick={loadAll}
            disabled={isLoading || isSaving}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-red-800 dark:text-red-200">操作失败</h4>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('reload')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'reload'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            热更新参数（/reload）
          </button>
          <button
            onClick={() => setActiveTab('config_update')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'config_update'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            配置文件更新（/config_update）
          </button>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center text-gray-600 dark:text-gray-400">
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              加载中...
            </div>
          ) : activeTab === 'reload' ? (
            <div className="space-y-4">
              <div className="flex items-center text-gray-700 dark:text-gray-300">
                <Zap className="w-5 h-5 mr-2" />
                <span className="font-medium">GET/POST /api/v4/reload</span>
              </div>

              {!reloadDraft ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">暂无数据</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reloadFieldOrder.map((key) => (
                    <div key={key} className="space-y-1">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{key}</label>
                      {key === 'allow_anonymous' ? (
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(reloadDraft[key])}
                            onChange={(e) =>
                              setReloadDraft((prev) => (prev ? { ...prev, [key]: e.target.checked } : prev))
                            }
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {reloadDraft[key] ? 'true' : 'false'}
                          </span>
                        </label>
                      ) : (
                        <input
                          type="number"
                          value={String((reloadDraft[key] as number | undefined) ?? 0)}
                          onChange={(e) =>
                            setReloadDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    [key]: e.target.value === '' ? 0 : Number(e.target.value),
                                  }
                                : prev
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      )}
                      <div className="text-xs text-gray-500 dark:text-gray-400">当前值：{String(reloadConfig?.[key])}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={saveReload}
                  disabled={isSaving || !reloadDraft}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isSaving ? 'animate-spin' : ''}`} />
                  {isSaving ? '保存中...' : '保存热更新参数'}
                </button>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                提示：热更新仅覆盖 NanoMQ 暴露的可动态修改项；其余配置请使用配置文件更新或重启生效。
              </div>

            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center text-gray-700 dark:text-gray-300">
                <Database className="w-5 h-5 mr-2" />
                <span className="font-medium">POST /api/v4/config_update（HOCON 文本）</span>
              </div>
              <textarea
                value={hoconText}
                onChange={(e) => setHoconText(stripNullChars(e.target.value))}
                placeholder="粘贴/编辑 HOCON 配置内容（将写入配置文件）..."
                className="w-full min-h-[320px] font-mono text-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {nullCharWarn && (
                <div className="text-xs text-amber-700 dark:text-amber-300">{nullCharWarn}</div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={fillConfigEditorWithMainConf}
                  disabled={isLoading || isSaving}
                  className="flex items-center mr-3 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  回填当前主配置
                </button>
                <button
                  onClick={saveConfigUpdate}
                  disabled={isSaving || !hoconText.trim()}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isSaving ? 'animate-spin' : ''}`} />
                  {isSaving ? '提交中...' : '提交配置文件更新'}
                </button>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">注意</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      该操作会更新 NanoMQ 配置文件；通常需要配合重启或相关机制才会完全生效。请确认内容正确后再提交。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigurationPage;