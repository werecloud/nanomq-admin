<template>
  <div class="nanomq-page">
    <PageHeader
      :title="t('nanomq.publish.title')"
      :subtitle="t('nanomq.publish.subtitle')"
    >
      <template #icon><icon-send /></template>
      <template #actions>
        <a-tag color="green">{{ t('nanomq.common.connected') }}</a-tag>
      </template>
    </PageHeader>

    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :lg="16">
        <a-card :title="t('nanomq.publish.formTitle')" :bordered="false">
          <a-form
            :model="form"
            layout="vertical"
            @submit-success="handlePublish"
          >
            <a-form-item field="topic" :label="t('nanomq.publish.topic')">
              <a-input
                v-model="form.topic"
                placeholder="testtopic/1"
                allow-clear
              />
            </a-form-item>
            <a-form-item field="topics" :label="t('nanomq.publish.topics')">
              <a-input
                v-model="form.topics"
                placeholder="a/b/c,foo/bar,baz"
                allow-clear
              />
            </a-form-item>
            <div class="nanomq-form-grid">
              <a-form-item
                field="clientid"
                :label="t('nanomq.publish.clientid')"
              >
                <a-input
                  v-model="form.clientid"
                  placeholder="NanoMQ-HTTP-Client"
                  allow-clear
                />
              </a-form-item>
              <a-form-item
                field="encoding"
                :label="t('nanomq.publish.encoding')"
              >
                <a-select v-model="form.encoding">
                  <a-option value="plain">plain</a-option>
                  <a-option value="base64">base64</a-option>
                </a-select>
              </a-form-item>
            </div>
            <a-form-item field="qos" :label="t('nanomq.publish.qos')">
              <a-radio-group v-model="form.qos" type="button">
                <a-radio :value="0">QoS 0</a-radio>
                <a-radio :value="1">QoS 1</a-radio>
                <a-radio :value="2">QoS 2</a-radio>
              </a-radio-group>
            </a-form-item>
            <a-form-item field="retain" :label="t('nanomq.publish.retain')">
              <a-switch v-model="form.retain" />
            </a-form-item>
            <a-form-item field="payload" :label="t('nanomq.publish.payload')">
              <template #extra>
                <a-space wrap>
                  <a-button size="mini" @click="formatPayloadAsJson"
                    >JSON</a-button
                  >
                  <a-button size="mini" @click="showPayload = !showPayload">
                    <template #icon>
                      <icon-eye-invisible v-if="showPayload" />
                      <icon-eye v-else />
                    </template>
                  </a-button>
                  <a-button size="mini" @click="copyPayload">
                    <template #icon><icon-copy /></template>
                    {{ t('nanomq.common.copy') }}
                  </a-button>
                </a-space>
              </template>
              <a-textarea
                v-model="payloadModel"
                :disabled="!showPayload"
                :auto-size="{ minRows: 8, maxRows: 14 }"
                placeholder='{"temperature":25.6,"humidity":60.2}'
              />
            </a-form-item>
            <a-form-item
              field="properties"
              :label="t('nanomq.publish.properties')"
            >
              <a-textarea
                v-model="form.properties"
                :auto-size="{ minRows: 4, maxRows: 8 }"
                placeholder='{"content_type":"text/plain"}'
              />
            </a-form-item>
            <a-button
              type="primary"
              html-type="submit"
              long
              :loading="isPublishing"
              :disabled="isPublishDisabled"
            >
              <template #icon><icon-send /></template>
              {{ t('nanomq.publish.submit') }}
            </a-button>
          </a-form>
        </a-card>
      </a-col>

      <a-col :xs="24" :lg="8">
        <a-card :title="t('nanomq.publish.preview')" :bordered="false">
          <a-descriptions :column="1">
            <a-descriptions-item :label="t('nanomq.publish.topic')">
              {{ form.topics.trim() || form.topic || '-' }}
            </a-descriptions-item>
            <a-descriptions-item label="QoS">
              {{ form.qos }} - {{ qosText(form.qos) }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('nanomq.publish.retain')">
              {{ form.retain ? 'true' : 'false' }}
            </a-descriptions-item>
            <a-descriptions-item label="Payload size">
              {{ payloadSize }} B
            </a-descriptions-item>
          </a-descriptions>
        </a-card>

        <a-card
          class="nanomq-section"
          :title="t('nanomq.publish.history')"
          :bordered="false"
        >
          <template #extra>
            <a-button
              v-if="publishResults.length"
              type="text"
              size="small"
              @click="publishResults = []"
            >
              {{ t('nanomq.publish.clear') }}
            </a-button>
          </template>
          <a-empty v-if="publishResults.length === 0" />
          <a-list v-else :bordered="false" size="small">
            <a-list-item v-for="(item, index) in publishResults" :key="index">
              <a-list-item-meta
                :description="item.timestamp.toLocaleTimeString()"
              >
                <template #title>
                  <a-tag :color="item.success ? 'green' : 'red'">
                    {{ item.message }}
                  </a-tag>
                </template>
              </a-list-item-meta>
            </a-list-item>
          </a-list>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script lang="ts" setup>
  import { computed, reactive, ref } from 'vue';
  import { Message } from '@arco-design/web-vue';
  import { useI18n } from 'vue-i18n';
  import { nanomqAPI, QoS } from '@/api/nanomq';
  import PageHeader from '../components/page-header.vue';
  import { qosText } from '../utils';

  interface PublishForm {
    topic: string;
    topics: string;
    clientid: string;
    payload: string;
    encoding: 'plain' | 'base64';
    qos: QoS;
    retain: boolean;
    properties: string;
  }

  interface PublishResult {
    success: boolean;
    message: string;
    timestamp: Date;
  }

  const { t } = useI18n();
  const form = reactive<PublishForm>({
    topic: '',
    topics: '',
    clientid: '',
    payload: '',
    encoding: 'plain',
    qos: 0,
    retain: false,
    properties: '',
  });
  const isPublishing = ref(false);
  const showPayload = ref(true);
  const publishResults = ref<PublishResult[]>([]);
  const payloadModel = computed({
    get: () => (showPayload.value ? form.payload : '••••••••••••••••'),
    set: (value: string) => {
      if (showPayload.value) form.payload = value;
    },
  });
  const payloadSize = computed(() => new Blob([form.payload]).size);
  const isPublishDisabled = computed(
    () =>
      isPublishing.value ||
      (!form.topic.trim() && !form.topics.trim()) ||
      !form.payload.trim()
  );

  const pushResult = (success: boolean, message: string) => {
    publishResults.value = [
      { success, message, timestamp: new Date() },
      ...publishResults.value,
    ];
  };

  const resetForm = () => {
    form.topic = '';
    form.topics = '';
    form.clientid = '';
    form.payload = '';
    form.encoding = 'plain';
    form.qos = 0;
    form.retain = false;
    form.properties = '';
  };

  const handlePublish = async () => {
    if (isPublishDisabled.value) {
      pushResult(false, t('nanomq.publish.required'));
      return;
    }
    let properties: Record<string, unknown> | undefined;
    if (form.properties.trim()) {
      try {
        const parsed = JSON.parse(form.properties) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('properties must be an object');
        }
        properties = parsed as Record<string, unknown>;
      } catch {
        pushResult(false, 'properties JSON invalid');
        return;
      }
    }

    isPublishing.value = true;
    try {
      const response = await nanomqAPI.publishMessage({
        ...(form.topic.trim() ? { topic: form.topic.trim() } : {}),
        ...(form.topics.trim() ? { topics: form.topics.trim() } : {}),
        ...(form.clientid.trim() ? { clientid: form.clientid.trim() } : {}),
        payload: form.payload,
        encoding: form.encoding,
        qos: form.qos,
        retain: form.retain,
        ...(properties ? { properties } : {}),
      });
      const success = response.code === 0;
      pushResult(
        success,
        success
          ? t('nanomq.publish.success')
          : response.msg || t('nanomq.common.failed')
      );
      if (success) resetForm();
    } catch {
      pushResult(false, t('nanomq.common.failed'));
    } finally {
      isPublishing.value = false;
    }
  };

  const formatPayloadAsJson = () => {
    try {
      form.payload = JSON.stringify(JSON.parse(form.payload), null, 2);
    } catch {
      Message.warning('Payload JSON invalid');
    }
  };

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(form.payload);
      Message.success(t('nanomq.common.copy'));
    } catch {
      Message.error(t('nanomq.common.failed'));
    }
  };
</script>
