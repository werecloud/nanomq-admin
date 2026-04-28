<template>
  <div class="nanomq-page">
    <PageHeader :title="t('nanomq.access.title')">
      <template #icon><icon-safe /></template>
      <template #actions>
        <a-button
          type="primary"
          :loading="isLoading"
          :disabled="isSaving"
          @click="loadFromBroker"
        >
          <template #icon><icon-refresh /></template>
          {{ t('nanomq.access.readBroker') }}
        </a-button>
      </template>
    </PageHeader>

    <a-alert
      v-if="error"
      class="nanomq-section"
      type="error"
      show-icon
      :content="error"
    />

    <a-card
      class="nanomq-section"
      :title="t('nanomq.access.users')"
      :bordered="false"
    >
      <template #extra>
        <a-space wrap>
          <a-button @click="addPwd">
            <template #icon><icon-plus /></template>
            {{ t('nanomq.access.addUser') }}
          </a-button>
          <a-button type="primary" :loading="isSaving" @click="savePwdConfig">
            <template #icon><icon-save /></template>
            {{ t('nanomq.access.saveUsers') }}
          </a-button>
        </a-space>
      </template>
      <a-table
        row-key="rowKey"
        :columns="pwdColumns"
        :data="pwdRows"
        :pagination="false"
        :scroll="{ x: 680 }"
      >
        <template #username="{ record }">
          <a-input
            :model-value="record.username"
            @update:model-value="setPwdUsername(record.rowKey, $event)"
          />
        </template>
        <template #password="{ record }">
          <a-input-password
            :model-value="record.password"
            @update:model-value="setPwdPassword(record.rowKey, $event)"
          />
        </template>
        <template #actions="{ record }">
          <a-button status="danger" type="text" @click="delPwd(record.rowKey)">
            <template #icon><icon-delete /></template>
          </a-button>
        </template>
      </a-table>
    </a-card>

    <a-card
      class="nanomq-section"
      :title="t('nanomq.access.rules')"
      :bordered="false"
    >
      <template #extra>
        <a-space wrap>
          <a-button @click="addAcl">
            <template #icon><icon-plus /></template>
            {{ t('nanomq.access.addRule') }}
          </a-button>
          <a-button type="primary" :loading="isSaving" @click="saveAclConfig">
            <template #icon><icon-save /></template>
            {{ t('nanomq.access.saveAcl') }}
          </a-button>
        </a-space>
      </template>
      <a-alert
        type="info"
        show-icon
        content="Rules are matched top-to-bottom. Use # for all users or all client IDs. Split multiple topics with commas."
      />
      <a-space class="nanomq-section" direction="vertical" fill :size="12">
        <a-card
          v-for="(row, index) in aclRows"
          :key="row.rowKey"
          :bordered="true"
        >
          <template #title>Rule #{{ index + 1 }}</template>
          <template #extra>
            <a-button status="danger" type="text" @click="delAcl(row.rowKey)">
              <template #icon><icon-delete /></template>
            </a-button>
          </template>
          <div class="nanomq-form-grid">
            <a-form-item label="permit">
              <a-select
                :model-value="row.permit"
                @update:model-value="setAclPermit(row.rowKey, $event)"
              >
                <a-option value="allow">allow</a-option>
                <a-option value="deny">deny</a-option>
              </a-select>
            </a-form-item>
            <a-form-item label="username">
              <a-input
                :model-value="row.username || ''"
                placeholder="#"
                @update:model-value="setAclUsername(row.rowKey, $event)"
              />
            </a-form-item>
            <a-form-item label="clientid">
              <a-input
                :model-value="row.clientid || ''"
                placeholder="#"
                @update:model-value="setAclClientId(row.rowKey, $event)"
              />
            </a-form-item>
            <a-form-item label="action">
              <a-select
                :model-value="row.action || ''"
                @update:model-value="setAclAction(row.rowKey, $event)"
              >
                <a-option value="">all</a-option>
                <a-option value="publish">publish</a-option>
                <a-option value="subscribe">subscribe</a-option>
                <a-option value="pubsub">pubsub</a-option>
              </a-select>
            </a-form-item>
          </div>
          <a-form-item label="topics">
            <a-input
              :model-value="(row.topics || []).join(', ')"
              placeholder="$SYS/#, sensors/+"
              @update:model-value="setTopicsStr(row.rowKey, String($event))"
            />
          </a-form-item>
        </a-card>
      </a-space>
    </a-card>
  </div>
