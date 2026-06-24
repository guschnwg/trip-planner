import { reactive, watch } from 'vue';

const STORAGE_KEY = 'tracker.events';

export const EVENT_TYPES = [
  { value: 'commute', label: 'Commute' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'food', label: 'Food' },
  { value: 'activity', label: 'Activity' },
  { value: 'work', label: 'Work' },
  { value: 'leisure', label: 'Leisure' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'other', label: 'Other' },
];

const isCoord = (value) =>
  value && typeof value === 'object' && Number.isFinite(value.lng) && Number.isFinite(value.lat);

const sanitizePrice = (input) => {
  if (input == null || input === '') return null;
  const amount = Number(input);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount;
};

const sanitizeLinks = (input) => {
  if (!Array.isArray(input)) return [];
  return input
    .filter((l) => l && typeof l === 'object')
    .map((l) => ({
      label: typeof l.label === 'string' ? l.label.trim().slice(0, 80) : '',
      url: typeof l.url === 'string' ? l.url.trim().slice(0, 500) : '',
    }))
    .filter((l) => l.url);
};

const pad2 = (n) => String(n).padStart(2, '0');

const toISODateTime = (date) => {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
};

const parseDateTime = (value) => {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const date = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    0,
    0,
  );
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const load = () => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
      // Legacy bucket format { [date]: events[] } — flatten it.
      const out = [];
      for (const bucket of Object.values(parsed)) {
        if (Array.isArray(bucket)) out.push(...bucket);
      }
      return out;
    }
    return [];
  } catch {
    return [];
  }
};

let legacyMigrationTripId = null;
export const setLegacyMigrationTripId = (tripId) => {
  legacyMigrationTripId = tripId;
};

// One-time migration: re-tag any stored event without a tripId to the given
// trip, then persist. Safe to call on every load (no-ops when nothing to do).
export const migrateLegacyEvents = (tripId) => {
  if (!tripId) return;
  let changed = false;
  for (let i = 0; i < state.events.length; i += 1) {
    if (!state.events[i].tripId) {
      state.events[i] = { ...state.events[i], tripId };
      changed = true;
    }
  }
  if (changed) {
    // The watch on state.events will persist, but ensure the new tripId is
    // surfaced to sanitize() right away.
    legacyMigrationTripId = tripId;
  }
};

const state = reactive({
  events: load(),
});

watch(
  () => state.events,
  (value) => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // ignore quota / disabled storage
    }
  },
  { deep: true },
);

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const sanitize = (input) => {
  const type = EVENT_TYPES.some((t) => t.value === input.type) ? input.type : 'other';

  let start = parseDateTime(input.startDateTime);
  let end = parseDateTime(input.endDateTime);

  // Backward compatibility: legacy fields startTime/endTime/date.
  if (!start && typeof input.startTime === 'string' && typeof input.date === 'string') {
    start = parseDateTime(`${input.date}T${input.startTime}`);
  }
  if (!end && typeof input.endTime === 'string') {
    const endDate =
      typeof input.date === 'string'
        ? input.date
        : start
          ? toISODateTime(start).slice(0, 10)
          : null;
    if (endDate) end = parseDateTime(`${endDate}T${input.endTime}`);
  }

  const now = new Date();
  if (!start) start = new Date(now.getTime());
  if (!end) end = new Date(start.getTime() + 60 * 60 * 1000);
  if (end <= start) end = new Date(start.getTime() + 60 * 60 * 1000);

  start.setSeconds(0, 0);
  end.setSeconds(0, 0);

  return {
    id: typeof input.id === 'string' && input.id ? input.id : generateId(),
    tripId:
      typeof input.tripId === 'string' && input.tripId
        ? input.tripId
        : legacyMigrationTripId ?? null,
    type,
    description: typeof input.description === 'string' ? input.description.trim() : '',
    place: typeof input.place === 'string' ? input.place.trim() : '',
    placeCoords: isCoord(input.placeCoords) ? { lng: input.placeCoords.lng, lat: input.placeCoords.lat } : null,
    placeFrom: type === 'commute' && typeof input.placeFrom === 'string' ? input.placeFrom.trim() : '',
    placeFromCoords: type === 'commute' && isCoord(input.placeFromCoords) ? { lng: input.placeFromCoords.lng, lat: input.placeFromCoords.lat } : null,
    placeTo: type === 'commute' && typeof input.placeTo === 'string' ? input.placeTo.trim() : '',
    placeToCoords: type === 'commute' && isCoord(input.placeToCoords) ? { lng: input.placeToCoords.lng, lat: input.placeToCoords.lat } : null,
    startDateTime: toISODateTime(start),
    endDateTime: toISODateTime(end),
    price: sanitizePrice(input.price),
    currency:
      typeof input.currency === 'string' && input.currency.trim()
        ? input.currency.trim().toUpperCase().slice(0, 4)
        : 'USD',
    isPaid: input.isPaid === true,
    links: sanitizeLinks(input.links),
  };
};

export const getAllEvents = () => state.events;

// Returns events for a given trip that overlap the given day (where overlap
// means the event's [startDateTime, endDateTime) intersects [dayStart, dayEnd)).
export const getEventsOverlappingDate = (tripId, dateStr) => {
  const dayStart = startOfDay(parseDateTime(`${dateStr}T00:00`) ?? new Date());
  const dayEnd = addDays(dayStart, 1);
  const result = [];
  for (const raw of state.events) {
    if (tripId && raw.tripId && raw.tripId !== tripId) continue;
    const event = sanitize(raw);
    if (tripId && event.tripId !== tripId) continue;
    const s = parseDateTime(event.startDateTime);
    const e = parseDateTime(event.endDateTime);
    if (!s || !e) continue;
    if (s < dayEnd && e > dayStart) {
      result.push(event);
    }
  }
  result.sort((a, b) => {
    if (a.startDateTime !== b.startDateTime) {
      return a.startDateTime < b.startDateTime ? -1 : 1;
    }
    return a.id < b.id ? -1 : 1;
  });
  return result;
};

export const getEventsForTrip = (tripId) => {
  return state.events.filter((e) => (e.tripId ?? null) === tripId);
};

export const addEvent = (input) => {
  const event = sanitize(input);
  state.events.push(event);
  state.events.sort((a, b) => (a.startDateTime < b.startDateTime ? -1 : 1));
  return event;
};

export const removeEvent = (_unusedDateStr, eventId) => {
  state.events = state.events.filter((e) => e.id !== eventId);
};

export const updateEvent = (_unusedDateStr, eventId, patch) => {
  const idx = state.events.findIndex((e) => e.id === eventId);
  if (idx === -1) return null;
  const current = state.events[idx];
  const merged = sanitize({ ...current, ...patch, id: current.id });
  state.events[idx] = merged;
  state.events.sort((a, b) => (a.startDateTime < b.startDateTime ? -1 : 1));
  return merged;
};

export { parseDateTime, toISODateTime, startOfDay, addDays };
