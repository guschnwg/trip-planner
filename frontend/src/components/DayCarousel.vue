<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import {
  getEventsOverlappingDate,
  parseDateTime,
  toISODateTime,
  updateEvent,
} from '../stores/events.js';
import { clearHoverMarkers, setHoverMarkers } from '../stores/mapState.js';

const MIN_DURATION_MIN = 15;
const SNAP_MINUTES = 15;
const HOUR_HEIGHT = 48;
const PIXELS_PER_SNAP = (SNAP_MINUTES / 60) * HOUR_HEIGHT;
const MINUTES_PER_DAY = 24 * 60;

const pad2 = (n) => String(n).padStart(2, '0');

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

const formatClock = (absMin) => {
  const d = new Date(absMin * 60000);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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

const props = defineProps({
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  tripId: { type: String, default: null },
});

const emit = defineEmits(['request-add-event', 'request-edit-event']);

const slideIndex = ref(0);
const eventsVersion = ref(0);

const days = computed(() => {
  const start = new Date(`${props.startDate}T00:00:00`);
  const end = new Date(`${props.endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (end < start) return [];
  const result = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    result.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
});

watch(days, (newDays) => {
  if (slideIndex.value >= newDays.length) {
    slideIndex.value = Math.max(0, newDays.length - 1);
  }
});

const currentDay = computed(() => days.value[slideIndex.value] ?? null);

const currentDayISO = computed(() => {
  const date = currentDay.value;
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
});

const hours = Array.from({ length: 24 }, (_, i) => i);

const dayWeekday = (date) =>
  date.toLocaleDateString(undefined, { weekday: 'long' });

const dayFull = (date) =>
  date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const goPrev = () => {
  if (slideIndex.value > 0) slideIndex.value -= 1;
};
const goNext = () => {
  if (slideIndex.value < days.value.length - 1) slideIndex.value += 1;
};

const eventsForCurrentDay = computed(() => {
  if (!currentDayISO.value) return [];
  void eventsVersion.value;
  return getEventsOverlappingDate(props.tripId, currentDayISO.value);
});

const eventBlocks = computed(() => {
  if (!currentDayISO.value) return [];
  const dayStart = dayStartAbsMin(currentDayISO.value);
  const dayEnd = dayStart + MINUTES_PER_DAY;

  const items = [];
  for (const event of eventsForCurrentDay.value) {
    const preview = previews.value[event.id];
    const absStart = preview ? preview.startMin : datetimeToAbsMin(event.startDateTime);
    const absEnd = preview ? preview.endMin : datetimeToAbsMin(event.endDateTime);
    if (absStart == null || absEnd == null || absEnd <= absStart) continue;
    // Clip to the day window so multi-day events render as the visible portion
    // of the current day.
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
    return b.absEnd - b.absStart - (a.absEnd - a.absStart);
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

  const blocks = [];
  for (const item of items) {
    const totalColumns = Math.max(1, clusterOf.get(item).maxCol + 1);
    const col = columnOf.get(item);
    const gap = 6;
    const colWidthPct = 100 / totalColumns;
    const leftPct = col * colWidthPct;
    const offsetMin = item.visibleStart - dayStart;
    const lengthMin = item.visibleEnd - item.visibleStart;
    const top = (offsetMin / 60) * HOUR_HEIGHT + (offsetMin % 60) * (HOUR_HEIGHT / 60) + 4;
    const height = (lengthMin / 60) * HOUR_HEIGHT - 8;
    blocks.push({
      event: item.event,
      absStart: item.absStart,
      absEnd: item.absEnd,
      visibleStart: item.visibleStart,
      visibleEnd: item.visibleEnd,
      top,
      height,
      leftPct,
      widthPct: colWidthPct,
      gap,
      isContinuationStart: item.absStart < dayStart,
      isContinuationEnd: item.absEnd > dayEnd,
    });
  }
  return blocks;
});

const handleRowClick = (hour) => {
  const date = currentDayISO.value;
  const startDateTime = `${date}T${pad2(hour)}:00`;
  const endHour = (hour + 1) % 24;
  const endDay = hour + 1 >= 24
    ? dayKeyFromAbsMin(dayStartAbsMin(date) + 24 * 60)
    : date;
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

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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

const onEventHover = (eventRecord) => {
  setHoverMarkers(buildHoverMarkers(eventRecord));
};

const onEventLeave = () => {
  clearHoverMarkers();
};
</script>

<template>
  <section class="carousel" v-if="days.length">
    <header class="carousel-header">
      <button
        class="nav-btn"
        :disabled="slideIndex === 0"
        @click="goPrev"
        aria-label="Previous day"
      >
        &larr;
      </button>
      <div class="day-info">
        <div class="day-label">
          {{ dayWeekday(currentDay) }}
          <div class="day-count">
            {{ slideIndex + 1 }} of {{ days.length }}
          </div>
        </div>
        <div class="day-date">{{ dayFull(currentDay) }}</div>
      </div>
      <button
        class="nav-btn"
        :disabled="slideIndex >= days.length - 1"
        @click="goNext"
        aria-label="Next day"
      >
        &rarr;
      </button>
    </header>

    <div class="hours-grid">
      <div
        v-for="hour in hours"
        :key="`row-${hour}`"
        class="hour-row"
        :style="{ gridRow: hour + 1 }"
        @click="handleRowClick(hour)"
      >
        <span class="hour-label">
          {{ String(hour).padStart(2, '0') }}:00
        </span>
      </div>
      <div class="hour-slots">
        <div
          v-for="hour in hours"
          :key="`slot-${hour}`"
          class="hour-slot"
          @click="handleRowClick(hour)"
        ></div>
      </div>
      <ul class="event-overlay" :style="{ height: `${24 * HOUR_HEIGHT}px` }" @click.stop>
        <li
          v-for="entry in eventBlocks"
          :key="entry.event.id"
          class="event"
          :class="`event-${entry.event.type}`"
          :style="{
            top: `${entry.top}px`,
            height: `${entry.height}px`,
            left: `calc(${entry.leftPct}% + ${entry.gap / 2}px)`,
            width: `calc(${entry.widthPct}% - ${entry.gap}px)`,
          }"
          @click.stop="emit('request-edit-event', entry.event)"
          @mouseenter="onEventHover(entry.event)"
          @mouseleave="onEventLeave"
        >
          <div
            class="resize-handle resize-handle-top"
            @pointerdown="(e) => startDrag(entry.event, 'start', e)"
            aria-label="Resize start time"
          ></div>
          <div class="event-title">
            <span class="event-type">{{ entry.event.type }}</span>
            <span v-if="entry.event.description" class="event-description">
              {{ entry.event.description }}
            </span>
          </div>
          <div v-if="entry.event.type === 'commute'" class="event-place">
            {{ entry.event.placeFrom || '?' }} &rarr; {{ entry.event.placeTo || '?' }}
          </div>
          <div v-else-if="entry.event.place" class="event-place">
            @ {{ entry.event.place }}
          </div>
          <div v-if="formatPrice(entry.event)" class="event-price">
            <span
              class="event-price-amount"
              :class="{
                'is-paid': !formatPrice(entry.event).isFree && entry.event.isPaid,
                'is-unpaid': !formatPrice(entry.event).isFree && !entry.event.isPaid,
                'is-free': formatPrice(entry.event).isFree,
              }"
            >
              {{ formatPrice(entry.event).text }}
            </span>
            <span v-if="formatPrice(entry.event).isFree" class="event-price-flag">free</span>
            <span v-else-if="!entry.event.isPaid" class="event-price-flag">planned</span>
            <span v-else class="event-price-flag">paid</span>
          </div>
          <ul v-if="entry.event.links && entry.event.links.length" class="event-links">
            <li v-for="(link, li) in entry.event.links" :key="li">
              <a
                :href="link.url"
                target="_blank"
                rel="noopener noreferrer"
                class="event-link"
                @click.stop
              >
                {{ link.label || link.url }}
              </a>
            </li>
          </ul>
          <div
            class="resize-handle resize-handle-bottom"
            @pointerdown="(e) => startDrag(entry.event, 'end', e)"
            aria-label="Resize end time"
          ></div>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.carousel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #ffffff;
  border-right: 1px solid #e2e2e2;
  box-sizing: border-box;
  overflow: hidden;
}

.carousel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #ececec;
  background: #fafafa;
  flex-shrink: 0;
}

.day-info {
  text-align: center;
  min-width: 0;
}

.day-label {
  font-weight: 600;
  font-size: 14px;
  color: #1a1a1a;
  display: flex;
  gap: 10px;
  align-items: center;
}

.day-date {
  font-size: 12px;
  color: #555;
  margin-top: 2px;
}

.day-count {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}

.nav-btn {
  background: #ffffff;
  border: 1px solid #d4d4d4;
  border-radius: 6px;
  width: 32px;
  height: 32px;
  font-size: 14px;
  cursor: pointer;
  color: #333;
}

.nav-btn:hover:not(:disabled) {
  background: #f0f0f0;
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.hours-grid {
  flex: 1;
  position: relative;
  display: grid;
  grid-template-columns: 56px 1fr;
  grid-template-rows: repeat(24, 48px);
  overflow-y: auto;
}

.hour-row {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  grid-column: 1;
  background: #ffffff;
}

.hour-row:hover {
  background: #fafafa;
}

.hour-slots {
  grid-column: 2;
  grid-row: 1 / span 24;
  position: relative;
  border-left: 1px solid #f0f0f0;
}

.hour-slot {
  height: 48px;
  box-sizing: border-box;
  border-bottom: 1px solid #f0f0f0;
  position: relative;
}

.hour-slot:hover {
  background: #fafafa;
}

.hour-label {
  width: 56px;
  flex-shrink: 0;
  padding: 6px 8px;
  font-size: 11px;
  color: #888;
  font-variant-numeric: tabular-nums;
  border-right: 1px solid #f0f0f0;
  background: #fcfcfc;
}

.event-overlay {
  list-style: none;
  margin: 0;
  padding: 0;
  position: absolute;
  top: 0;
  left: 56px;
  right: 0;
  height: 24 * 48px;
  pointer-events: none;
}

.event {
  position: absolute;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  border-left: 3px solid #2b7fff;
  background: #f5f8ff;
  color: #1a1a1a;
  box-sizing: border-box;
  overflow: hidden;
  pointer-events: auto;
  z-index: 1;
}

.resize-handle {
  position: absolute;
  left: 0;
  right: 0;
  height: 8px;
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
  background: rgba(43, 127, 255, 0.18);
}

.event-continuation {
  font-size: 10px;
  color: #888;
  margin: 0 2px;
}

.event-title {
  display: flex;
  gap: 6px;
  align-items: baseline;
  flex-wrap: wrap;
}

.event-type {
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.04em;
  font-weight: 600;
  color: #2b7fff;
}

.event-description {
  font-weight: 500;
}

.event-place {
  font-size: 11px;
  color: #555;
  margin-top: 2px;
}

.event-price {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  font-size: 11px;
  font-weight: 600;
}

.event-price-amount.is-paid {
  color: #166534;
}

.event-price-amount.is-unpaid {
  color: #b54708;
}

.event-price-amount.is-free {
  color: #475569;
  font-weight: 700;
}

.event-price-flag {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #888;
  font-weight: 600;
}

.event-links {
  list-style: none;
  margin: 2px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.event-link {
  font-size: 11px;
  color: #1849a9;
  text-decoration: underline;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.event-link:hover {
  color: #2b7fff;
}

.event-commute {
  border-left-color: #f79009;
  background: #fffaf2;
}
.event-commute .event-type {
  color: #b54708;
}

.event-sleep {
  border-left-color: #7a5af8;
  background: #f4f3ff;
}
.event-sleep .event-type {
  color: #5925dc;
}

.event-food {
  border-left-color: #16a34a;
  background: #f0fdf4;
}
.event-food .event-type {
  color: #166534;
}

.event-activity {
  border-left-color: #2b7fff;
  background: #f5f8ff;
}
.event-activity .event-type {
  color: #1849a9;
}

.event-work {
  border-left-color: #475569;
  background: #f1f5f9;
}
.event-work .event-type {
  color: #1e293b;
}

.event-leisure {
  border-left-color: #db2777;
  background: #fdf2f8;
}
.event-leisure .event-type {
  color: #9d174d;
}

.event-other {
  border-left-color: #6b7280;
  background: #f9fafb;
}
.event-other .event-type {
  color: #374151;
}

.event-accommodation {
  border-left-color: #0891b2;
  background: #ecfeff;
}
.event-accommodation .event-type {
  color: #155e75;
}
</style>
