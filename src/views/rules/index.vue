<template>
  <div class="nanomq-page">
    <PageHeader
      :title="t('nanomq.rules.title')"
      :subtitle="t('nanomq.rules.subtitle')"
    >
      <template #icon><icon-code-square /></template>
      <template #actions>
        <a-button
          type="primary"
          :loading="isLoading"
          :disabled="isSaving"
          @click="loadRules"
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
      <a-col :xs="24" :lg="8">
        <a-card :title="t('nanomq.rules.list')" :bordered="false">
          <template #extra>{{ rules.length }}</template>
          <a-empty v-if="rules.length === 0" />
          <a-list v-else :bordered="false" class="rule-list">
            <a-list-item
              v-for="rule in rules"
              :key="String(rule.id)"
              :class="{ active: String(rule.id) === selectedRuleId }"
              @click="selectedRuleId = String(rule.id)"
            >
              <a-list-item-meta :description="rule.rawsql">
                <template #title>
                  <a-space>
                    <span>rule:{{ rule.id }}</span>
                    <a-tag :color="rule.enabled ? 'green' : 'gray'">
                      {{ rule.enabled ? 'enabled' : 'disabled' }}
                    </a-tag>
                  </a-space>
                </template>
              </a-list-item-meta>
            </a-list-item>
          </a-list>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="16">
        <a-card :title="t('nanomq.rules.create')" :bordered="false">
          <template #extra>
            <a-button type="primary" :loading="isSaving" @click="createRule">
              <template #icon><icon-plus /></template>
              {{ t('nanomq.common.create') }}
            </a-button>
          </template>
          <a-form :model="draft" layout="vertical">
            <a-form-item field="rawsql" :label="t('nanomq.rules.rawsql')">
              <a-input v-model="draft.rawsql" />
            </a-form-item>
            <a-form-item
              field="actionsJson"
              :label="t('nanomq.rules.actionsJson')"
            >
              <a-textarea
                v-model="draft.actionsJson"
                :auto-size="{ minRows: 5, maxRows: 10 }"
              />
            </a-form-item>
            <a-form-item
              field="description"
              :label="t('nanomq.rules.description')"
            >
              <a-input v-model="draft.description" allow-clear />
            </a-form-item>
          </a-form>
          <a-alert type="info" show-icon :content="actionExample" />
        </a-card>

        <a-card
          class="nanomq-section"
          :title="t('nanomq.rules.current')"
          :bordered="false"
        >
          <template #extra>
            <a-space wrap>
              <a-button
                status="success"
                :disabled="!selectedRule || isSaving"
                @click="toggleRule(true)"
              >
                {{ t('nanomq.common.enabled') }}
              </a-button>
              <a-button
                :disabled="!selectedRule || isSaving"
                @click="toggleRule(false)"
              >
                {{ t('nanomq.common.disabled') }}
              </a-button>
              <a-popconfirm
                :content="t('nanomq.common.delete')"
                @ok="deleteRule"
              >
                <a-button status="danger" :disabled="!selectedRule || isSaving">
                  {{ t('nanomq.common.delete') }}
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
          <a-empty
            v-if="!selectedRule"
            :description="t('nanomq.rules.selectFirst')"
          />
          <pre v-else class="nanomq-pre">{{
            JSON.stringify(selectedRule, null, 2)
          }}</pre>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script lang="ts" setup>
  import { computed, onMounted, reactive, ref } from 'vue';
  import { Message } from '@arco-design/web-vue';
  import { useI18n } from 'vue-i18n';
  import { nanomqAPI, RuleAction, RuleInfo } from '@/api/nanomq';
  import PageHeader from '../components/page-header.vue';
  import { errorMessage } from '../utils';

  const { t } = useI18n();
  const rules = ref<RuleInfo[]>([]);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const error = ref<string | null>(null);
  const selectedRuleId = ref('');
  const draft = reactive({
    rawsql: 'select * from "#"',
    actionsJson:
      '[{"name":"repub","params":{"topic":"repub1","address":"mqtt-tcp://broker.emqx.io:1883","proto_ver":4}}]',
    description: '',
  });
  const actionExample =
    'Example: [{"name":"repub","params":{"topic":"repub1","address":"mqtt-tcp://broker.emqx.io:1883","proto_ver":4}}]';
  const selectedRule = computed(
    () =>
      rules.value.find((rule) => String(rule.id) === selectedRuleId.value) ||
      null
  );

  const loadRules = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const resp = await nanomqAPI.getRules();
      rules.value = Array.isArray(resp.data) ? resp.data : [];
      if (!selectedRuleId.value && rules.value[0]) {
        selectedRuleId.value = String(rules.value[0].id);
      }
    } catch (e) {
      error.value = errorMessage(e, '加载规则失败');
    } finally {
      isLoading.value = false;
    }
  };

  const parseActions = () => {
    const actions = JSON.parse(draft.actionsJson) as unknown;
    if (!Array.isArray(actions)) throw new Error('actions must be an array');
    return actions as RuleAction[];
  };

  const createRule = async () => {
    isSaving.value = true;
    error.value = null;
    try {
      const resp = await nanomqAPI.createRule({
        rawsql: draft.rawsql,
        actions: parseActions(),
        description: draft.description || undefined,
      });
      await loadRules();
      if (resp.data?.id !== undefined)
        selectedRuleId.value = String(resp.data.id);
      Message.success(t('nanomq.common.success'));
    } catch (e) {
      error.value = errorMessage(e, '创建规则失败');
      Message.error(t('nanomq.common.failed'));
    } finally {
      isSaving.value = false;
    }
  };

  const toggleRule = async (enabled: boolean) => {
    if (!selectedRule.value) return;
    isSaving.value = true;
    error.value = null;
    try {
      await nanomqAPI.updateRule(String(selectedRule.value.id), { enabled });
      await loadRules();
      Message.success(t('nanomq.common.success'));
    } catch (e) {
      error.value = errorMessage(e, '更新规则失败');
    } finally {
      isSaving.value = false;
    }
  };

  const deleteRule = async () => {
    if (!selectedRule.value) return;
    isSaving.value = true;
    error.value = null;
    try {
      await nanomqAPI.deleteRule(String(selectedRule.value.id));
      selectedRuleId.value = '';
      await loadRules();
      Message.success(t('nanomq.common.success'));
    } catch (e) {
      error.value = errorMessage(e, '删除规则失败');
    } finally {
      isSaving.value = false;
    }
  };

  onMounted(loadRules);
</script>

<style lang="less" scoped>
  .rule-list {
    :deep(.arco-list-item) {
      cursor: pointer;
      border-radius: 6px;

      &.active {
        background: rgb(var(--arcoblue-1));
      }
    }
  }
</style>
