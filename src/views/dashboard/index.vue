<template>
  <div class="nanomq-page">
    <PageHeader
      :title="t('nanomq.dashboard.title')"
      :subtitle="t('nanomq.dashboard.subtitle')"
    >
      <template #icon>
        <icon-dashboard />
      </template>
      <template #actions>
        <a-button
          type="primary"
          :loading="isLoading"
          @click="nanomq.refreshData"
        >
          <template #icon>
            <icon-refresh />
          </template>
          {{ t('nanomq.common.refresh') }}
        </a-button>
      </template>
    </PageHeader>

    <a-alert
      class="nanomq-section"
      :type="isConnected ? 'success' : 'error'"
      show-icon
      :title="
        isConnected
          ? t('nanomq.common.connected')
          : t('nanomq.common.disconnected')
      "
      :content="
        isConnected
          ? t('nanomq.dashboard.connectionOk')
          : error || t('nanomq.dashboard.connectionFail')
      "
    />

    <a-row class="nanomq-section" :gutter="[16, 16]">
      <a-col :xs="24" :sm="12" :lg="6">
        <MetricCard
          :label="t('nanomq.dashboard.onlineClients')"
          :value="connectedClients"
          :description="`${t('nanomq.dashboard.totalClients')}: ${
            clients.length
          }`"
          color="blue"
        >
          <template #icon>
            <icon-user />
          </template>
        </MetricCard>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <MetricCard
          :label="t('nanomq.dashboard.activeSubscriptions')"
          :value="subscriptions.length"
          color="green"
        >
          <template #icon>
            <icon-message />
          </template>
        </MetricCard>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <MetricCard
          :label="t('nanomq.dashboard.memoryUsage')"
          :value="memoryUsage"
          color="purple"
        >
          <template #icon>
            <icon-storage />
          </template>
        </MetricCard>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <MetricCard
          :label="t('nanomq.dashboard.cpuUsage')"
          :value="cpuUsage"
          color="orange"
        >
          <template #icon>
            <icon-thunderbolt />
          </template>
        </MetricCard>
      </a-col>
    </a-row>

    <a-row class="nanomq-section" :gutter="[16, 16]">
      <a-col :xs="24" :lg="12">
        <a-card :title="t('nanomq.dashboard.nodeInfo')" :bordered="false">
          <a-descriptions v-if="nodeInfo || brokerInfo" :column="1">
            <a-descriptions-item label="Version">
              {{ nodeInfo?.version || brokerInfo?.version || '-' }}
            </a-descriptions-item>
            <a-descriptions-item label="Status">
              {{ nodeInfo?.node_status || brokerInfo?.node_status || '-' }}
            </a-descriptions-item>
            <a-descriptions-item label="Connections">
              {{ nodeInfo?.connections ?? '-' }}
            </a-descriptions-item>
            <a-descriptions-item label="Uptime">
              {{ nodeInfo?.uptime || brokerInfo?.uptime || '-' }}
            </a-descriptions-item>
            <a-descriptions-item label="Description">
              {{ brokerInfo?.sysdescr || '-' }}
            </a-descriptions-item>
          </a-descriptions>
          <a-empty v-else />
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="12">
        <a-card :title="t('nanomq.dashboard.quickActions')" :bordered="false">
          <a-row :gutter="[12, 12]">
            <a-col
              v-for="item in quickActions"
              :key="item.name"
              :xs="24"
              :sm="12"
            >
              <a-button long @click="router.push({ name: item.name })">
                <template #icon>
                  <component :is="item.icon" />
                </template>
                {{ t(item.label) }}
              </a-button>
            </a-col>
          </a-row>
        </a-card>
      </a-col>
    </a-row>

    <a-card
      v-if="clients.length"
      class="nanomq-section"
      :title="t('nanomq.dashboard.recentClients')"
      :bordered="false"
    >
      <a-table
        row-key="client_id"
        :columns="recentColumns"
        :data="clients.slice(0, 5)"
        :pagination="false"
        :scroll="{ x: 760 }"
      >
        <template #state="{ record }">
          <a-tag :color="stateColor(record.conn_state)">
            {{ record.conn_state }}
          </a-tag>
        </template>
      </a-table>
      <div
        v-if="clients.length > 5"
        style="margin-top: 12px; text-align: center"
      >
        <a-button type="text" @click="router.push({ name: 'NanoMQClients' })">
          {{ t('nanomq.dashboard.viewAllClients') }} ({{ clients.length }})
        </a-button>
      </div>
    </a-card>
  </div>
</template>

<script lang="ts" setup>
  import { computed, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { useI18n } from 'vue-i18n';
  import { storeToRefs } from 'pinia';
  import { useNanoMQStore } from '@/store';
  import PageHeader from '../components/page-header.vue';
  import MetricCard from '../components/metric-card.vue';
  import { formatBytes, stateColor } from '../utils';

  const { t } = useI18n();
  const router = useRouter();
  const nanomq = useNanoMQStore();
  const {
    brokerInfo,
    clients,
    connectedClients,
    error,
    isConnected,
    isLoading,
    metrics,
    nodeInfo,
    subscriptions,
  } = storeToRefs(nanomq);

  const memoryUsage = computed(() =>
    formatBytes(
      Number(metrics.value?.memory_usage || metrics.value?.memory || 0)
    )
  );
  const cpuUsage = computed(() =>
    metrics.value?.cpu_usage !== undefined
      ? `${metrics.value.cpu_usage.toFixed(1)}%`
      : metrics.value?.cpuinfo || '0%'
  );
  const recentColumns = computed(() => [
    { title: t('nanomq.clients.clientId'), dataIndex: 'client_id' },
    { title: t('nanomq.clients.username'), dataIndex: 'username' },
    { title: t('nanomq.clients.protocol'), dataIndex: 'proto_name' },
    { title: t('nanomq.common.status'), slotName: 'state' },
    { title: t('nanomq.clients.messages'), dataIndex: 'recv_msg' },
  ]);
  const quickActions = [
    {
      label: 'menu.nanomq.publish',
      name: 'NanoMQPublish',
      icon: 'icon-send',
    },
    {
      label: 'menu.nanomq.clients',
      name: 'NanoMQClients',
      icon: 'icon-user',
    },
    {
      label: 'menu.nanomq.monitoring',
      name: 'NanoMQMonitoring',
      icon: 'icon-computer',
    },
    {
      label: 'menu.nanomq.configuration',
      name: 'NanoMQConfiguration',
      icon: 'icon-settings',
    },
  ];

  onMounted(() => {
    nanomq.refreshData();
  });
</script>
