<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import {
  getEventsOverlappingDate,
  parseDateTime,
  toISODateTime,
  updateEvent,
} from '../stores/events.js';
import { clearHoverMarkers, setHoverMarkers } from '../stores/mapState.js';
import { useI18n } from '../lib/useI18n.js';

const { t } = useI18n();

const props = defineProps({
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  tripId: { type: String, default: null },
});

const emit = defineEmits(['request-add-event', 'request-edit-event']);

const eventsVersion = ref(0);

const HOUR_HEIGHT = 28;
const DAY_WIDTH = 180;
const SNAP_MINUTES = 15;
const MIN_DURATION_MIN = 15;
const PIXELS_PER_SNAP = (SNAP_MINUTES / 60) * HOUR_HEIGHT;
const MINUTES_PER_DAY = 24 * 60;
const MAX_DAYS = 60;

const pad2 = (n) => String(n).padStart(2, '0');

const days = computed(() => {
  const start = new Date(`${props.startDate}T00:00:00`);
  const end = new Date(`${props.endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (end < start) return [];
  const out = [];
  const cursor = new Date(start);
  while (cursor <= end && out.length < MAX_DAYS) {
    out.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
});

const hours = Array.from({ length: 25 }, (_, i) => i);

const dayISO = (date) => {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
};

const dayStartAbsMin = (dateStr) => {
  const d = parseDateTime(`${dateStr}T00:00`);
  return d ? d.getTime() / 60000 : 0;
};

const datetimeToAbsMin = (value) => {
  const d = parseDateTime(value);
  return d ? d.getTime() / 60000 : null;
};

const absMinToDateTime = (absMin) => {
  const d = new Date(absMin * 60000);
  d.setSeconds(0, 0);
  return toISODateTime(d);
};

const formatPrice = (event) => {
  if (event.price == null) return null;
  const amount = Number(event.price);
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (amount === 0) return { text: 'free', isFree: true };
  const currency = event.currency || '';
  const symbol =
    currency === 'USD' ? '$' :
    currency === 'EUR' ? '€' :
    currency === 'GBP' ? '£' :
    currency === 'BRL' ? 'R$' :
    currency === 'JPY' ? '¥' :
    '';
  const num = amount % 1 === 0
    ? amount.toString()
    : amount.toFixed(2);
  const text = symbol ? `${symbol}${num}` : `${num} ${currency}`.trim();
  return { text, isFree: false };
};

const eventTypeLabel = (type) => t(`eventTypes.${type}`);

const priceFlagLabel = (event) => {
  const formatted = formatPrice(event);
  if (!formatted) return '';
  if (formatted.isFree) return t('event.free');
  return event.isPaid ? t('event.paid') : t('event.planned');
};

const dayHeader = (date) =>
  date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

const dayWeekday = (date) =>
  date.toLocaleDateString(undefined, { weekday: 'short' });

const buildDayBlocks = (dayDate) => {
  const dateStr = dayISO(dayDate);
  void eventsVersion.value;
  const events = getEventsOverlappingDate(props.tripId, dateStr);
  const dayStart = dayStartAbsMin(dateStr);
  const dayEnd = dayStart + MINUTES_PER_DAY;

  const items = [];
  for (const event of events) {
    const preview = previews.value[event.id];
    const absStart = preview ? preview.startMin : datetimeToAbsMin(event.startDateTime);
    const absEnd = preview ? preview.endMin : datetimeToAbsMin(event.endDateTime);
    if (absStart == null || absEnd == null || absEnd <= absStart) continue;
    const visibleStart = Math.max(absStart, dayStart);
    const visibleEnd = Math.min(absEnd, dayEnd);
    if (visibleEnd <= visibleStart) continue;
    items.push({
      event,
      absStart,
      absEnd,
      visibleStart,
      visibleEnd,
    });
  }

  items.sort((a, b) => {
    if (a.absStart !== b.absStart) return a.absStart - b.absStart;
    return b.absEnd - a.absStart - (a.absEnd - a.absStart);
  });

  const columns = [];
  const columnOf = new Map();
  for (const item of items) {
    let assigned = -1;
    for (let c = 0; c < columns.length; c += 1) {
      if (columns[c] <= item.absStart) {
        assigned = c;
        break;
      }
    }
    if (assigned === -1) {
      assigned = columns.length;
      columns.push(item.absEnd);
    } else {
      columns[assigned] = item.absEnd;
    }
    columnOf.set(item, assigned);
  }

  const clusterOf = new Map();
  let cluster = null;
  let clusterEnd = -Infinity;
  let clusterMaxCol = 0;
  for (const item of items) {
    if (item.absStart >= clusterEnd) {
      cluster = { maxCol: 0 };
      clusterEnd = item.absEnd;
    } else if (item.absEnd > clusterEnd) {
      clusterEnd = item.absEnd;
    }
    const col = columnOf.get(item);
    if (col > cluster.maxCol) cluster.maxCol = col;
    clusterOf.set(item, cluster);
  }

  return items.map((item) => {
    const totalColumns = Math.max(1, clusterOf.get(item).maxCol + 1);
    const col = columnOf.get(item);
    const gap = 4;
    const bandLeftPct = 2;
    const bandWidthPct = 90;
    const evenWidthPct = bandWidthPct / totalColumns;
    const blockWidthPct =
      totalColumns === 1
        ? bandWidthPct
        : evenWidthPct * 1.5;
    const stepPct =
      totalColumns === 1
        ? 0
        : (bandWidthPct - blockWidthPct) / (totalColumns - 1);
    const leftPct = bandLeftPct + col * stepPct;
    const widthPct = blockWidthPct;
    const offsetMin = item.visibleStart - dayStart;
    const lengthMin = item.visibleEnd - item.visibleStart;
    const top = (offsetMin / 60) * HOUR_HEIGHT + 4;
    const height = (lengthMin / 60) * HOUR_HEIGHT - 6;
    return {
      event: item.event,
      absStart: item.absStart,
      absEnd: item.absEnd,
      visibleStart: item.visibleStart,
      visibleEnd: item.visibleEnd,
      top,
      height,
      leftPct,
      widthPct,
      gap,
      isContinuationStart: item.absStart < dayStart,
      isContinuationEnd: item.absEnd > dayEnd,
    };
  });
};

const dayBlocksMap = computed(() => {
  const map = new Map();
  for (const day of days.value) {
    map.set(dayISO(day), buildDayBlocks(day));
  }
  return map;
});

const handleSlotClick = (dateStr, hour) => {
  const startDateTime = `${dateStr}T${pad2(hour)}:00`;
  const endHour = (hour + 1) % 24;
  const endDay = hour + 1 >= 24
    ? dayKeyFromAbsMin(dayStartAbsMin(dateStr) + MINUTES_PER_DAY)
    : dateStr;
  const endDateTime = `${endDay}T${pad2(endHour)}:00`;
  emit('request-add-event', { startDateTime, endDateTime });
};

const dayKeyFromAbsMin = (absMin) => {
  const d = new Date(absMin * 60000);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const previews = ref({});
const dragState = ref(null);

const startDrag = (eventRecord, edge, pointerEvent) => {
  pointerEvent.preventDefault();
  pointerEvent.stopPropagation();
  const absStart = datetimeToAbsMin(eventRecord.startDateTime);
  const absEnd = datetimeToAbsMin(eventRecord.endDateTime);
  if (absStart == null || absEnd == null) return;
  dragState.value = {
    id: eventRecord.id,
    edge,
    startMin: absStart,
    endMin: absEnd,
    startClientY: pointerEvent.clientY,
    accumulatedSnaps: 0,
  };
  previews.value = {
    ...previews.value,
    [eventRecord.id]: { startMin: absStart, endMin: absEnd },
  };
  window.addEventListener('pointermove', handleDragMove);
  window.addEventListener('pointerup', handleDragEnd, { once: true });
  window.addEventListener('pointercancel', handleDragEnd, { once: true });
};

const handleDragMove = (pointerEvent) => {
  if (!dragState.value) return;
  const deltaY = pointerEvent.clientY - dragState.value.startClientY;
  const totalSnaps = Math.round(deltaY / PIXELS_PER_SNAP);
  const snapDelta = totalSnaps - dragState.value.accumulatedSnaps;
  if (snapDelta === 0) return;
  dragState.value.accumulatedSnaps = totalSnaps;
  const deltaMinutes = snapDelta * SNAP_MINUTES;
  let { startMin, endMin, edge } = dragState.value;
  if (edge === 'end') {
    endMin = endMin + deltaMinutes;
    if (endMin - startMin < MIN_DURATION_MIN) endMin = startMin + MIN_DURATION_MIN;
  } else {
    startMin = startMin + deltaMinutes;
    if (endMin - startMin < MIN_DURATION_MIN) startMin = endMin - MIN_DURATION_MIN;
  }
  dragState.value.startMin = startMin;
  dragState.value.endMin = endMin;
  previews.value = {
    ...previews.value,
    [dragState.value.id]: { startMin, endMin },
  };
};

const handleDragEnd = () => {
  window.removeEventListener('pointermove', handleDragMove);
  if (dragState.value) {
    const { id, startMin, endMin } = dragState.value;
    updateEvent(null, id, {
      startDateTime: absMinToDateTime(startMin),
      endDateTime: absMinToDateTime(endMin),
    });
    eventsVersion.value += 1;
  }
  dragState.value = null;
  previews.value = {};
};

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', handleDragMove);
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }
  clearHoverMarkers();
});

const buildHoverMarkers = (eventRecord) => {
  const markers = [];
  if (eventRecord.type === 'commute') {
    if (eventRecord.placeFromCoords) {
      markers.push({
        id: `${eventRecord.id}-from`,
        lng: eventRecord.placeFromCoords.lng,
        lat: eventRecord.placeFromCoords.lat,
        label: eventRecord.placeFrom,
        color: '#f79009',
        variant: 'hover',
      });
    }
    if (eventRecord.placeToCoords) {
      markers.push({
        id: `${eventRecord.id}-to`,
        lng: eventRecord.placeToCoords.lng,
        lat: eventRecord.placeToCoords.lat,
        label: eventRecord.placeTo,
        color: '#16a34a',
        variant: 'hover',
      });
    }
  } else if (eventRecord.placeCoords) {
    markers.push({
      id: eventRecord.id,
      lng: eventRecord.placeCoords.lng,
      lat: eventRecord.placeCoords.lat,
      label: eventRecord.place,
      color: '#2b7fff',
      variant: 'hover',
    });
  }
  return markers;
};

const HOVER_DELAY_MS = 250;
let hoverTimer = null;

const onEventHover = (eventRecord) => {
  if (hoverTimer) clearTimeout(hoverTimer);
  const markers = buildHoverMarkers(eventRecord);
  hoverTimer = setTimeout(() => {
    setHoverMarkers(markers);
    hoverTimer = null;
  }, HOVER_DELAY_MS);
};

const onEventLeave = () => {
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }
  clearHoverMarkers();
};
</script>

<template>
  <div class="trip-calendar" v-if="days.length">
    <div class="hours-rail">
      <div class="hours-rail-header"></div>
      <div class="hours-rail-body">
        <div
          v-for="hour in hours"
          :key="hour"
          class="hour-tick"
          :style="{ height: `${HOUR_HEIGHT}px` }"
        >
          <span v-if="hour < 24">{{ String(hour).padStart(2, '0') }}:00</span>
        </div>
      </div>
    </div>

    <div class="day-strip">
      <div
        v-for="day in days"
        :key="dayISO(day)"
        class="day-column"
        :style="{ width: `${DAY_WIDTH}px` }"
      >
        <div class="day-header">
          <div class="day-weekday">{{ dayWeekday(day) }}</div>
          <div class="day-date">{{ dayHeader(day) }}</div>
        </div>
        <div class="day-body" :style="{ height: `${24 * HOUR_HEIGHT}px` }">
          <div
            v-for="hour in 24"
            :key="`grid-${hour}`"
            class="hour-cell"
            :style="{ height: `${HOUR_HEIGHT}px` }"
            @click="handleSlotClick(dayISO(day), hour - 1)"
          ></div>
          <ul class="event-layer">
            <li
              v-for="block in dayBlocksMap.get(dayISO(day)) || []"
              :key="`${dayISO(day)}-${block.event.id}`"
              class="event"
              :class="`event-${block.event.type}`"
              :style="{
                top: `${block.top}px`,
                height: `${block.height}px`,
                left: `calc(${block.leftPct}% + ${block.gap / 2}px)`,
                width: `calc(${block.widthPct}% - ${block.gap}px)`,
              }"
              @click.stop="emit('request-edit-event', block.event)"
              @mouseenter="onEventHover(block.event)"
              @mouseleave="onEventLeave"
            >
              <div
                class="resize-handle resize-handle-top"
                @pointerdown="(e) => startDrag(block.event, 'start', e)"
                :aria-label="t('calendar.resizeStart')"
              ></div>
              <div class="event-title">
                <span class="event-type">{{ eventTypeLabel(block.event.type) }}</span>
                <span v-if="block.event.description" class="event-description">
                  {{ block.event.description }}
                </span>
              </div>
              <div
                v-if="formatPrice(block.event)"
                class="event-price"
                :class="{
                  'is-paid': !formatPrice(block.event).isFree && block.event.isPaid,
                  'is-unpaid': !formatPrice(block.event).isFree && !block.event.isPaid,
                  'is-free': formatPrice(block.event).isFree,
                }"
              >
                <span class="event-price-amount">{{ formatPrice(block.event).text }}</span>
                <span class="event-price-flag">
                  {{ priceFlagLabel(block.event) }}
                </span>
              </div>
              <div
                class="resize-handle resize-handle-bottom"
                @pointerdown="(e) => startDrag(block.event, 'end', e)"
                :aria-label="t('calendar.resizeEnd')"
              ></div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="empty">{{ t('calendar.empty') }}</div>
</template>

<style scoped>
.trip-calendar {
  display: flex;
  height: 100%;
  overflow: auto;
  background: var(--color-surface);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  animation: fadeIn var(--dur-slow) var(--ease-out);
}

.hours-rail {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: sticky;
  left: 0;
  background: var(--color-surface-strong);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border-right: 1px solid var(--color-border);
  z-index: 2;
}

.hours-rail-header {
  height: 56px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-strong);
  flex-shrink: 0;
}

.hours-rail-body {
  display: flex;
  flex-direction: column;
}

.hour-tick {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  border-bottom: 1px solid var(--color-border-soft);
  box-sizing: border-box;
}

.day-strip {
  display: flex;
  flex: 1;
}

.day-column {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border-soft);
}

.day-header {
  height: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-strong);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  padding: 4px;
  position: relative;
}

.day-header::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 12px;
  right: 12px;
  height: 2px;
  background: linear-gradient(90deg,
    transparent 0%,
    var(--color-primary) 50%,
    transparent 100%);
  border-radius: 2px;
  opacity: 0.5;
}

.day-weekday {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--color-text-muted);
  letter-spacing: 0.05em;
  font-weight: 700;
}

.day-date {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text);
}

.day-body {
  position: relative;
  cursor: crosshair;
}

.hour-cell {
  border-bottom: 1px solid var(--color-border-soft);
  box-sizing: border-box;
  transition: background var(--dur-fast) var(--ease-out);
}

.hour-cell:hover {
  background: var(--color-primary-soft);
}

.event-layer {
  list-style: none;
  margin: 0;
  padding: 0;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.event {
  position: absolute;
  border-radius: var(--radius-sm);
  padding: 2px 4px;
  font-size: 10px;
  border-left: 3px solid var(--color-primary);
  background: var(--color-activity-bg, var(--color-primary-soft));
  color: var(--color-text);
  box-sizing: border-box;
  overflow: hidden;
  pointer-events: auto;
  z-index: 1;
  cursor: pointer;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  transition:
    transform var(--dur-fast) var(--ease-spring),
    filter var(--dur-base) var(--ease-out),
    box-shadow var(--dur-base) var(--ease-out);
  animation: pop var(--dur-slow) var(--ease-spring) both;
}

.event:hover {
  transform: translateY(-1px) scale(1.02);
  filter: brightness(1.06);
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.14);
  z-index: 2;
}

.event-title {
  display: flex;
  gap: 3px;
  align-items: baseline;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-type {
  text-transform: uppercase;
  font-size: 8px;
  letter-spacing: 0.05em;
  font-weight: 800;
  color: var(--color-primary-strong);
  flex-shrink: 0;
}

.event-description {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-price {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  font-weight: 700;
  line-height: 1.2;
}

.event-price.is-paid .event-price-amount {
  color: #166534;
}

.event-price.is-unpaid .event-price-amount {
  color: #b54708;
}

.event-price.is-free .event-price-amount {
  color: #475569;
}

.event-price-flag {
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  font-weight: 700;
}

.resize-handle {
  position: absolute;
  left: 0;
  right: 0;
  height: 6px;
  cursor: ns-resize;
  z-index: 2;
}

.resize-handle-top {
  top: 0;
}

.resize-handle-bottom {
  bottom: 0;
}

.resize-handle:hover {
  background: rgba(99, 102, 241, 0.22);
}

.event-commute { border-left-color: var(--cat-commute); background: var(--cat-commute-bg); }
.event-commute .event-type { color: #b54708; }
.event-sleep { border-left-color: var(--cat-sleep); background: var(--cat-sleep-bg); }
.event-sleep .event-type { color: #5925dc; }
.event-food { border-left-color: var(--cat-food); background: var(--cat-food-bg); }
.event-food .event-type { color: #166534; }
.event-activity { border-left-color: var(--cat-activity); background: var(--cat-activity-bg); }
.event-activity .event-type { color: var(--color-primary-strong); }
.event-work { border-left-color: var(--cat-work); background: var(--cat-work-bg); }
.event-work .event-type { color: #1e293b; }
.event-leisure { border-left-color: var(--cat-leisure); background: var(--cat-leisure-bg); }
.event-leisure .event-type { color: #9d174d; }
.event-other { border-left-color: var(--cat-other); background: var(--cat-other-bg); }
.event-other .event-type { color: #374151; }
.event-accommodation { border-left-color: var(--cat-accommodation); background: var(--cat-accommodation-bg); }
.event-accommodation .event-type { color: #155e75; }

.empty {
  padding: 40px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
  font-style: italic;
}
</style>