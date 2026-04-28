<template>
  <a-card class="nanomq-metric-card" :bordered="false">
    <div class="nanomq-metric-card__body">
      <div class="nanomq-metric-card__content">
        <div class="nanomq-metric-card__label">{{ label }}</div>
        <div class="nanomq-metric-card__value">{{ value }}</div>
        <div v-if="description" class="nanomq-metric-card__description">
          {{ description }}
        </div>
      </div>
      <div class="nanomq-metric-card__icon" :class="`is-${color || 'blue'}`">
        <slot name="icon" />
      </div>
    </div>
  </a-card>
</template>

<script lang="ts" setup>
  defineProps<{
    label: string;
    value: string | number;
    description?: string;
    color?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan';
  }>();
</script>

<style lang="less" scoped>
  .nanomq-metric-card {
    min-height: 118px;

    &__body {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      min-height: 76px;
    }

    &__content {
      min-width: 0;
    }

    &__label,
    &__description {
      overflow: hidden;
      color: var(--color-text-3);
      font-size: 13px;
      line-height: 20px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__value {
      margin-top: 4px;
      overflow-wrap: anywhere;
      color: var(--color-text-1);
      font-size: 26px;
      font-weight: 600;
      line-height: 34px;
    }

    &__icon {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 8px;

      :deep(.arco-icon) {
        font-size: 22px;
      }

      &.is-blue {
        color: rgb(var(--arcoblue-6));
        background: rgb(var(--arcoblue-1));
      }

      &.is-green {
        color: rgb(var(--green-6));
        background: rgb(var(--green-1));
      }

      &.is-orange {
        color: rgb(var(--orange-6));
        background: rgb(var(--orange-1));
      }

      &.is-red {
        color: rgb(var(--red-6));
        background: rgb(var(--red-1));
      }

      &.is-purple {
        color: rgb(var(--purple-6));
        background: rgb(var(--purple-1));
      }

      &.is-cyan {
        color: rgb(var(--cyan-6));
        background: rgb(var(--cyan-1));
      }
    }
  }
</style>
