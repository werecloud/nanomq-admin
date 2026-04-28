<template>
  <div class="nanomq-page">
    <PageHeader
      :title="t('nanomq.statistics.title')"
      :subtitle="t('nanomq.statistics.subtitle')"
    >
      <template #icon><icon-bar-chart /></template>
      <template #actions>
        <a-select v-model="timeRange" style="width: 140px">
          <a-option value="1h">1h</a-option>
          <a-option value="6h">6h</a-option>
          <a-option value="24h">24h</a-option>
          <a-option value="7d">7d</a-option>
        </a-select>
        <a-button
          type="primary"
          :loading="isLoading"
          @click="nanomq.refreshMetrics"
        >
          <template #icon><icon-refresh /></template>
          {{ t('nanomq.common.refresh') }}
        </a-button>
      </template>
    </PageHeader>

    <a-empty v-if="!stats" />
    <template v-else>
      <a-row :gutter="[16, 16]">
        <a-col :xs="24" :sm="12" :lg="6">
          <MetricCard
            label="Messages received"
            :value="formatNumber(stats.messages.received)"
            color="blue"
          >
            <template #icon><icon-message /></template>
          </MetricCard>
        </a-col>
        <a-col :xs="24" :sm="12" :lg="6">
          <MetricCard
            label="Messages sent"
            :value="formatNumber(stats.messages.sent)"
            color="green"
          >
            <template #icon><icon-send /></template>
          </MetricCard>
        </a-col>
        <a-col :xs="24" :sm="12" :lg="6">
          <MetricCard
            label="Current connections"
            :value="formatNumber(stats.connections.current)"
            :description="`Max: ${formatNumber(stats.connections.max)}`"
            color="purple"
          >
            <template #icon><icon-user /></template>
          </MetricCard>
        </a-col>
        <a-col :xs="24" :sm="12" :lg="6">
          <MetricCard
            label="Uptime"
            :value="formatUptime(stats.system.uptime)"
            :description="stats.system.version"
            color="orange"
          >
            <template #icon><icon-clock-circle /></template>
          </MetricCard>
        </a-col>
      </a-row>

      <a-row class="nanomq-section" :gutter="[16, 16]">
        <a-col :xs="24" :lg="12">
          <a-card title="Message statistics" :bordered="false">
            <a-descriptions :column="1" bordered>
              <a-descriptions-item label="Received">{{
                formatNumber(stats.messages.received)
              }}</a-descriptions-item>
              <a-descriptions-item label="Sent">{{
                formatNumber(stats.messages.sent)
              }}</a-descriptions-item>
              <a-descriptions-item label="Dropped">{{
                formatNumber(stats.messages.dropped)
              }}</a-descriptions-item>
              <a-descriptions-item label="Retained">{{
                formatNumber(stats.messages.retained)
              }}</a-descriptions-item>
            </a-descriptions>
          </a-card>
        </a-col>
        <a-col :xs="24" :lg="12">
          <a-card title="Network statistics" :bordered="false">
            <a-descriptions :column="1" bordered>
              <a-descriptions-item label="Bytes received">{{
                formatBytes(stats.bytes.received)
              }}</a-descriptions-item>
              <a-descriptions-item label="Bytes sent">{{
                formatBytes(stats.bytes.sent)
              }}</a-descriptions-item>
              <a-descriptions-item label="Connections">{{
                formatNumber(stats.connections.current)
              }}</a-descriptions-item>
              <a-descriptions-item label="Subscriptions">{{
                formatNumber(stats.subscriptions.current)
              }}</a-descriptions-item>
            </a-descriptions>
          </a-card>
        </a-col>
      </a-row>

      <a-card class="nanomq-section" title="Performance" :bordered="false">
        <a-row :gutter="[16, 16]">
          <a-col :xs="24" :md="8">
            <a-statistic
              title="Message throughput"
              :value="stats.messages.received + stats.messages.sent"
            />
          </a-col>
          <a-col :xs="24" :md="8">
            <a-statistic
              title="Connection utilization"
              :value="connectionUsage"
              suffix="%"
            />
          </a-col>
          <a-col :xs="24" :md="8">
            <a-statistic
              title="Data transfer"
              :value="stats.bytes.received + stats.bytes.sent"
              suffix="B"
            />
          </a-col>
        </a-row>
      </a-card>
    </template>
  </div>
</template>

<script lang="ts" setup>
  import { computed, onMounted, ref } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { storeToRefs } from 'pinia';
  import { useNanoMQStore } from '@/store';
  import { parseUptimeToSeconds } from '@/api/metrics';
  import PageHeader from '../components/page-header.vue';
  import MetricCard from '../components/metric-card.vue';
  import { formatBytes, formatNumber, formatUptime } from '../utils';

  const { t } = useI18n();
  const nanomq = useNanoMQStore();
  const { isLoading, metrics, nodeInfo } = storeToRefs(nanomq);
  const timeRange = ref<'1h' | '6h' | '24h' | '7d'>('1h');
  const stats = computed(() => {
    if (!metrics.value) return null;
    return {
      messages: {
        received: Number(metrics.value.messages_received) || 0,
        sent: Number(metrics.value.messages_sent) || 0,
        dropped: Number(metrics.value.messages_dropped) || 0,
        retained: Number(metrics.value.messages_retained) || 0,
      },
      connections: {
        current: Number(metrics.value.connections_count) || 0,
        max: Number(metrics.value.connections_max) || 0,
      },
      subscriptions: {
        current: Number(metrics.value.subscriptions_count) || 0,
        max: Number(metrics.value.subscriptions_max) || 0,
      },
      bytes: {
        received: Number(metrics.value.bytes_received) || 0,
        sent: Number(metrics.value.bytes_sent) || 0,
      },
      system: {
        uptime:
          typeof metrics.value.uptime === 'number' && metrics.value.uptime > 0
            ? metrics.value.uptime
            : parseUptimeToSeconds(nodeInfo.value?.uptime) || 0,
        version: nodeInfo.value?.version || 'Unknown',
      },
    };
  });
  const connectionUsage = computed(() =>
    stats.value && stats.value.connections.max > 0
      ? Math.round(
          (stats.value.connections.current / stats.value.connections.max) * 100
        )
      : 0
  );

  onMounted(() => {
    nanomq.refreshMetrics();
  });
</script>
