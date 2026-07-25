<script setup>
import { computed, ref } from 'vue';
import {
  addComparison,
  addPlan,
  removeComparison,
  removePlan,
  removePlanItem,
  trips as tripsRef,
  updateComparison,
  updatePlan,
  updatePlanItem,
} from '../stores/trips.js';
import { activeTrip } from '../stores/trips.js';
import { EVENT_TYPES } from '../stores/events.js';
import { summarizeItems, formatAmount } from '../lib/costSummary.js';
import { useI18n } from '../lib/useI18n.js';

const props = defineProps({
  tripId: { type: String, default: null },
});

const emit = defineEmits(['request-add-item', 'request-edit-item', 'request-add-plan-to-trip']);

const { t, locale } = useI18n();

const activeIndex = ref(0);

const comparisons = computed(() => {
  if (!props.tripId) return [];
  const t = tripsRef.value.find((x) => x.id === props.tripId);
  return t?.comparisons ?? [];
});

const activeComparison = computed(() => {
  if (!comparisons.value.length) return null;
  const idx = Math.min(activeIndex.value, comparisons.value.length - 1);
  return comparisons.value[idx];
});

const isLastComparison = computed(
  () => !comparisons.value.length || activeIndex.value >= comparisons.value.length - 1,
);
const isFirstComparison = computed(() => activeIndex.value <= 0);

const tripStartEnd = computed(() => {
  const t = activeTrip.value;
  if (!t || !t.startDate) return { startDateTime: '', endDateTime: '' };
  const startDate = t.startDate;
  return {
    startDateTime: `${startDate}T09:00`,
    endDateTime: `${startDate}T10:00`,
  };
});

const createComparison = () => {
  if (!props.tripId) return;
  const created = addComparison(props.tripId);
  activeIndex.value = comparisons.value.length - 1;
  return created;
};

const handlePrevComparison = () => {
  if (isFirstComparison.value) return;
  activeIndex.value -= 1;
};

const handleNextComparison = () => {
  if (isLastComparison.value) return;
  activeIndex.value += 1;
};

const renameComparison = (event) => {
  if (!activeComparison.value) return;
  updateComparison(props.tripId, activeComparison.value.id, { name: event.target.value });
};

const deleteCurrentComparison = () => {
  if (!activeComparison.value) return;
  const idx = activeIndex.value;
  removeComparison(props.tripId, activeComparison.value.id);
  if (!comparisons.value.length) {
    activeIndex.value = 0;
    return;
  }
  activeIndex.value = Math.min(idx, comparisons.value.length - 1);
};

const renamePlan = (plan, event) => {
  updatePlan(props.tripId, activeComparison.value.id, plan.id, { name: event.target.value });
};

const addNewPlan = () => {
  addPlan(props.tripId, activeComparison.value.id);
};

const deletePlan = (plan) => {
  removePlan(props.tripId, activeComparison.value.id, plan.id);
};

const openItemSheet = (plan, item = null) => {
  const detail = {
    startDateTime: tripStartEnd.value.startDateTime,
    endDateTime: tripStartEnd.value.endDateTime,
    item,
    comparisonId: activeComparison.value.id,
    planId: plan.id,
  };
  if (item) emit('request-edit-item', detail);
  else emit('request-add-item', detail);
};

const togglePaid = (plan, item) => {
  updatePlanItem(props.tripId, activeComparison.value.id, plan.id, item.id, { isPaid: !item.isPaid });
};

const deleteItem = (plan, item) => {
  removePlanItem(props.tripId, activeComparison.value.id, plan.id, item.id);
};

const addPlanToTrip = (plan) => {
  if (!props.tripId || !activeComparison.value || !plan.items.length) return;
  emit('request-add-plan-to-trip', {
    comparisonId: activeComparison.value.id,
    planId: plan.id,
    items: plan.items.map((item) => ({ ...item })),
  });
};

const summaryFor = (plan) => summarizeItems(plan.items);

const formatFor = (currency) => (amount) => formatAmount(amount, currency, locale.value);

const localizedEventTypes = computed(() =>
  EVENT_TYPES.reduce((acc, type) => {
    acc[type.value] = t(`eventTypes.${type.value}`);
    return acc;
  }, {}),
);

const itemDescription = (item) =>
  item.description || item.place || item.placeFrom || localizedEventTypes.value[item.type] || '';
</script>

