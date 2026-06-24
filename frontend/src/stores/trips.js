import { computed, reactive, watch } from 'vue';

const TRIPS_KEY = 'tracker.trips';
const ACTIVE_KEY = 'tracker.activeTripId';

const pad2 = (n) => String(n).padStart(2, '0');

const isISODate = (value) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const loadTrips = () => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TRIPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t) =>
        t &&
        typeof t === 'object' &&
        typeof t.id === 'string' &&
        typeof t.name === 'string' &&
        isISODate(t.startDate) &&
        isISODate(t.endDate) &&
        t.startDate <= t.endDate,
    );
  } catch {
    return [];
  }
};

const loadActiveId = () => {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return typeof raw === 'string' ? raw : null;
  } catch {
    return null;
  }
};

const state = reactive({
  trips: loadTrips(),
  activeId: loadActiveId(),
});

watch(
  () => state.trips,
  (value) => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(TRIPS_KEY, JSON.stringify(value));
    } catch {
      // ignore
    }
  },
  { deep: true },
);

watch(
  () => state.activeId,
  (value) => {
    if (typeof localStorage === 'undefined') return;
    try {
      if (value) localStorage.setItem(ACTIVE_KEY, value);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      // ignore
    }
  },
);

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isCoord = (value) =>
  value &&
  typeof value === 'object' &&
  Number.isFinite(value.lng) &&
  Number.isFinite(value.lat) &&
  Number.isFinite(value.zoom);

const sanitizeMapView = (value) => {
  if (!isCoord(value)) return null;
  return {
    lng: value.lng,
    lat: value.lat,
    zoom: value.zoom,
    bearing: Number.isFinite(value.bearing) ? value.bearing : 0,
  };
};

const sanitize = (input) => {
  const start = isISODate(input?.startDate) ? input.startDate : todayISO();
  const end = isISODate(input?.endDate) ? input.endDate : start;
  const name = typeof input?.name === 'string' && input.name.trim()
    ? input.name.trim()
    : 'Untitled trip';
  return {
    id: typeof input?.id === 'string' && input.id ? input.id : generateId(),
    name: name.slice(0, 80),
    startDate: end < start ? start : start,
    endDate: end < start ? start : end,
    mapView: sanitizeMapView(input?.mapView),
  };
};

export const trips = computed(() => state.trips);
export const activeTripId = computed(() => state.activeId);
export const activeTrip = computed(
  () => state.trips.find((t) => t.id === state.activeId) ?? null,
);

export const addTrip = (input) => {
  const trip = sanitize(input);
  state.trips.push(trip);
  state.trips.sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  return trip;
};

export const updateTrip = (id, patch) => {
  const idx = state.trips.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const current = state.trips[idx];
  const merged = sanitize({ ...current, ...patch, id: current.id });
  state.trips[idx] = merged;
  state.trips.sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  return merged;
};

export const removeTrip = (id) => {
  state.trips = state.trips.filter((t) => t.id !== id);
  if (state.activeId === id) {
    state.activeId = state.trips[0]?.id ?? null;
  }
};

export const setActiveTripId = (id) => {
  if (id && !state.trips.some((t) => t.id === id)) return;
  state.activeId = id ?? null;
};
