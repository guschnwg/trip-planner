import { computed, reactive, watch } from 'vue';

const TRIPS_KEY = 'tracker.trips';
const ACTIVE_KEY = 'tracker.activeTripId';

const pad2 = (n) => String(n).padStart(2, '0');

const isISODate = (value) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const normalizeISODate = (value) => {
  if (isISODate(value)) return value;
  if (typeof value !== 'string') return null;
  const date = value.slice(0, 10);
  return isISODate(date) ? date : null;
};

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
    return parsed
      .filter((t) => t && typeof t === 'object')
      .map((t) => sanitize({
        ...t,
        startDate: normalizeISODate(t.startDate),
        endDate: normalizeISODate(t.endDate),
      }));
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

const sanitizePrice = (input) => {
  if (input == null || input === '') return null;
  const amount = Number(input);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount;
};

const VALID_ITEM_TYPES = new Set([
  'commute', 'sleep', 'food', 'activity', 'work', 'leisure', 'accommodation', 'other',
]);

const isCoordPair = (value) =>
  value && typeof value === 'object' && Number.isFinite(value.lng) && Number.isFinite(value.lat);

const sanitizePlanItem = (input) => {
  const type = VALID_ITEM_TYPES.has(input?.type) ? input.type : 'other';
  const isCommute = type === 'commute';
  return {
    id: typeof input?.id === 'string' && input.id ? input.id : generateId(),
    type,
    description: typeof input?.description === 'string' ? input.description.trim() : '',
    startDateTime: typeof input?.startDateTime === 'string' ? input.startDateTime : '',
    endDateTime: typeof input?.endDateTime === 'string' ? input.endDateTime : '',
    place: !isCommute && typeof input?.place === 'string' ? input.place.trim() : '',
    placeCoords: !isCommute && isCoordPair(input?.placeCoords)
      ? { lng: input.placeCoords.lng, lat: input.placeCoords.lat }
      : null,
    placeFrom: isCommute && typeof input?.placeFrom === 'string' ? input.placeFrom.trim() : '',
    placeFromCoords: isCommute && isCoordPair(input?.placeFromCoords)
      ? { lng: input.placeFromCoords.lng, lat: input.placeFromCoords.lat }
      : null,
    placeTo: isCommute && typeof input?.placeTo === 'string' ? input.placeTo.trim() : '',
    placeToCoords: isCommute && isCoordPair(input?.placeToCoords)
      ? { lng: input.placeToCoords.lng, lat: input.placeToCoords.lat }
      : null,
    price: sanitizePrice(input?.price),
    currency:
      typeof input?.currency === 'string' && input.currency.trim()
        ? input.currency.trim().toUpperCase().slice(0, 4)
        : 'USD',
    isPaid: input?.isPaid === true,
    links: sanitizeLinks(input?.links),
  };
};

const sanitizePlan = (input) => ({
  id: typeof input?.id === 'string' && input.id ? input.id : generateId(),
  name: typeof input?.name === 'string' && input.name.trim()
    ? input.name.trim().slice(0, 80)
    : 'Plan',
  items: Array.isArray(input?.items) ? input.items.map(sanitizePlanItem) : [],
});

const sanitizeComparison = (input) => ({
  id: typeof input?.id === 'string' && input.id ? input.id : generateId(),
  name: typeof input?.name === 'string' && input.name.trim()
    ? input.name.trim().slice(0, 80)
    : 'Comparison',
  plans: Array.isArray(input?.plans) && input.plans.length
    ? input.plans.map(sanitizePlan)
    : [sanitizePlan({ name: 'Plan A' }), sanitizePlan({ name: 'Plan B' })],
});

const sanitizeComparisons = (input) => {
  if (!Array.isArray(input)) return [];
  return input.map(sanitizeComparison);
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
    comparisons: sanitizeComparisons(input?.comparisons),
  };
};

const loadedTrips = loadTrips();
const loadedActiveId = loadActiveId();