</template>

<script lang="ts" setup>
  import { computed, onMounted, ref } from 'vue';
  import { Message } from '@arco-design/web-vue';
  import { useI18n } from 'vue-i18n';
  import {
    AclRuleRow,
    PwdUserRow,
    parseAclConf,
    parsePwdConf,
    serializeAclConf,
    serializePwdConf,
  } from '@/api/access';
  import { nanomqAPI } from '@/api/nanomq';
  import PageHeader from '../components/page-header.vue';
  import { errorMessage, uniqueId } from '../utils';

  type PwdRow = PwdUserRow & { rowKey: string };
  type AclRow = AclRuleRow & { rowKey: string };

  const { t } = useI18n();
  const pwdPath = '/etc/nanomq_pwd.conf';
  const aclPath = '/etc/nanomq_acl.conf';
  const allowAnonymous = false;
  const noMatch: 'allow' | 'deny' = 'deny';
  const denyAction: 'ignore' | 'disconnect' = 'ignore';
  const pwdRows = ref<PwdRow[]>([
    { rowKey: uniqueId(), username: 'admin', password: 'public' },
    { rowKey: uniqueId(), username: 'client', password: 'public' },
  ]);
  const aclRows = ref<AclRow[]>([
    {
      rowKey: uniqueId(),
      permit: 'allow',
      username: 'dashboard',
      action: 'subscribe',
      topics: ['$SYS/#'],
    },
    { rowKey: uniqueId(), permit: 'allow' },
  ]);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const error = ref<string | null>(null);
  const pwdColumns = computed(() => [
    { title: 'username', slotName: 'username' },
    { title: 'password', slotName: 'password' },
    { title: t('nanomq.common.actions'), slotName: 'actions', width: 88 },
  ]);

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

  const extractAuthConfig = (raw: unknown): Record<string, unknown> | null => {
    if (!isRecord(raw)) return null;
    const { data } = raw;
    if (isRecord(data) && isRecord(data.auth)) return data.auth;
    if (isRecord(data) && Array.isArray(data.auth)) {
      const first = data.auth[0];
      return isRecord(first) ? first : null;
    }
    if (Array.isArray(data)) {
      const first = data[0];
      return isRecord(first) ? first : null;
    }
    return isRecord(data) ? data : null;
  };

  const authApplied = (
    actual: Record<string, unknown> | null,
    expected: {
      allow_anonymous: boolean;
      no_match: string;
      deny_action: string;
      pwdPath: string;
      aclPath: string;
    }
  ) => {
    if (!actual) return false;
    if (Boolean(actual.allow_anonymous) !== expected.allow_anonymous)
      return false;
    if (String(actual.no_match || '') !== expected.no_match) return false;
    if (String(actual.deny_action || '') !== expected.deny_action) return false;
    const actualPwd = isRecord(actual.password)
      ? String(actual.password.include || '')
      : '';
    const actualAcl = isRecord(actual.acl)
      ? String(actual.acl.include || '')
      : '';
    return actualPwd === expected.pwdPath && actualAcl === expected.aclPath;
  };

  const sleep = async (ms: number) => {
    await new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  };

  const loadFromBroker = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const [pwdRes, aclRes] = await Promise.all([
        nanomqAPI.getFile({ path: pwdPath }),
        nanomqAPI.getFile({ path: aclPath }),
      ]);
      if (pwdRes.code !== 0) throw new Error('读取密码文件失败');
      if (aclRes.code !== 0) throw new Error('读取 ACL 文件失败');
      const users = parsePwdConf(pwdRes.data?.content || '');
      const rules = parseAclConf(aclRes.data?.content || '');
      pwdRows.value = users.length
        ? users.map((user) => ({ ...user, rowKey: uniqueId() }))
        : [{ rowKey: uniqueId(), username: '', password: '' }];
      aclRows.value = rules.length
        ? rules.map((rule) => ({ ...rule, rowKey: uniqueId() }))
        : [{ rowKey: uniqueId(), permit: 'allow' }];
      Message.success(t('nanomq.common.success'));
    } catch (e) {
      error.value = errorMessage(e, '读取访问控制配置失败');
    } finally {
      isLoading.value = false;
    }
  };

  const applyAuthRuntimeOptions = async (pp: string, ap: string) => {
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

    const applyWithRetry = async (attempt = 0): Promise<void> => {
      try {
        const authRes = await nanomqAPI.setConfigurationAuth(payload);
        if (authRes.code !== 0)
          throw new Error('POST /configuration/auth failed');
        const readBack = await nanomqAPI.getConfigurationAuth();
        if (authApplied(extractAuthConfig(readBack), expected)) return;
      } catch {
        // Some NanoMQ versions restart slowly after updating auth files.
      }
      if (attempt >= 1) return;
      await sleep(300);
      await applyWithRetry(attempt + 1);
    };

    await applyWithRetry();
  };

  const savePwdConfig = async () => {
    isSaving.value = true;
    error.value = null;
    try {
      const written = await nanomqAPI.writeFile(
        pwdPath,
        serializePwdConf(pwdRows.value)
      );
      if (written.code !== 0) throw new Error('写入密码文件失败');
      await applyAuthRuntimeOptions(pwdPath, aclPath);
      Message.success(t('nanomq.common.success'));
    } catch (e) {
      error.value = errorMessage(e, '保存用户失败');
      Message.error(t('nanomq.common.failed'));
    } finally {
      isSaving.value = false;
    }
  };

  const saveAclConfig = async () => {
    isSaving.value = true;
    error.value = null;
    try {
      const written = await nanomqAPI.writeFile(
        aclPath,
        serializeAclConf(aclRows.value)
      );
      if (written.code !== 0) throw new Error('写入 ACL 文件失败');
      await applyAuthRuntimeOptions(pwdPath, aclPath);
      Message.success(t('nanomq.common.success'));
    } catch (e) {
      error.value = errorMessage(e, '保存 ACL 失败');
      Message.error(t('nanomq.common.failed'));
    } finally {
      isSaving.value = false;
    }
  };

  const addPwd = () =>
    pwdRows.value.push({ rowKey: uniqueId(), username: '', password: '' });
  const delPwd = (id: string) => {
    if (pwdRows.value.length > 1) {
      pwdRows.value = pwdRows.value.filter((row) => row.rowKey !== id);
    }
  };
  const addAcl = () =>
    aclRows.value.push({
      rowKey: uniqueId(),
      permit: 'allow',
      username: '',
      action: '',
      topics: [],
    });
  const delAcl = (id: string) => {
    if (aclRows.value.length > 1) {
      aclRows.value = aclRows.value.filter((row) => row.rowKey !== id);
    }
  };
  const updatePwd = (id: string, patch: Partial<PwdUserRow>) => {
    pwdRows.value = pwdRows.value.map((row) =>
      row.rowKey === id ? { ...row, ...patch } : row
    );
  };
  const updateAcl = (id: string, patch: Partial<AclRuleRow>) => {
    aclRows.value = aclRows.value.map((row) =>
      row.rowKey === id ? { ...row, ...patch } : row
    );
  };
  const setPwdUsername = (id: string, value: string) => {
    updatePwd(id, { username: value });
  };
  const setPwdPassword = (id: string, value: string) => {
    updatePwd(id, { password: value });
  };
  const setAclPermit = (id: string, value: unknown) => {
    updateAcl(id, { permit: value === 'deny' ? 'deny' : 'allow' });
  };
  const setAclUsername = (id: string, value: string) => {
    updateAcl(id, { username: value });
  };
  const setAclClientId = (id: string, value: string) => {
    updateAcl(id, { clientid: value });
  };
  const setAclAction = (id: string, value: unknown) => {
    const action =
      value === 'publish' || value === 'subscribe' || value === 'pubsub'
        ? value
        : '';
    updateAcl(id, { action });
  };
  const setTopicsStr = (id: string, value: string) => {
    updateAcl(id, {
      topics: value
        .split(',')
        .map((topic) => topic.trim())
        .filter(Boolean),
    });
  };

  onMounted(loadFromBroker);
</script>
