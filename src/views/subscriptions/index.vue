<template>
  <div class="nanomq-page">
    <PageHeader
      :title="t('nanomq.subscriptions.title')"
      :subtitle="t('nanomq.subscriptions.subtitle')"
    >
      <template #icon><icon-message /></template>
      <template #actions>
        <a-button
          type="primary"
          :loading="isLoading"
          @click="nanomq.refreshSubscriptions"
        >
          <template #icon><icon-refresh /></template>
          {{ t('nanomq.common.refresh') }}
        </a-button>
      </template>
    </PageHeader>

    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :sm="12" :lg="6">
        <MetricCard
          :label="t('nanomq.subscriptions.total')"
          :value="stats.total"
          color="blue"
        >
          <template #icon><icon-message /></template>
        </MetricCard>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <MetricCard
          :label="t('nanomq.subscriptions.clients')"
          :value="stats.uniqueClients"
          color="green"
        >
          <template #icon><icon-user /></template>
        </MetricCard>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <MetricCard
          :label="t('nanomq.subscriptions.wildcards')"
          :value="stats.wildcards"
          color="purple"
        >
          <template #icon><icon-code /></template>
        </MetricCard>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <MetricCard
          :label="t('nanomq.subscriptions.topicTypes')"
          :value="stats.topicTypes"
          color="orange"
        >
          <template #icon><icon-tags /></template>
        </MetricCard>
      </a-col>
    </a-row>

    <a-card
      class="nanomq-section"
      :title="t('nanomq.subscriptions.qosDistribution')"
      :bordered="false"
    >
      <a-row :gutter="[12, 12]">
        <a-col v-for="qos in [0, 1, 2]" :key="qos" :xs="24" :md="8">
          <a-card :bordered="false">
            <a-space>
              <a-tag :color="qosColor(qos)">QoS {{ qos }}</a-tag>
              <span class="nanomq-muted">{{ qosText(qos) }}</span>
            </a-space>
            <div style="margin-top: 8px; font-size: 24px; font-weight: 600">
              {{ stats.qosStats[qos] || 0 }}
            </div>
          </a-card>
        </a-col>
      </a-row>
    </a-card>

    <a-card class="nanomq-section" :bordered="false">
      <div class="nanomq-toolbar">
        <a-input
          v-model="searchTerm"
          class="nanomq-toolbar__grow"
          :placeholder="t('nanomq.subscriptions.searchPlaceholder')"
          allow-clear
        >
          <template #prefix><icon-search /></template>
        </a-input>
        <a-select v-model="qosFilter" style="width: 160px">
          <a-option value="all">{{
            t('nanomq.subscriptions.allQos')
          }}</a-option>
          <a-option value="0">QoS 0</a-option>
          <a-option value="1">QoS 1</a-option>
          <a-option value="2">QoS 2</a-option>
        </a-select>
      </div>
    </a-card>

    <a-card
      class="nanomq-section"
      :title="`${t('nanomq.subscriptions.list')} (${
        filteredSubscriptions.length
      })`"
      :bordered="false"
    >
      <a-table
        row-key="rowKey"
        :loading="isLoading"
        :columns="columns"
        :data="tableData"
        :pagination="{ pageSize: 10, showTotal: true }"
        :scroll="{ x: 880 }"
      >
        <template #empty>
          <a-empty
            :description="
              subscriptions.length === 0
                ? t('nanomq.subscriptions.empty')
                : t('nanomq.subscriptions.noMatch')
            "
          />
        </template>
        <template #topic="{ record }">
          <a-space>
            <a-tag :color="isWildcardTopic(record.topic) ? 'purple' : 'blue'">
              {{
                isWildcardTopic(record.topic)
                  ? t('nanomq.subscriptions.wildcard')
                  : t('nanomq.subscriptions.exact')
              }}
            </a-tag>
            <span style="word-break: break-all">{{ record.topic }}</span>
          </a-space>
        </template>
        <template #qos="{ record }">
          <a-tag :color="qosColor(record.qos)">QoS {{ record.qos }}</a-tag>
          <div class="nanomq-muted">{{ qosText(record.qos) }}</div>
        </template>
        <template #type="{ record }">
          {{
            isWildcardTopic(record.topic)
              ? t('nanomq.subscriptions.wildcard')
              : t('nanomq.subscriptions.exact')
          }}
        </template>
        <template #actions="{ record }">
          <a-button
            type="text"
            size="small"
            @click="selectedSubscription = record"
          >
            {{ t('nanomq.common.detail') }}
          </a-button>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:visible="detailVisible"
      :title="t('nanomq.common.detail')"
      :footer="false"
      width="640px"
    >
      <a-descriptions v-if="selectedSubscription" :column="1" bordered>
        <a-descriptions-item :label="t('nanomq.subscriptions.topic')">
          {{ selectedSubscription.topic }}
        </a-descriptions-item>
        <a-descriptions-item :label="t('nanomq.clients.clientId')">
          {{ selectedSubscription.clientid }}
        </a-descriptions-item>
        <a-descriptions-item label="QoS">
          <a-tag :color="qosColor(selectedSubscription.qos)">
            QoS {{ selectedSubscription.qos }}
          </a-tag>
          {{ qosText(selectedSubscription.qos) }}
        </a-descriptions-item>
        <a-descriptions-item :label="t('nanomq.subscriptions.type')">
          {{
            isWildcardTopic(selectedSubscription.topic)
              ? t('nanomq.subscriptions.wildcard')
              : t('nanomq.subscriptions.exact')
          }}
        </a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
  import { computed, onMounted, ref } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { storeToRefs } from 'pinia';
  import { useNanoMQStore } from '@/store';
  import type { SubscriptionInfo } from '@/api/nanomq';
  import PageHeader from '../components/page-header.vue';
  import MetricCard from '../components/metric-card.vue';
  import { isWildcardTopic, qosColor, qosText } from '../utils';

  type QosFilter = 'all' | '0' | '1' | '2';
  type SubscriptionRow = SubscriptionInfo & { rowKey: string };

  const { t } = useI18n();
  const nanomq = useNanoMQStore();
  const { isLoading, subscriptions } = storeToRefs(nanomq);
  const searchTerm = ref('');
  const qosFilter = ref<QosFilter>('all');
  const selectedSubscription = ref<SubscriptionRow | null>(null);
  const detailVisible = computed({
    get: () => selectedSubscription.value !== null,
    set: (value: boolean) => {
      if (!value) selectedSubscription.value = null;
    },
  });

  const filteredSubscriptions = computed(() => {
    const search = searchTerm.value.trim().toLowerCase();
    return subscriptions.value.filter((subscription) => {
      const matchesSearch =
        !search ||
        subscription.topic.toLowerCase().includes(search) ||
        subscription.clientid.toLowerCase().includes(search);
      const matchesQoS =
        qosFilter.value === 'all' ||
        String(subscription.qos) === qosFilter.value;
      return matchesSearch && matchesQoS;
    });
  });

  const tableData = computed<SubscriptionRow[]>(() =>
    filteredSubscriptions.value.map((item, index) => ({
      ...item,
      rowKey: `${item.clientid}-${item.topic}-${index}`,
    }))
  );

  const stats = computed(() => {
    const qosStats = subscriptions.value.reduce<Record<number, number>>(
      (acc, sub) => {
        acc[sub.qos] = (acc[sub.qos] || 0) + 1;
        return acc;
      },
      {}
    );
    const rootTopics = new Set(
      subscriptions.value.map((sub) => sub.topic.split('/')[0] || sub.topic)
    );
    return {
      total: subscriptions.value.length,
      qosStats,
      uniqueClients: new Set(subscriptions.value.map((sub) => sub.clientid))
        .size,
      wildcards: subscriptions.value.filter((sub) => isWildcardTopic(sub.topic))
        .length,
      topicTypes: rootTopics.size,
    };
  });

  const columns = computed(() => [
    { title: t('nanomq.subscriptions.topic'), slotName: 'topic', width: 320 },
    { title: t('nanomq.clients.clientId'), dataIndex: 'clientid', width: 220 },
    { title: 'QoS', slotName: 'qos', width: 140 },
    { title: t('nanomq.subscriptions.type'), slotName: 'type', width: 120 },
    { title: t('nanomq.common.actions'), slotName: 'actions', width: 100 },
  ]);

  onMounted(() => {
    nanomq.refreshSubscriptions();
  });
</script>