const state = reactive({
  trips: loadedTrips,
  activeId: loadedTrips.some((trip) => trip.id === loadedActiveId)
    ? loadedActiveId
    : loadedTrips[0]?.id ?? null,
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

const mutateTrip = (id, mutator) => {
  const idx = state.trips.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const current = state.trips[idx];
  const next = { ...current, comparisons: current.comparisons.map((c) => ({ ...c, plans: c.plans.map((p) => ({ ...p, items: [...p.items] })) })) };
  const capture = { value: null };
  const result = mutator(next, capture);
  const merged = sanitize({ ...next, id: next.id });
  state.trips[idx] = merged;
  return result ?? capture.value ?? merged;
};

const letterForIndex = (i) => {
  let n = i;
  let out = '';
  while (n >= 0) {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  }
  return out;
};

export const addComparison = (tripId, input = {}) => {
  return mutateTrip(tripId, (trip, capture) => {
    const index = trip.comparisons.length + 1;
    const planIndexBase = trip.comparisons.reduce((acc, c) => acc + c.plans.length, 0);
    const comparison = sanitizeComparison({
      name: input.name || `Comparison ${index}`,
      plans: [
        { name: `Plan ${letterForIndex(planIndexBase)}` },
        { name: `Plan ${letterForIndex(planIndexBase + 1)}` },
      ],
    });
    trip.comparisons.push(comparison);
    capture.value = comparison;
  });
};

export const updateComparison = (tripId, comparisonId, patch) => {
  return mutateTrip(tripId, (trip) => {
    const idx = trip.comparisons.findIndex((c) => c.id === comparisonId);
    if (idx === -1) return;
    const current = trip.comparisons[idx];
    const merged = sanitizeComparison({ ...current, ...patch, id: current.id, plans: current.plans });
    trip.comparisons[idx] = merged;
    return merged;
  });
};

export const removeComparison = (tripId, comparisonId) => {
  return mutateTrip(tripId, (trip) => {
    trip.comparisons = trip.comparisons.filter((c) => c.id !== comparisonId);
  });
};

export const addPlan = (tripId, comparisonId, input = {}) => {
  return mutateTrip(tripId, (trip, capture) => {
    const comparison = trip.comparisons.find((c) => c.id === comparisonId);
    if (!comparison) return null;
    const name = input.name || `Plan ${letterForIndex(comparison.plans.length)}`;
    const plan = sanitizePlan({ name });
    comparison.plans.push(plan);
    capture.value = plan;
  });
};

export const updatePlan = (tripId, comparisonId, planId, patch) => {
  return mutateTrip(tripId, (trip) => {
    const comparison = trip.comparisons.find((c) => c.id === comparisonId);
    if (!comparison) return null;
    const idx = comparison.plans.findIndex((p) => p.id === planId);
    if (idx === -1) return null;
    const current = comparison.plans[idx];
    const merged = sanitizePlan({ ...current, ...patch, id: current.id, items: current.items });
    comparison.plans[idx] = merged;
    return merged;
  });
};

export const removePlan = (tripId, comparisonId, planId) => {
  return mutateTrip(tripId, (trip) => {
    const comparison = trip.comparisons.find((c) => c.id === comparisonId);
    if (!comparison) return null;
    comparison.plans = comparison.plans.filter((p) => p.id !== planId);
  });
};

export const addPlanItem = (tripId, comparisonId, planId, input) => {
  return mutateTrip(tripId, (trip, capture) => {
    const comparison = trip.comparisons.find((c) => c.id === comparisonId);
    if (!comparison) return null;
    const plan = comparison.plans.find((p) => p.id === planId);
    if (!plan) return null;
    const item = sanitizePlanItem({ ...input, type: input?.type || 'other' });
    plan.items.push(item);
    capture.value = item;
  });
};

export const updatePlanItem = (tripId, comparisonId, planId, itemId, patch) => {
  return mutateTrip(tripId, (trip, capture) => {
    const comparison = trip.comparisons.find((c) => c.id === comparisonId);
    if (!comparison) return null;
    const plan = comparison.plans.find((p) => p.id === planId);
    if (!plan) return null;
    const idx = plan.items.findIndex((i) => i.id === itemId);
    if (idx === -1) return null;
    const current = plan.items[idx];
    const merged = sanitizePlanItem({ ...current, ...patch, id: current.id });
    plan.items[idx] = merged;
    capture.value = merged;
  });
};

export const removePlanItem = (tripId, comparisonId, planId, itemId) => {
  return mutateTrip(tripId, (trip) => {
    const comparison = trip.comparisons.find((c) => c.id === comparisonId);
    if (!comparison) return;
    const plan = comparison.plans.find((p) => p.id === planId);
    if (!plan) return;
    plan.items = plan.items.filter((i) => i.id !== itemId);
  });
};
