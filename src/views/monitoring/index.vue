<template>
  <div class="nanomq-page">
    <PageHeader
      :title="t('nanomq.monitoring.title')"
      :subtitle="t('nanomq.monitoring.subtitle')"
    >
      <template #icon><icon-computer /></template>
      <template #actions>
        <a-select v-model="refreshInterval" style="width: 120px">
          <a-option :value="1000">1s</a-option>
          <a-option :value="5000">5s</a-option>
          <a-option :value="10000">10s</a-option>
          <a-option :value="30000">30s</a-option>
        </a-select>
        <a-button
          :status="isMonitoring ? 'danger' : 'success'"
          @click="isMonitoring = !isMonitoring"
        >
          <template #icon>
            <icon-pause v-if="isMonitoring" />
            <icon-play-arrow v-else />
          </template>
          {{
            isMonitoring
              ? t('nanomq.monitoring.pause')
              : t('nanomq.monitoring.start')
          }}
        </a-button>
        <a-button type="primary" :loading="isLoading" @click="fetchMetrics">
          <template #icon><icon-refresh /></template>
          {{ t('nanomq.common.refresh') }}
        </a-button>
      </template>
    </PageHeader>

    <a-alert
      class="nanomq-section"
      :type="
        connectionStatus === 'connected'
          ? 'success'
          : connectionStatus === 'connecting'
          ? 'warning'
          : 'error'
      "
      show-icon
      :title="connectionStatus"
      :content="`${t('nanomq.monitoring.lastUpdated')}: ${lastUpdatedText}`"
    />
    <a-alert
      v-if="error"
      class="nanomq-section"
      type="error"
      show-icon
      :content="error"
    />

    <a-row v-if="currentMetrics" class="nanomq-section" :gutter="[16, 16]">
      <a-col :xs="24" :sm="12" :lg="6">
        <MetricCard
          :label="t('nanomq.dashboard.cpuUsage')"
          :value="`${currentMetrics.cpu_usage.toFixed(1)}%`"
          color="blue"
        >
          <template #icon><icon-thunderbolt /></template>
        </MetricCard>
        <MiniChart
          class="nanomq-section"
          :data="cpuHistory"
          color="#165DFF"
          unit="%"
        />
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <MetricCard
          :label="t('nanomq.dashboard.memoryUsage')"
          :value="formatBytes(currentMetrics.memory_usage)"
          color="green"
        >
          <template #icon><icon-storage /></template>
        </MetricCard>
        <MiniChart
          class="nanomq-section"
          :data="memoryHistory"
          color="#00B42A"
          unit="%"
        />
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <MetricCard
          label="Current connections"
          :value="currentMetrics.connections_count"
          color="purple"
        >
          <template #icon><icon-user /></template>
        </MetricCard>
        <MiniChart
          class="nanomq-section"
          :data="connectionsHistory"
          color="#722ED1"
        />
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <MetricCard
          :label="t('nanomq.clients.messages')"
          :value="
            formatNumber(
              currentMetrics.messages_received + currentMetrics.messages_sent
            )
          "
          color="orange"
        >
          <template #icon><icon-message /></template>
        </MetricCard>
        <MiniChart
          class="nanomq-section"
          :data="messagesHistory"
          color="#FF7D00"
        />
      </a-col>
    </a-row>

    <a-row v-if="currentMetrics" class="nanomq-section" :gutter="[16, 16]">
      <a-col :xs="24" :lg="12">
        <a-card
          :title="t('nanomq.monitoring.messageTraffic')"
          :bordered="false"
        >
          <a-descriptions :column="1" bordered>
            <a-descriptions-item label="Messages received">
              {{ currentMetrics.messages_received.toLocaleString() }}
            </a-descriptions-item>
            <a-descriptions-item label="Messages sent">
              {{ currentMetrics.messages_sent.toLocaleString() }}
            </a-descriptions-item>
            <a-descriptions-item label="Bytes received">
              {{ formatBytes(currentMetrics.bytes_received) }}
            </a-descriptions-item>
            <a-descriptions-item label="Bytes sent">
              {{ formatBytes(currentMetrics.bytes_sent) }}
            </a-descriptions-item>
          </a-descriptions>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="12">
        <a-card :title="t('nanomq.monitoring.systemInfo')" :bordered="false">
          <a-descriptions :column="1" bordered>
            <a-descriptions-item label="Uptime">{{
              formatUptime(currentMetrics.uptime)
            }}</a-descriptions-item>
            <a-descriptions-item label="Subscriptions">{{
              currentMetrics.subscriptions_count
            }}</a-descriptions-item>
            <a-descriptions-item label="Memory %"
              >{{ memoryPercent.toFixed(1) }}%</a-descriptions-item
            >
            <a-descriptions-item label="CPU"
              >{{ currentMetrics.cpu_usage.toFixed(1) }}%</a-descriptions-item
            >
          </a-descriptions>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script lang="ts" setup>
  import {
    computed,
    defineComponent,
    h,
    onBeforeUnmount,
    onMounted,
    ref,
    watch,
  } from 'vue';
  import type { PropType } from 'vue';
  import { storeToRefs } from 'pinia';
  import { useI18n } from 'vue-i18n';
  import { useNanoMQStore } from '@/store';
  import PageHeader from '../components/page-header.vue';
  import MetricCard from '../components/metric-card.vue';
  import type { MetricPoint } from '../utils';
  import { formatBytes, formatNumber, formatUptime } from '../utils';

  const MiniChart = defineComponent({
    name: 'MiniChart',
    props: {
      data: {
        type: Array as PropType<MetricPoint[]>,
        required: true,
      },
      color: {
        type: String,
        required: true,
      },
      unit: {
        type: String,
        default: '',
      },
    },
    setup(props) {
      const buildPoints = () => {
        if (props.data.length === 0) return '';
        const max = Math.max(...props.data.map((item) => item.value));
        const min = Math.min(...props.data.map((item) => item.value));
        const range = max - min || 1;
        return props.data
          .map((point, index) => {
            const x = (index / Math.max(props.data.length - 1, 1)) * 100;
            const y = 100 - ((point.value - min) / range) * 100;
            return `${x},${y}`;
          })
          .join(' ');
      };
      return () =>
        h('div', { class: 'mini-chart' }, [
          props.data.length
            ? h(
                'svg',
                { viewBox: '0 0 100 100', preserveAspectRatio: 'none' },
                [
                  h('polyline', {
                    'points': buildPoints(),
                    'fill': 'none',
                    'stroke': props.color,
                    'stroke-width': 2,
                  }),
                ]
              )
            : h('span', { class: 'nanomq-muted' }, 'No data'),
          props.data.length
            ? h(
                'span',
                { class: 'mini-chart__value' },
                `${props.data[props.data.length - 1].value.toFixed(1)}${
                  props.unit
                }`
              )
            : null,
        ]);
    },
  });

  const { t } = useI18n();
  const nanomq = useNanoMQStore();
  const { connectionStatus, error, isLoading, lastUpdated, metrics } =
    storeToRefs(nanomq);
  const isMonitoring = ref(true);
  const refreshInterval = ref(5000);
  const cpuHistory = ref<MetricPoint[]>([]);
  const memoryHistory = ref<MetricPoint[]>([]);
  const connectionsHistory = ref<MetricPoint[]>([]);
  const messagesHistory = ref<MetricPoint[]>([]);
  const timer = ref<number | null>(null);
  const currentMetrics = computed(() => {
    const memUsage = metrics.value?.memory_usage || 0;
    const memTotal =
      metrics.value?.memory_total && metrics.value.memory_total > 0
        ? metrics.value.memory_total
        : Math.max(memUsage, 1);
    return metrics.value
      ? {
          cpu_usage: metrics.value.cpu_usage || 0,
          memory_usage: memUsage,
          memory_total: memTotal,
          connections_count: metrics.value.connections_count || 0,
          subscriptions_count: metrics.value.subscriptions_count || 0,
          messages_received: metrics.value.messages_received || 0,
          messages_sent: metrics.value.messages_sent || 0,
          bytes_received: metrics.value.bytes_received || 0,
          bytes_sent: metrics.value.bytes_sent || 0,
          uptime: metrics.value.uptime || 0,
        }
      : null;
  });
  const memoryPercent = computed(() =>
    currentMetrics.value
      ? (currentMetrics.value.memory_usage /
          currentMetrics.value.memory_total) *
        100
      : 0
  );
  const lastUpdatedText = computed(() =>
    lastUpdated.value ? new Date(lastUpdated.value).toLocaleTimeString() : '-'
  );

  const pushHistory = (target: typeof cpuHistory, value: number) => {
    target.value = [...target.value, { timestamp: Date.now(), value }].slice(
      -50
    );
  };

  const fetchMetrics = async () => {
    await nanomq.refreshMetrics();
    if (!currentMetrics.value) return;
    pushHistory(cpuHistory, currentMetrics.value.cpu_usage);
    pushHistory(memoryHistory, memoryPercent.value);
    pushHistory(connectionsHistory, currentMetrics.value.connections_count);
    pushHistory(
      messagesHistory,
      currentMetrics.value.messages_received +
        currentMetrics.value.messages_sent
    );
  };

  const clearTimer = () => {
    if (timer.value !== null) {
      window.clearInterval(timer.value);
      timer.value = null;
    }
  };

  const resetTimer = () => {
    clearTimer();
    if (isMonitoring.value) {
      timer.value = window.setInterval(fetchMetrics, refreshInterval.value);
    }
  };

  watch([isMonitoring, refreshInterval], resetTimer);
  onMounted(() => {
    fetchMetrics();
    resetTimer();
  });
  onBeforeUnmount(clearTimer);
</script>

<style lang="less" scoped>
  .mini-chart {
    position: relative;
    padding: 8px;
    background: var(--color-bg-2);
    border: 1px solid var(--color-border);
    border-radius: 6px;

    svg {
      width: 100%;
      height: 100%;
    }

    &__value {
      position: absolute;
      top: 8px;
      right: 10px;
      color: var(--color-text-2);
      font-size: 12px;
    }
  }
</style>
