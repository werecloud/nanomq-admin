<template>
  <div class="nanomq-page">
    <PageHeader
      :title="t('nanomq.bridges.title')"
      :subtitle="t('nanomq.bridges.subtitle')"
    >
      <template #icon><icon-swap /></template>
      <template #actions>
        <a-button
          type="primary"
          :loading="isLoading"
          :disabled="isSaving"
          @click="loadBridges"
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

    <a-row class="nanomq-section" :gutter="[16, 16]">
      <a-col :xs="24" :lg="12">
        <a-card :title="t('nanomq.bridges.current')" :bordered="false">
          <pre class="nanomq-pre">{{
            bridges
              ? JSON.stringify(bridges, null, 2)
              : t('nanomq.common.noData')
          }}</pre>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="12">
        <a-card :title="t('nanomq.bridges.operation')" :bordered="false">
          <a-form :model="form" layout="vertical">
            <a-form-item field="bridgeName" label="bridge_name">
              <a-input
                v-model="form.bridgeName"
                placeholder="emqx"
                allow-clear
              />
              <template v-if="selectedBridge" #extra>
                {{
                  `selected: ${selectedBridge.name} (enable: ${String(
                    selectedBridge.enable
                  )})`
                }}
              </template>
            </a-form-item>
            <a-form-item
              field="payloadJson"
              :label="t('nanomq.bridges.payload')"
            >
              <a-textarea
                v-model="form.payloadJson"
                :auto-size="{ minRows: 12, maxRows: 24 }"
              />
            </a-form-item>
          </a-form>
          <a-alert type="warning" show-icon>
            Dynamic bridge updates may reconnect the bridge. Verify payload
            before applying.
          </a-alert>
          <div
            class="nanomq-toolbar"
            style="justify-content: flex-end; margin-top: 16px"
          >
            <a-button type="primary" :loading="isSaving" @click="updateBridge">
              {{ t('nanomq.bridges.update') }}
            </a-button>
            <a-button
              status="success"
              :loading="isSaving"
              @click="addSubscriptions"
            >
              {{ t('nanomq.bridges.addSub') }}
            </a-button>
            <a-button
              status="danger"
              :loading="isSaving"
              @click="removeSubscriptions"
            >
              {{ t('nanomq.bridges.removeSub') }}
            </a-button>
          </div>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script lang="ts" setup>
  import { computed, onMounted, reactive, ref } from 'vue';
  import { Message } from '@arco-design/web-vue';
  import { useI18n } from 'vue-i18n';
  import { BridgeConfigResponse, nanomqAPI } from '@/api/nanomq';
  import PageHeader from '../components/page-header.vue';
  import { errorMessage } from '../utils';

  type BridgeNode = Record<string, unknown> & {
    name?: string;
    enable?: boolean;
  };

  const { t } = useI18n();
  const isLoading = ref(false);
  const isSaving = ref(false);
  const error = ref<string | null>(null);
  const bridges = ref<BridgeConfigResponse | null>(null);
  const form = reactive({
    bridgeName: '',
    payloadJson: '{}',
  });
  const selectedBridge = computed<BridgeNode | null>(() => {
    const nodes = bridges.value?.bridge?.nodes;
    if (!Array.isArray(nodes)) return null;
    return (
      (nodes.find((node) => node.name === form.bridgeName) as BridgeNode) ||
      null
    );
  });

  const loadBridges = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const resp = await nanomqAPI.getBridges();
      bridges.value = resp.data || null;
      const firstName = bridges.value?.bridge?.nodes?.[0]?.name;
      if (!form.bridgeName && typeof firstName === 'string') {
        form.bridgeName = firstName;
      }
    } catch (e) {
      error.value = errorMessage(e, '加载桥接配置失败');
    } finally {
      isLoading.value = false;
    }
  };

  const parsePayload = () =>
    JSON.parse(form.payloadJson) as Record<string, unknown>;
  const ensureBridgeName = () => {
    if (!form.bridgeName.trim()) throw new Error('bridge_name is required');
    return form.bridgeName.trim();
  };

  const runBridgeAction = async (
    action: (
      bridgeName: string,
      payload: Record<string, unknown>
    ) => Promise<unknown>,
    fallback: string
  ) => {
    isSaving.value = true;
    error.value = null;
    try {
      await action(ensureBridgeName(), parsePayload());
      await loadBridges();
      Message.success(t('nanomq.common.success'));
    } catch (e) {
      error.value = errorMessage(e, fallback);
      Message.error(t('nanomq.common.failed'));
    } finally {
      isSaving.value = false;
    }
  };

  const updateBridge = () =>
    runBridgeAction(nanomqAPI.updateBridge.bind(nanomqAPI), '更新桥接失败');
  const addSubscriptions = () =>
    runBridgeAction(
      nanomqAPI.addBridgeSubscriptions.bind(nanomqAPI),
      '新增订阅失败'
    );
  const removeSubscriptions = () =>
    runBridgeAction(
      nanomqAPI.removeBridgeSubscriptions.bind(nanomqAPI),
      '删除订阅失败'
    );

  onMounted(loadBridges);
</script>