<template>
  <div class="comparisons-view">
    <header class="comparison-bar">
      <button
        class="nav-btn"
        type="button"
        :disabled="isFirstComparison"
        :aria-label="t('comparisons.prevComparison')"
        @click="handlePrevComparison"
      >
        ‹
      </button>
      <div class="comparison-title-block">
        <template v-if="activeComparison">
          <input
            class="comparison-name-input"
            type="text"
            :value="activeComparison.name"
            :placeholder="t('comparisons.comparisonNamePlaceholder')"
            @input="renameComparison"
          />
          <span class="comparison-counter">
            {{ activeIndex + 1 }} / {{ comparisons.length }}
          </span>
        </template>
        <template v-else>
          <span class="comparison-name muted">{{ t('comparisons.title') }}</span>
        </template>
      </div>
      <button
        class="nav-btn"
        type="button"
        :disabled="isLastComparison"
        :aria-label="t('comparisons.nextComparison')"
        @click="handleNextComparison"
      >
        ›
      </button>
      <button class="action-btn primary" type="button" @click="createComparison">
        {{ t('comparisons.newComparison') }}
      </button>
      <button
        v-if="activeComparison"
        class="nav-btn danger"
        type="button"
        :aria-label="t('comparisons.deleteComparison')"
        :title="t('comparisons.deleteComparison')"
        @click="deleteCurrentComparison"
      >
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </header>

    <div v-if="!comparisons.length" class="empty-state">
      <p>{{ t('comparisons.empty') }}</p>
      <button class="action-btn primary" type="button" @click="createComparison">
        {{ t('comparisons.newComparison') }}
      </button>
    </div>

    <div v-else class="plans-row">
      <section
        v-for="plan in activeComparison.plans"
        :key="plan.id"
        class="plan-column"
      >
        <header class="plan-header">
          <input
            class="plan-name-input"
            type="text"
            :value="plan.name"
            :placeholder="t('comparisons.planNamePlaceholder')"
            @input="renamePlan(plan, $event)"
          />
          <button
            class="icon-btn danger"
            type="button"
            :aria-label="t('comparisons.deletePlan')"
            @click="deletePlan(plan)"
          >
            &times;
          </button>
        </header>

        <div class="plan-summary">
          <template v-if="summaryFor(plan).buckets.length">
            <div
              v-for="bucket in summaryFor(plan).buckets"
              :key="`bucket-${bucket.currency}`"
              class="summary-bucket"
            >
              <span class="summary-total">{{ formatFor(bucket.currency)(bucket.total) }}</span>
            </div>
          </template>
          <div v-else class="summary-empty">{{ t('cost.total') }}: —</div>
          <div class="summary-meta">
            <span>{{ t('comparisons.summary.items', { count: plan.items.length }) }}</span>
            <span v-if="summaryFor(plan).freeCount">
              · {{ t('comparisons.summary.free', { count: summaryFor(plan).freeCount }) }}
            </span>
          </div>
        </div>

        <ul class="item-list">
          <li
            v-for="item in plan.items"
            :key="item.id"
            class="item-card"
            :class="{ 'is-paid': item.isPaid, 'is-free': item.price == null }"
            @click="openItemSheet(plan, item)"
          >
            <span
              class="item-dot"
              :style="{ background: `var(--cat-${item.type}, var(--color-primary))` }"
              aria-hidden="true"
            ></span>
              <div class="item-body">
                <span class="item-desc">{{ itemDescription(item) }}</span>
                <span class="item-type">
                  {{ localizedEventTypes[item.type] }}
                  <template v-if="item.startDateTime"> · {{ item.startDateTime.replace('T', ' ') }}</template>
                </span>
                <span v-if="item.price != null" class="item-price">
                  {{ formatFor(item.currency)(item.price) }}
                </span>
              </div>
              <button
              class="icon-btn danger item-remove"
              type="button"
              :aria-label="t('comparisons.deleteItem')"
              @click.stop="deleteItem(plan, item)"
            >
              &times;
            </button>
          </li>
        </ul>

        <div class="plan-actions">
          <button
            class="add-plan-to-trip-btn"
            type="button"
            :disabled="!plan.items.length"
            @click="addPlanToTrip(plan)"
          >
            {{ t('comparisons.addPlanToTrip') }}
          </button>
          <button class="add-item-btn" type="button" @click="openItemSheet(plan)">
            {{ t('comparisons.addItem') }}
          </button>
        </div>
      </section>

      <button class="add-plan-tile" type="button" @click="addNewPlan">
        <span class="add-plan-icon">+</span>
        <span>{{ t('comparisons.addPlan') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.comparisons-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  width: 100%;
  overflow: hidden;
}

.comparison-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-strong);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  flex-shrink: 0;
}

