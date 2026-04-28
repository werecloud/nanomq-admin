<template>
  <div class="nanomq-page">
    <PageHeader
      :title="t('nanomq.configuration.title')"
      :subtitle="t('nanomq.configuration.subtitle')"
    >
      <template #icon><icon-settings /></template>
      <template #actions>
        <a-button
          type="primary"
          :loading="isLoading"
          :disabled="isSaving"
          @click="loadAll"
        >
          <template #icon><icon-refresh /></template>
          {{ t('nanomq.common.refresh') }}
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

    <a-card class="nanomq-section" :bordered="false">
      <a-tabs v-model:active-key="activeTab">
        <a-tab-pane
          key="config_update"
          :title="t('nanomq.configuration.configUpdate')"
        >
          <a-space direction="vertical" fill :size="16">
            <a-alert type="warning" show-icon>
              <template #title>POST /api/v4/config_update</template>
              HOCON text is submitted directly to NanoMQ. Please verify before
              saving.
            </a-alert>
            <a-textarea
              v-model="hoconText"
              :auto-size="{ minRows: 16, maxRows: 28 }"
              placeholder="nanomq_conf { ... }"
              @input="hoconText = stripNullChars(hoconText)"
            />
            <a-alert
              v-if="nullCharWarn"
              type="warning"
              show-icon
              :content="nullCharWarn"
            />
            <div class="nanomq-toolbar" style="justify-content: flex-end">
              <a-button
                :loading="isLoading"
                :disabled="isSaving"
                @click="fillConfigEditorWithMainConf"
              >
                <template #icon><icon-refresh /></template>
                {{ t('nanomq.configuration.fillMain') }}
              </a-button>
              <a-button
                type="primary"
                :loading="isSaving"
                :disabled="!hoconText.trim()"
                @click="saveConfigUpdate"
              >
                <template #icon><icon-save /></template>
                {{ t('nanomq.configuration.submitConfig') }}
              </a-button>
            </div>
          </a-space>
        </a-tab-pane>
        <a-tab-pane key="reload" :title="t('nanomq.configuration.reload')">
          <a-spin :loading="isLoading">
            <a-empty v-if="!reloadDraft" />
            <template v-else>
              <div class="nanomq-form-grid">
                <a-form-item
                  v-for="field in reloadNumberFields"
                  :key="field"
                  :label="field"
                >
                  <a-input-number
                    :model-value="Number(reloadDraft[field] || 0)"
                    style="width: 100%"
                    @update:model-value="setReloadNumber(field, $event)"
                  />
                  <template #extra>
                    {{ `current: ${String(reloadConfig?.[field] ?? '-')}` }}
                  </template>
                </a-form-item>
                <a-form-item
                  v-for="field in reloadBooleanFields"
                  :key="field"
                  :label="field"
                >
                  <a-switch
                    :model-value="Boolean(reloadDraft[field])"
                    @update:model-value="setReloadBoolean(field, $event)"
                  />
                  <template #extra>
                    {{ `current: ${String(reloadConfig?.[field] ?? '-')}` }}
                  </template>
                </a-form-item>
              </div>
              <div class="nanomq-toolbar" style="justify-content: flex-end">
                <a-button
                  type="primary"
                  :loading="isSaving"
                  @click="saveReload"
                >
                  <template #icon><icon-save /></template>
                  {{ t('nanomq.common.save') }}
                </a-button>
              </div>
            </template>
          </a-spin>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>

