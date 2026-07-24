<script setup>
import { computed, ref } from 'vue';
import { getEventsForTrip } from '../stores/events.js';
import { summarizeCosts, formatAmount } from '../lib/costSummary.js';
import { useI18n } from '../lib/useI18n.js';

const props = defineProps({
  view: { type: String, required: true },
  tripId: { type: String, default: null },
  mapStyleId: { type: String, default: null },
  mapStyles: { type: Array, default: () => [] },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
});

const emit = defineEmits([
  'request-edit-event',
  'fly-to-place',
  'update:mapStyleId',
  'update:startDate',
  'update:endDate',
]);

const { t, locale, availableLocales, changeLocale } = useI18n();

const events = computed(() => (props.tripId ? getEventsForTrip(props.tripId) : []));

const places = computed(() => {
  const seen = new Map();
  for (const event of events.value) {
    if (event.type === 'commute') {
      if (event.placeFrom && event.placeFromCoords) {
        const key = `from-${event.placeFromCoords.lng},${event.placeFromCoords.lat}`;
        const existing = seen.get(key);
        if (existing) existing.uses += 1;
        else
          seen.set(key, {
            id: key,
            name: event.placeFrom,
            coords: event.placeFromCoords,
            eventCount: 1,
            type: event.type,
          });
      }
      if (event.placeTo && event.placeToCoords) {
        const key = `to-${event.placeToCoords.lng},${event.placeToCoords.lat}`;
        const existing = seen.get(key);
        if (existing) existing.uses += 1;
        else
          seen.set(key, {
            id: key,
            name: event.placeTo,
            coords: event.placeToCoords,
            eventCount: 1,
            type: event.type,
          });
      }
    } else if (event.place && event.placeCoords) {
      const key = `${event.placeCoords.lng},${event.placeCoords.lat}`;
      const existing = seen.get(key);
      if (existing) existing.uses += 1;
      else
        seen.set(key, {
          id: key,
          name: event.place,
          coords: event.placeCoords,
          eventCount: 1,
          type: event.type,
        });
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
});

const financialRows = computed(() => {
  const rows = [];
  for (const event of events.value) {
    rows.push({
      id: event.id,
      description: event.description || event.place || event.placeFrom || '',
      type: event.type,
      isPaid: event.isPaid,
      price: event.price,
      currency: event.currency || 'USD',
      event,
    });
  }
  return rows.sort((a, b) => {
    if (a.isPaid !== b.isPaid) return a.isPaid ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
});

const hasFinancials = computed(() =>
  events.value.some((e) => e.price != null || e.isPaid || e.type === 'commute'),
);

const totals = computed(() => {
  if (!props.tripId) return { buckets: [], freeCount: 0 };
  return summarizeCosts(props.tripId);
});

const formatFor = (currency) => (amount) => formatAmount(amount, currency, locale.value);

const onPlaceClick = (place) => {
  if (!place.coords) return;
  emit('fly-to-place', place.coords);
};

const onFinancialRowClick = (row) => {
  emit('request-edit-event', row.event);
};

const onMapStyleChange = (event) => {
  emit('update:mapStyleId', event.target.value);
};

const eventTypeLabel = (type) => t(`eventTypes.${type}`);

const localeFlag = { en: 'EN', pt: 'PT', es: 'ES' };
</script>

<template>
  <div class="left-sidebar-pane">
    <div v-if="view === 'places'" class="tab-pane">
      <p v-if="!places.length" class="empty">{{ t('rightSidebar.places.empty') }}</p>
      <ul v-else class="place-list">
        <li
          v-for="place in places"
          :key="place.id"
          class="place-item"
          @click="onPlaceClick(place)"
        >
          <span
            class="place-dot"
            :style="{ background: `var(--cat-${place.type}, var(--color-primary))` }"
            aria-hidden="true"
          ></span>
          <div class="place-info">
            <span class="place-name">{{ place.name }}</span>
            <span class="place-meta">
              {{ eventTypeLabel(place.type) }} · {{ place.eventCount }}×
            </span>
          </div>
        </li>
      </ul>
    </div>

    <div v-else-if="view === 'finances'" class="tab-pane">
      <p v-if="!hasFinancials" class="empty">{{ t('rightSidebar.finance.empty') }}</p>
      <template v-else>
        <div class="finance-totals">
          <div
            v-for="bucket in totals.buckets"
            :key="`bucket-${bucket.currency}`"
            class="finance-bucket"
          >
            <span class="finance-label">{{ t('cost.total') }}</span>
            <span class="finance-amount">{{ formatFor(bucket.currency)(bucket.total) }}</span>
            <span class="finance-sub">
              {{ t('cost.paid') }}: {{ formatFor(bucket.currency)(bucket.paid) }}
            </span>
            <span class="finance-sub">
              {{ t('cost.pending') }}: {{ formatFor(bucket.currency)(bucket.pending) }}
            </span>
          </div>
          <div v-if="totals.freeCount" class="finance-free">
            {{ t('cost.free') }}: {{ totals.freeCount }}
          </div>
        </div>

        <ul class="finance-list">
          <li
            v-for="row in financialRows"
            :key="row.id"
            class="finance-row"
            :class="{ 'is-paid': row.isPaid, 'is-free': row.price == null }"
            @click="onFinancialRowClick(row)"
          >
            <span
              class="finance-type-dot"
              :style="{ background: `var(--cat-${row.type}, var(--color-primary))` }"
              aria-hidden="true"
            ></span>
            <span class="finance-desc">{{ row.description || eventTypeLabel(row.type) }}</span>
            <span class="finance-price">
              <template v-if="row.price == null">{{ t('event.free') }}</template>
              <template v-else>{{ formatFor(row.currency)(row.price) }}</template>
            </span>
          </li>
        </ul>
      </template>
    </div>

    <div v-else-if="view === 'settings'" class="tab-pane">
      <section class="settings-group" v-if="tripId">
        <h3 class="settings-heading">{{ t('rightSidebar.settings.dates') }}</h3>
        <label class="settings-field">
          <span class="settings-field-label">{{ t('app.startDate') }}</span>
          <input
            class="tp-input tp-input--compact"
            type="date"
            :value="startDate"
            :max="endDate || undefined"
            @input="emit('update:startDate', $event.target.value)"
          />
        </label>
        <label class="settings-field">
          <span class="settings-field-label">{{ t('app.endDate') }}</span>
          <input
            class="tp-input tp-input--compact"
            type="date"
            :value="endDate"
            :min="startDate || undefined"
            @input="emit('update:endDate', $event.target.value)"
          />
        </label>
      </section>

      <section class="settings-group">
        <h3 class="settings-heading">{{ t('rightSidebar.settings.mapTheme') }}</h3>
        <select
          class="tp-input tp-input--compact"
          :value="mapStyleId || ''"
          @change="onMapStyleChange"
        >
          <option v-for="s in mapStyles" :key="s.id" :value="s.id">
            {{ s.label }}
          </option>
        </select>
      </section>

      <section class="settings-group">
        <h3 class="settings-heading">{{ t('language.label') }}</h3>
        <div class="settings-langs">
          <button
            v-for="code in availableLocales"
            :key="code"
            type="button"
            class="settings-lang-btn"
            :class="{ active: code === locale }"
            @click="changeLocale(code)"
          >
            <span class="settings-lang-flag">{{ localeFlag[code] || code.toUpperCase() }}</span>
            <span>{{ t(`language.${code}`) }}</span>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.left-sidebar-pane {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 12px;
}

.tab-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.empty {
  margin: 24px 0;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-faint);
}

.place-list,
.finance-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.place-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  background: var(--color-surface-strong);
  border: 1px solid var(--color-border-soft);
  cursor: pointer;
  transition:
    background var(--dur-base) var(--ease-out),
    border-color var(--dur-base) var(--ease-out),
    transform var(--dur-fast) var(--ease-spring);
}

.place-item:hover {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
  transform: translateX(-2px);
}

.place-dot,
.finance-type-dot {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.10);
}

.place-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.place-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.place-meta {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-faint);
  font-weight: 600;
}

