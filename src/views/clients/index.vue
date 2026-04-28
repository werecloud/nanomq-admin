<template>
  <div class="nanomq-page">
    <PageHeader
      :title="t('nanomq.clients.title')"
      :subtitle="t('nanomq.clients.subtitle')"
    >
      <template #icon>
        <icon-user />
      </template>
      <template #actions>
        <a-button
          type="primary"
          :loading="isLoading"
          @click="nanomq.refreshClients"
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
      type="info"
      show-icon
      :content="t('nanomq.clients.apiHint')"
    />

    <a-row class="nanomq-section" :gutter="[16, 16]">
      <a-col :xs="24" :sm="12" :lg="6">
        <MetricCard
          :label="t('nanomq.clients.total')"
          :value="stats.total"
          color="blue"
        >
          <template #icon><icon-user /></template>
        </MetricCard>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <MetricCard
          :label="t('nanomq.clients.online')"
          :value="stats.connected"
          color="green"
        >
          <template #icon><icon-check-circle /></template>
        </MetricCard>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <MetricCard
          :label="t('nanomq.clients.idle')"
          :value="stats.idle"
          color="orange"
        >
          <template #icon><icon-clock-circle /></template>
        </MetricCard>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <MetricCard
          :label="t('nanomq.clients.protocolTypes')"
          :value="stats.protocolTypes"
          color="purple"
        >
          <template #icon><icon-wifi /></template>
        </MetricCard>
      </a-col>
    </a-row>

    <a-card class="nanomq-section" :bordered="false">
      <div class="nanomq-toolbar">
        <a-input
          v-model="searchTerm"
          class="nanomq-toolbar__grow"
          :placeholder="t('nanomq.clients.searchPlaceholder')"
          allow-clear
        >
          <template #prefix><icon-search /></template>
        </a-input>
        <a-select v-model="statusFilter" style="width: 168px">
          <a-option value="all">{{ t('nanomq.clients.allStatus') }}</a-option>
          <a-option value="connected">{{
            t('nanomq.common.connected')
          }}</a-option>
          <a-option value="idle">{{ t('nanomq.clients.idle') }}</a-option>
          <a-option value="disconnected">{{
            t('nanomq.common.disconnected')
          }}</a-option>
        </a-select>
        <a-select v-model="protocolFilter" style="width: 168px">
          <a-option value="all">{{
            t('nanomq.clients.allProtocols')
          }}</a-option>
          <a-option value="MQTT">MQTT</a-option>
          <a-option value="CoAP">CoAP</a-option>
          <a-option value="LwM2M">LwM2M</a-option>
          <a-option value="MQTT-SN">MQTT-SN</a-option>
        </a-select>
      </div>
    </a-card>

    <a-card
      class="nanomq-section"
      :title="`${t('nanomq.clients.list')} (${filteredClients.length})`"
      :bordered="false"
    >
      <a-table
        row-key="client_id"
        :loading="isLoading"
        :columns="columns"
        :data="filteredClients"
        :pagination="{ pageSize: 10, showTotal: true }"
        :scroll="{ x: 980 }"
      >
        <template #empty>
          <a-empty
            :description="
              clients.length === 0
                ? t('nanomq.clients.empty')
                : t('nanomq.clients.noMatch')
            "
          />
        </template>
        <template #client="{ record }">
          <a-space>
            <a-avatar :size="32"><icon-user /></a-avatar>
            <div>
              <div>{{ record.client_id }}</div>
              <div class="nanomq-muted">{{ record.username || '-' }}</div>
            </div>
          </a-space>
        </template>
        <template #protocol="{ record }">
          <a-tag :color="protocolColor(record.proto_name)">
            {{ record.proto_name }} v{{ record.proto_ver }}
          </a-tag>
        </template>
        <template #state="{ record }">
          <a-tag :color="stateColor(record.conn_state)">
            {{ record.conn_state }}
          </a-tag>
        </template>
        <template #connection="{ record }">
          <div>Keep-alive: {{ record.keepalive }}s</div>
          <div class="nanomq-muted"
            >Clean Start: {{ record.clean_start ? 'true' : 'false' }}</div
          >
        </template>
        <template #actions="{ record }">
          <a-button type="text" size="small" @click="selectedClient = record">
            {{ t('nanomq.common.detail') }}
          </a-button>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:visible="detailVisible"
      :title="t('nanomq.common.detail')"
      :footer="false"
      width="720px"
    >
      <a-descriptions v-if="selectedClient" :column="1" bordered>
        <a-descriptions-item :label="t('nanomq.clients.clientId')">
          {{ selectedClient.client_id }}
        </a-descriptions-item>
        <a-descriptions-item :label="t('nanomq.clients.username')">
          {{ selectedClient.username || '-' }}
        </a-descriptions-item>
        <a-descriptions-item :label="t('nanomq.clients.protocol')">
          {{ selectedClient.proto_name }} v{{ selectedClient.proto_ver }}
        </a-descriptions-item>
        <a-descriptions-item :label="t('nanomq.common.status')">
          <a-tag :color="stateColor(selectedClient.conn_state)">
            {{ selectedClient.conn_state }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item :label="t('nanomq.clients.keepalive')">
          {{ selectedClient.keepalive }}s
        </a-descriptions-item>
        <a-descriptions-item :label="t('nanomq.clients.cleanStart')">
          {{ selectedClient.clean_start ? 'true' : 'false' }}
        </a-descriptions-item>
        <a-descriptions-item :label="t('nanomq.clients.messages')">
          {{ selectedClient.recv_msg || 0 }}
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
  import type { ClientInfo } from '@/api/nanomq';
  import PageHeader from '../components/page-header.vue';
  import MetricCard from '../components/metric-card.vue';
  import { protocolColor, stateColor } from '../utils';

  type ClientFilter = 'all' | 'connected' | 'idle' | 'disconnected';
  type ProtocolFilter = 'all' | 'MQTT' | 'CoAP' | 'LwM2M' | 'MQTT-SN';

  const { t } = useI18n();
  const nanomq = useNanoMQStore();
  const { clients, isLoading } = storeToRefs(nanomq);
  const searchTerm = ref('');
  const statusFilter = ref<ClientFilter>('all');
  const protocolFilter = ref<ProtocolFilter>('all');
  const selectedClient = ref<ClientInfo | null>(null);
  const detailVisible = computed({
    get: () => selectedClient.value !== null,
    set: (value: boolean) => {
      if (!value) selectedClient.value = null;
    },
  });

  const filteredClients = computed(() => {
    const search = searchTerm.value.trim().toLowerCase();
    return clients.value.filter((client) => {
      const matchesSearch =
        !search ||
        client.client_id.toLowerCase().includes(search) ||
        (client.username || '').toLowerCase().includes(search);
      const matchesStatus =
        statusFilter.value === 'all' ||
        client.conn_state === statusFilter.value;
      const matchesProtocol =
        protocolFilter.value === 'all' ||
        client.proto_name === protocolFilter.value;
      return matchesSearch && matchesStatus && matchesProtocol;
    });
  });

  const stats = computed(() => {
    const protocols = new Set(clients.value.map((client) => client.proto_name));
    return {
      total: clients.value.length,
      connected: clients.value.filter((c) => c.conn_state === 'connected')
        .length,
      idle: clients.value.filter((c) => c.conn_state === 'idle').length,
      protocolTypes: protocols.size,
    };
  });

  const columns = computed(() => [
    { title: t('nanomq.clients.clientInfo'), slotName: 'client', width: 260 },
    { title: t('nanomq.clients.protocol'), slotName: 'protocol', width: 140 },
    { title: t('nanomq.common.status'), slotName: 'state', width: 120 },
    {
      title: t('nanomq.clients.connectionInfo'),
      slotName: 'connection',
      width: 220,
    },
    { title: t('nanomq.clients.messages'), dataIndex: 'recv_msg', width: 120 },
    { title: t('nanomq.common.actions'), slotName: 'actions', width: 100 },
  ]);

  onMounted(() => {
    nanomq.refreshClients();
  });
</script>