<script lang="ts" setup>
  import { onMounted, ref } from 'vue';
  import { Message } from '@arco-design/web-vue';
  import { useI18n } from 'vue-i18n';
  import { nanomqAPI, ReloadConfig } from '@/api/nanomq';
  import PageHeader from '../components/page-header.vue';
  import { errorMessage } from '../utils';

  type TabKey = 'reload' | 'config_update';
  type ReloadNumberField =
    | 'property_size'
    | 'msq_len'
    | 'qos_duration'
    | 'max_packet_size'
    | 'client_max_packet_size'
    | 'keepalive_backoff';
  type ReloadBooleanField = 'allow_anonymous';

  const { t } = useI18n();
  const activeTab = ref<TabKey>('config_update');
  const reloadNumberFields: ReloadNumberField[] = [
    'property_size',
    'msq_len',
    'qos_duration',
    'max_packet_size',
    'client_max_packet_size',
    'keepalive_backoff',
  ];
  const reloadBooleanFields: ReloadBooleanField[] = ['allow_anonymous'];
  const reloadConfig = ref<ReloadConfig | null>(null);
  const reloadDraft = ref<ReloadConfig | null>(null);
  const hoconText = ref('');
  const isLoading = ref(false);
  const isSaving = ref(false);
  const error = ref<string | null>(null);
  const nullCharWarn = ref<string | null>(null);
  const stripNullChars = (text: string) => text.split('\u0000').join('');

  const normalizeReload = (reload: ReloadConfig) => {
    const normalized: ReloadConfig = { ...reload };
    reloadNumberFields.forEach((key) => {
      const value = normalized[key];
      normalized[key] = typeof value === 'number' ? value : Number(value || 0);
    });
    reloadBooleanFields.forEach((key) => {
      normalized[key] = Boolean(normalized[key]);
    });
    return normalized;
  };

  const setReloadNumber = (
    field: ReloadNumberField,
    value: number | null | undefined
  ) => {
    if (!reloadDraft.value) return;
    reloadDraft.value = { ...reloadDraft.value, [field]: value || 0 };
  };
  const setReloadBoolean = (field: ReloadBooleanField, value: unknown) => {
    if (!reloadDraft.value) return;
    reloadDraft.value = { ...reloadDraft.value, [field]: Boolean(value) };
  };

  const loadAll = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const [reload, mainConf] = await Promise.all([
        nanomqAPI.getReloadConfig(),
        nanomqAPI.getFile({ default: true }),
      ]);
      reloadConfig.value = reload;
      reloadDraft.value = normalizeReload(reload);
      const raw = mainConf.data?.content || '';
      const cleaned = stripNullChars(raw);
      hoconText.value = cleaned;
      nullCharWarn.value =
        raw.length === cleaned.length
          ? null
          : 'Detected NUL characters and removed them.';
    } catch (e) {
      error.value = errorMessage(e, '加载配置失败');
    } finally {
      isLoading.value = false;
    }
  };

  const saveReload = async () => {
    if (!reloadDraft.value) return;
    isSaving.value = true;
    error.value = null;
    try {
      await nanomqAPI.setReloadConfig(reloadDraft.value);
      Message.success(t('nanomq.common.success'));
      await loadAll();
    } catch (e) {
      error.value = errorMessage(e, '保存热更新配置失败');
      Message.error(t('nanomq.common.failed'));
    } finally {
      isSaving.value = false;
    }
  };

  const saveConfigUpdate = async () => {
    const cleaned = stripNullChars(hoconText.value);
    hoconText.value = cleaned;
    if (!cleaned.trim()) {
      error.value = 'HOCON content is required';
      return;
    }
    isSaving.value = true;
    error.value = null;
    try {
      await nanomqAPI.configUpdate(cleaned.trim());
      Message.success(t('nanomq.common.success'));
      await loadAll();
    } catch (e) {
      error.value = errorMessage(e, '配置文件更新失败');
      Message.error(t('nanomq.common.failed'));
    } finally {
      isSaving.value = false;
    }
  };

  const fillConfigEditorWithMainConf = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const mainConf = await nanomqAPI.getFile({ default: true });
      const raw = mainConf.data?.content || '';
      hoconText.value = stripNullChars(raw);
    } catch (e) {
      error.value = errorMessage(e, '回填主配置失败');
    } finally {
      isLoading.value = false;
    }
  };

  onMounted(loadAll);
</script>