.finance-totals {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--color-border-soft);
  margin-bottom: 4px;
}

.finance-bucket {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  background: var(--color-surface-strong);
  border: 1px solid var(--color-border-soft);
}

.finance-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  font-weight: 700;
}

.finance-amount {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
}

.finance-sub {
  font-size: 11px;
  color: var(--color-text-faint);
}

.finance-free {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-warning, #f59e0b);
  align-self: center;
}

.finance-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  background: var(--color-surface-strong);
  border: 1px solid var(--color-border-soft);
  cursor: pointer;
  transition:
    background var(--dur-base) var(--ease-out),
    border-color var(--dur-base) var(--ease-out),
    transform var(--dur-fast) var(--ease-spring);
}

.finance-row:hover {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
  transform: translateX(-2px);
}

.finance-row.is-free .finance-price {
  color: var(--color-text-faint);
}

.finance-desc {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.finance-price {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text);
  white-space: nowrap;
}

.finance-row.is-paid .finance-price {
  color: var(--color-success, #10b981);
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border-soft);
}

.settings-group:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.settings-heading {
  margin: 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  font-weight: 700;
}

.settings-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-field-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-faint);
  font-weight: 700;
}

.settings-langs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.settings-lang-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  color: var(--color-text-muted);
  background: var(--color-surface-strong);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition:
    background var(--dur-base) var(--ease-out),
    border-color var(--dur-base) var(--ease-out),
    color var(--dur-base) var(--ease-out);
}

.settings-lang-btn:hover:not(.active) {
  color: var(--color-text);
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}

.settings-lang-btn.active {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  color: var(--color-text-inverse);
  border-color: transparent;
  box-shadow: 0 4px 14px var(--color-primary-glow);
}

.settings-lang-flag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 800;
  background: var(--color-primary-soft);
  color: var(--color-primary-strong);
}

.settings-lang-btn.active .settings-lang-flag {
  background: rgba(255, 255, 255, 0.22);
  color: var(--color-text-inverse);
}
</style>
