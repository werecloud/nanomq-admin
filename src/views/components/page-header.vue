<template>
  <div class="nanomq-page-header">
    <div class="nanomq-page-header__main">
      <div v-if="$slots.icon" class="nanomq-page-header__icon">
        <slot name="icon" />
      </div>
      <div>
        <h1>{{ title }}</h1>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
    </div>
    <div v-if="$slots.actions" class="nanomq-page-header__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script lang="ts" setup>
  defineProps<{
    title: string;
    subtitle?: string;
  }>();
</script>

<style lang="less" scoped>
  .nanomq-page-header {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 20px;

    &__main {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      min-width: 0;
    }

    &__icon {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      color: rgb(var(--arcoblue-6));
      background: rgb(var(--arcoblue-1));
      border-radius: 8px;
    }

    &__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }

    h1 {
      margin: 0;
      color: var(--color-text-1);
      font-size: 24px;
      font-weight: 600;
      line-height: 32px;
    }

    p {
      margin: 4px 0 0;
      color: var(--color-text-3);
      line-height: 22px;
    }
  }

  @media (max-width: @screen-sm) {
    .nanomq-page-header {
      flex-direction: column;

      &__actions {
        width: 100%;
        justify-content: flex-start;
      }
    }
  }
</style>
