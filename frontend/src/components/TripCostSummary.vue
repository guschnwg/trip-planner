<script setup>
import { computed, ref } from 'vue';
import { summarizeCosts, formatAmount } from '../lib/costSummary.js';
import { getEventsForTrip } from '../stores/events.js';
import { useI18n } from '../lib/useI18n.js';

const props = defineProps({
  tripId: { type: String, default: null },
  compact: { type: Boolean, default: false },
});

const { t, locale } = useI18n();

const tooltipVisible = ref(false);
const showTooltip = () => {
  tooltipVisible.value = true;
};
const hideTooltip = () => {
  tooltipVisible.value = false;
};

const hasAnyCosts = computed(() => {
  if (!props.tripId) return false;
  return getEventsForTrip(props.tripId).some((e) => e.price != null);
});

const hasFree = computed(() => freeCount.value > 0);

const summary = computed(() => (props.tripId ? summarizeCosts(props.tripId) : { buckets: [], freeCount: 0 }));
const buckets = computed(() => summary.value.buckets);
const freeCount = computed(() => summary.value.freeCount);

const formatFor = (currency) => (amount) => formatAmount(amount, currency, locale.value);

const grand = computed(() => {
  const map = new Map();
  for (const b of buckets.value) {
    if (!map.has(b.currency)) map.set(b.currency, { total: 0, paid: 0, pending: 0 });
    const acc = map.get(b.currency);
    acc.total += b.total;
    acc.paid += b.paid;
    acc.pending += b.pending;
  }
  return [...map.entries()]
    .map(([currency, value]) => ({ currency, ...value }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
});

const expanded = computed(() => buckets.value.length > 1);
</script>

<template>
  <div v-if="hasAnyCosts" class="cost-summary" :class="{ expanded, compact }">
    <div class="cost-row">
      <div class="cost-cell cost-cell--total">
        <span class="cost-label">{{ t('cost.total') }}</span>
        <span class="cost-amounts">
          <span v-for="b in grand" :key="`total-${b.currency}`" class="cost-amount">
            {{ formatFor(b.currency)(b.total) }}
          </span>
        </span>
      </div>
      <div class="cost-cell cost-cell--paid">
        <span class="cost-label">{{ t('cost.paid') }}</span>
        <span class="cost-amounts">
          <span v-for="b in grand" :key="`paid-${b.currency}`" class="cost-amount">
            {{ formatFor(b.currency)(b.paid) }}
          </span>
        </span>
      </div>
      <div class="cost-cell cost-cell--pending">
        <span class="cost-label">{{ t('cost.pending') }}</span>
        <span class="cost-amounts">
          <span v-for="b in grand" :key="`pending-${b.currency}`" class="cost-amount">
            {{ formatFor(b.currency)(b.pending) }}
          </span>
        </span>
      </div>
      <div
        v-if="hasFree"
        class="cost-cell cost-cell--free"
        @mouseenter="showTooltip"
        @mouseleave="hideTooltip"
        @focusin="showTooltip"
        @focusout="hideTooltip"
      >
        <span class="cost-label">
          <span class="cost-warn" aria-hidden="true">!</span>
          {{ t('cost.free') }}
        </span>
        <span class="cost-amount">{{ freeCount }}</span>
        <span
          v-if="tooltipVisible"
          class="cost-tooltip"
          role="tooltip"
        >{{ t('cost.tooltip') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cost-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cost-summary.expanded .cost-row {
  grid-template-columns: 1fr 1fr 1fr 1fr;
}

.cost-row {
  display: grid;
  grid-template-columns: auto auto auto auto;
  gap: 6px;
  align-items: center;
}

.cost-summary.compact {
  flex-direction: row;
  gap: 0;
  align-items: center;
}

.cost-summary.compact .cost-row {
  display: contents;
}

.cost-cell {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  border: 1px solid var(--color-border-soft);
  min-width: 0;
  white-space: nowrap;
}

.cost-summary.compact .cost-cell {
  background: transparent;
  border-color: transparent;
  padding: 4px 8px;
}

.cost-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  font-weight: 700;
  white-space: nowrap;
}

.cost-summary.compact .cost-label {
  font-size: 9px;
}

.cost-amounts {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.cost-amount {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text);
  white-space: nowrap;
}

.cost-cell--paid .cost-amount {
  color: var(--color-success, #16a34a);
}

.cost-cell--pending .cost-amount {
  color: var(--color-warning, #f79009);
}

.cost-cell--free {
  cursor: help;
  position: relative;
}

.cost-cell--free .cost-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.cost-warn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-warning, #f79009);
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
}

.cost-cell--free .cost-amount {
  color: var(--color-warning, #f79009);
}

.cost-tooltip {
  position: absolute;
  top: 50%;
  left: calc(100% + 6px);
  transform: translateY(-50%);
  background: var(--color-text, #1f2937);
  color: var(--color-surface, #fff);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;
  text-transform: none;
  letter-spacing: normal;
  padding: 6px 8px;
  border-radius: var(--radius-sm, 6px);
  white-space: normal;
  max-width: 220px;
  width: max-content;
  text-align: center;
  box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.15));
  z-index: 10;
  pointer-events: none;
}

.cost-tooltip::after {
  content: '';
  position: absolute;
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  border: 4px solid transparent;
  border-right-color: var(--color-text, #1f2937);
}
</style>