.comparison-title-block {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.comparison-name-input,
.plan-name-input {
  font-family: inherit;
  background: transparent;
  border: 0;
  font-weight: 700;
  font-size: 16px;
  color: var(--color-text);
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  transition: background var(--dur-fast) var(--ease-out);
  min-width: 0;
  width: 100%;
}

.comparison-name-input {
  font-size: 18px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  -webkit-background-clip: text;
          background-clip: text;
  color: transparent;
}

.comparison-name-input:focus,
.plan-name-input:focus {
  outline: 0;
  background: var(--color-primary-soft);
  -webkit-background-clip: border-box;
          background-clip: border-box;
  color: var(--color-text);
}

.comparison-name.muted {
  font-weight: 700;
  font-size: 18px;
  color: var(--color-text-faint);
}

.comparison-counter {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-faint);
  font-weight: 700;
  padding-left: 6px;
}

.nav-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: var(--color-surface-strong);
  color: var(--color-text-muted);
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
}

.nav-btn:hover:not(:disabled) {
  background: var(--color-primary-soft);
  color: var(--color-primary-strong);
  border-color: var(--color-primary);
}

.nav-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.nav-btn.danger:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  border-radius: var(--radius-pill);
  cursor: pointer;
  border: 1px solid var(--color-border);
  background: var(--color-surface-strong);
  color: var(--color-text-muted);
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-spring);
  flex-shrink: 0;
}

.action-btn:hover {
  background: var(--color-primary-soft);
  color: var(--color-primary-strong);
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.action-btn.primary {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  color: var(--color-text-inverse);
  border-color: transparent;
}

.action-btn.primary:hover {
  box-shadow: 0 4px 14px var(--color-primary-glow);
  color: var(--color-text-inverse);
}

.action-btn.danger:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 32px;
  color: var(--color-text-faint);
  text-align: center;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
  max-width: 360px;
}

.plans-row {
  flex: 1;
  display: flex;
  gap: 12px;
  padding: 14px;
  overflow-x: auto;
  overflow-y: hidden;
  min-height: 0;
  align-items: stretch;
}

.plan-column {
  display: flex;
  flex-direction: column;
  flex: 0 0 calc((100% - 28px - 90px) / 3);
  min-width: 300px;
  max-width: 360px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.plan-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border-soft);
  background: var(--color-surface-strong);
}

.plan-name-input {
  font-size: 14px;
}

.plan-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  background: var(--color-primary-soft);
  border-bottom: 1px solid var(--color-border-soft);
}

.summary-bucket {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.summary-total {
  font-size: 18px;
  font-weight: 800;
  color: var(--color-primary-strong);
  font-variant-numeric: tabular-nums;
}

.summary-empty {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-faint);
}

.summary-meta {
  display: flex;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-top: 2px;
}

.item-list {
  list-style: none;
  margin: 0;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.item-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 8px;
  padding: 10px;
  border-radius: var(--radius-md);
  background: var(--color-surface-strong);
  border: 1px solid var(--color-border-soft);
  cursor: pointer;
  transition:
    background var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-spring);
}

.item-card:hover {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.item-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.10);
  flex-shrink: 0;
}

.item-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.item-desc {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  overflow-wrap: anywhere;
}

.item-type {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-faint);
  font-weight: 600;
}

.paid-chip {
  padding: 3px 8px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-surface-strong);
  color: var(--color-text-muted);
  cursor: pointer;
  white-space: nowrap;
}

.paid-chip.is-paid {
  background: rgba(16, 185, 129, 0.12);
  color: var(--color-success, #10b981);
  border-color: rgba(16, 185, 129, 0.4);
}

.item-price {
  align-self: flex-start;
  margin-top: 3px;
  padding: 4px 8px;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.item-card.is-paid .item-price {
  color: var(--color-success, #10b981);
}

.item-card.is-free .item-price {
  color: var(--color-text-faint);
}

.icon-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 0;
  background: transparent;
  color: var(--color-text-faint);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.icon-btn.danger:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.plan-actions {
  display: flex;
  gap: 8px;
  margin: 0 12px 12px;
  flex-shrink: 0;
}

.add-item-btn,
.add-plan-to-trip-btn {
  flex: 1;
  padding: 8px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  border: 1px dashed var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
  flex-shrink: 0;
}

.add-item-btn:hover,
.add-plan-to-trip-btn:hover:not(:disabled) {
  background: var(--color-primary-soft);
  color: var(--color-primary-strong);
  border-color: var(--color-primary);
  border-style: solid;
}

.add-plan-to-trip-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.add-plan-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 0 0 80px;
  min-width: 80px;
  padding: 16px 8px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--color-text-faint);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  text-align: center;
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
}

.add-plan-tile:hover {
  background: var(--color-primary-soft);
  color: var(--color-primary-strong);
  border-color: var(--color-primary);
  border-style: solid;
}

.add-plan-icon {
  font-size: 22px;
  font-weight: 700;
}
</style>
