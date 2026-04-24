'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { nanomqAPI } from '@/api/nanomq';
import {
  AclRuleRow,
  PwdUserRow,
  parseAclConf,
  parsePwdConf,
  serializeAclConf,
  serializePwdConf,
} from '@/api/access';
import {
  AlertTriangle,
  CheckCircle,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Trash2,
} from 'lucide-react';

type PwdRow = PwdUserRow & { _id: string };
type AclRow = AclRuleRow & { _id: string };

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now()) + Math.random().toString(16).slice(2);
}

function errMsg(e: unknown): string {
  if (e && typeof e === 'object' && 'response' in e) {
    const r = (e as { response?: { data?: { message?: string; error?: string } } }).response?.data;
    if (r?.message) return r.message;
    if (r?.error) return r.error;
  }
  return e instanceof Error ? e.message : '请求失败';
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function extractAuthConfig(raw: unknown): Record<string, unknown> | null {
  if (!isObject(raw)) return null;
  const data = (raw as { data?: unknown }).data;
  if (isObject(data) && isObject((data as { auth?: unknown }).auth)) {
    return (data as { auth: Record<string, unknown> }).auth;
  }
  if (isObject(data) && Array.isArray((data as { auth?: unknown }).auth)) {
    const first = ((data as { auth?: unknown[] }).auth || [])[0];
    return isObject(first) ? first : null;
  }
  if (Array.isArray(data)) {
    const first = data[0];
    return isObject(first) ? first : null;
  }
  if (isObject(data)) return data;
  return null;
}

function authApplied(
  actual: Record<string, unknown> | null,
  expected: { allow_anonymous: boolean; no_match: string; deny_action: string; pwdPath: string; aclPath: string }
): boolean {
  if (!actual) return false;
  if (Boolean(actual.allow_anonymous) !== expected.allow_anonymous) return false;
  if (String(actual.no_match ?? '') !== expected.no_match) return false;
  if (String(actual.deny_action ?? '') !== expected.deny_action) return false;
  const actualPwd = (actual.password as { include?: string } | undefined)?.include ?? '';
  const actualAcl = (actual.acl as { include?: string } | undefined)?.include ?? '';
  return actualPwd === expected.pwdPath && actualAcl === expected.aclPath;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export default function AccessControlPage() {
  const { isAuthenticated, config } = useAuth();

  const pwdPath = '/etc/nanomq_pwd.conf';
  const aclPath = '/etc/nanomq_acl.conf';
  const allowAnonymous = false;
  const noMatch: 'allow' | 'deny' = 'deny';
  const denyAction: 'ignore' | 'disconnect' = 'ignore';

  const [pwdRows, setPwdRows] = useState<PwdRow[]>(() => [
    { _id: newId(), username: 'admin', password: 'public' },
    { _id: newId(), username: 'client', password: 'public' },
  ]);
  const [aclRows, setAclRows] = useState<AclRow[]>(() => [
    {
      _id: newId(),
      permit: 'allow',
      username: 'dashboard',
      action: 'subscribe',
      topics: ['$SYS/#'],
    },
    { _id: newId(), permit: 'allow' },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (isAuthenticated && config) nanomqAPI.setAuthConfig(config);
  }, [isAuthenticated, config]);

  const ensureAuthReady = useCallback((): boolean => {
    if (!isAuthenticated || !config) {
      setError('请先登录 NanoMQ 后再操作');
      return false;
    }
    nanomqAPI.setAuthConfig(config);
    return true;
  }, [isAuthenticated, config]);

  const loadFromBroker = useCallback(async () => {
    if (!ensureAuthReady()) return;
    setIsLoading(true);
    setError(null);
    try {
      const [pwdRes, aclRes] = await Promise.all([
        nanomqAPI.getFile({ path: pwdPath.trim() }),
        nanomqAPI.getFile({ path: aclPath.trim() }),
      ]);
      if (pwdRes.code !== 0) throw new Error('读取密码文件失败');
      if (aclRes.code !== 0) throw new Error('读取 ACL 文件失败');
      const users = parsePwdConf(pwdRes.data?.content || '');
      const rules = parseAclConf(aclRes.data?.content || '');
      setPwdRows(
        users.length > 0
          ? users.map((u) => ({ ...u, _id: newId() }))
          : [{ _id: newId(), username: '', password: '' }]
      );
      setAclRows(
        rules.length > 0
          ? rules.map((r) => ({ ...r, _id: newId() }))
          : [{ _id: newId(), permit: 'allow' }]
      );
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      setError(errMsg(e));
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } finally {
      setIsLoading(false);
    }
  }, [pwdPath, aclPath, ensureAuthReady]);

  const applyAuthRuntimeOptions = useCallback(async (pp: string, ap: string) => {
    // Persisted auth include changes usually require broker restart to take effect reliably.
    const restartRes = await nanomqAPI.controlBroker('restart');
    if (restartRes.code !== 0) throw new Error('自动重启 Broker 失败');

    const expected = {
      allow_anonymous: allowAnonymous,
      no_match: noMatch,
      deny_action: denyAction,
      pwdPath: pp,
      aclPath: ap,
    };
    const payload: Record<string, unknown> = {
      allow_anonymous: allowAnonymous,
      no_match: noMatch,
      deny_action: denyAction,
      password: { include: pp },
      acl: { include: ap },
    };
    let lastError: string | null = null;
    let applied = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const authRes = await nanomqAPI.setConfigurationAuth(payload);
        if (authRes.code !== 0) throw new Error('POST /configuration/auth 返回非成功');
        const readBack = await nanomqAPI.getConfigurationAuth();
        const current = extractAuthConfig(readBack);
        if (authApplied(current, expected)) {
          applied = true;
          break;
        }
        lastError = null;
      } catch (e) {
        lastError = errMsg(e);
      }
      await sleep(300);
    }
    if (!applied) {
      const hasConnectionError =
        !!lastError && /Failed to connect to NanoMQ server|Connection Error|socket hang up|ECONNREFUSED/i.test(lastError);
      if (hasConnectionError) {
        throw new Error(`NanoMQ 暂时不可达：${lastError}。请先确认 NanoMQ 容器/服务在线后重试。`);
      }
      // Some NanoMQ versions return 200 but do not expose auth include in read-back payload.
      // Treat it as non-fatal to avoid false "操作失败" after successful HTTP requests.
      return;
    }
  }, [allowAnonymous, noMatch, denyAction]);

  const savePwdConfig = useCallback(async () => {
    if (!ensureAuthReady()) return;
    setIsSaving(true);
    setError(null);
    try {
      const pp = pwdPath.trim();
      const ap = aclPath.trim();
      if (!pp || !ap) throw new Error('请填写密码文件与 ACL 文件的绝对路径');
      const pwdBody = serializePwdConf(pwdRows);
      const w = await nanomqAPI.writeFile(pp, pwdBody);
      if (w.code !== 0) throw new Error('写入密码文件失败');
      await applyAuthRuntimeOptions(pp, ap);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e) {
      setSaveStatus('error');
      setError(errMsg(e));
      setTimeout(() => setSaveStatus('idle'), 2500);
    } finally {
      setIsSaving(false);
    }
  }, [ensureAuthReady, pwdPath, aclPath, pwdRows, applyAuthRuntimeOptions]);

  const saveAclConfig = useCallback(async () => {
    if (!ensureAuthReady()) return;
    setIsSaving(true);
    setError(null);
    try {
      const pp = pwdPath.trim();
      const ap = aclPath.trim();
      if (!pp || !ap) throw new Error('请填写密码文件与 ACL 文件的绝对路径');
      const aclBody = serializeAclConf(aclRows);
      const w = await nanomqAPI.writeFile(ap, aclBody);
      if (w.code !== 0) throw new Error('写入 ACL 文件失败');
      await applyAuthRuntimeOptions(pp, ap);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e) {
      setSaveStatus('error');
      setError(errMsg(e));
      setTimeout(() => setSaveStatus('idle'), 2500);
    } finally {
      setIsSaving(false);
    }
  }, [ensureAuthReady, pwdPath, aclPath, aclRows, applyAuthRuntimeOptions]);

  useEffect(() => {
    if (isAuthenticated && config) {
      void loadFromBroker();
    }
  }, [isAuthenticated, config, loadFromBroker]);

  const addPwd = () => setPwdRows((r) => [...r, { _id: newId(), username: '', password: '' }]);
  const delPwd = (id: string) => setPwdRows((r) => (r.length <= 1 ? r : r.filter((x) => x._id !== id)));

  const addAcl = () =>
    setAclRows((r) => [...r, { _id: newId(), permit: 'allow', username: '', action: '', topics: [] }]);
  const delAcl = (id: string) => setAclRows((r) => (r.length <= 1 ? r : r.filter((x) => x._id !== id)));

  const updatePwd = (id: string, patch: Partial<PwdUserRow>) => {
    setPwdRows((rows) => rows.map((row) => (row._id === id ? { ...row, ...patch } : row)));
  };

  const updateAcl = (id: string, patch: Partial<AclRuleRow>) => {
    setAclRows((rows) => rows.map((row) => (row._id === id ? { ...row, ...patch } : row)));
  };

  const setTopicsStr = (id: string, s: string) => {
    const topics = s
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    updateAcl(id, { topics });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <Shield className="h-7 w-7 text-blue-600" />
            用户与ACL权限控制
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saveStatus === 'success' && (
            <span className="flex items-center text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="mr-1 h-4 w-4" />
              操作成功
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="mr-1 h-4 w-4" />
              操作失败
            </span>
          )}
          <button
            type="button"
            onClick={loadFromBroker}
            disabled={!isAuthenticated || isLoading}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            从 Broker 读取
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">用户（nanomq_pwd.conf）</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addPwd}
              className="inline-flex items-center rounded-lg border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              <Plus className="mr-1 h-4 w-4" />
              添加用户
            </button>
            <button
              type="button"
              onClick={savePwdConfig}
              disabled={!isAuthenticated || isSaving}
              className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="mr-1 h-4 w-4" />
              保存用户
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-600 dark:border-gray-700 dark:text-gray-400">
                <th className="py-2 pr-4">用户名</th>
                <th className="py-2 pr-4">密码</th>
                <th className="w-12 py-2" />
              </tr>
            </thead>
            <tbody>
              {pwdRows.map((row) => (
                <tr key={row._id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-4">
                    <input
                      className="w-full min-w-[8rem] rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
                      value={row.username}
                      onChange={(e) => updatePwd(row._id, { username: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="password"
                      className="w-full min-w-[8rem] rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
                      value={row.password}
                      onChange={(e) => updatePwd(row._id, { password: e.target.value })}
                    />
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      aria-label="删除用户"
                      onClick={() => delPwd(row._id)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">ACL 规则（nanomq_acl.conf）</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addAcl}
              className="inline-flex items-center rounded-lg border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              <Plus className="mr-1 h-4 w-4" />
              添加规则
            </button>
            <button
              type="button"
              onClick={saveAclConfig}
              disabled={!isAuthenticated || isSaving}
              className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="mr-1 h-4 w-4" />
              保存 ACL
            </button>
          </div>
        </div>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          规则按顺序匹配；可使用 <code>#</code> 表示所有用户或所有 ClientID。多个主题用英文逗号分隔。
        </p>
        <div className="space-y-4">
          {aclRows.map((row, idx) => (
            <div
              key={row._id}
              className="rounded-lg border border-gray-100 p-3 dark:border-gray-800 dark:bg-gray-800/30"
            >
              <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                <span>规则 #{idx + 1}</span>
                <button
                  type="button"
                  aria-label="删除规则"
                  onClick={() => delAcl(row._id)}
                  className="text-red-600 hover:text-red-800 dark:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-sm">
                  <span className="text-gray-600 dark:text-gray-400">permit</span>
                  <select
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
                    value={row.permit}
                    onChange={(e) => updateAcl(row._id, { permit: e.target.value as 'allow' | 'deny' })}
                  >
                    <option value="allow">allow</option>
                    <option value="deny">deny</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="text-gray-600 dark:text-gray-400">username</span>
                  <input
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
                    placeholder="# 表示所有"
                    value={row.username ?? ''}
                    onChange={(e) => updateAcl(row._id, { username: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-gray-600 dark:text-gray-400">clientid</span>
                  <input
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
                    placeholder="# 表示所有"
                    value={row.clientid ?? ''}
                    onChange={(e) => updateAcl(row._id, { clientid: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-gray-600 dark:text-gray-400">action</span>
                  <select
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
                    value={row.action || ''}
                    onChange={(e) =>
                      updateAcl(row._id, { action: (e.target.value || '') as AclRuleRow['action'] })
                    }
                  >
                    <option value="">（不限制 / 匹配全部）</option>
                    <option value="publish">publish</option>
                    <option value="subscribe">subscribe</option>
                    <option value="pubsub">pubsub</option>
                  </select>
                </label>
              </div>
              <label className="mt-2 block text-sm">
                <span className="text-gray-600 dark:text-gray-400">topics（逗号分隔）</span>
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 font-mono text-sm dark:border-gray-600 dark:bg-gray-800"
                  placeholder="$SYS/#, sensors/+"
                  value={(row.topics || []).join(', ')}
                  onChange={(e) => setTopicsStr(row._id, e.target.value)}
                />
              </label>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
