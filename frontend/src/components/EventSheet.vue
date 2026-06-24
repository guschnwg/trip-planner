<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import {
  EVENT_TYPES,
  addEvent,
  getAllEvents,
  parseDateTime,
  removeEvent,
  toISODateTime,
  updateEvent,
} from '../stores/events.js';
import {
  cancelPicking,
  clearPreviewMarkers,
  setPreviewMarkers,
  startPicking,
} from '../stores/mapState.js';
import { getMap } from '../stores/mapState.js';
import { searchPlaces } from '../lib/geocode.js';

const props = defineProps({
  startDateTime: { type: String, default: '' },
  endDateTime: { type: String, default: '' },
  event: { type: Object, default: null },
  tripId: { type: String, default: null },
});

const emit = defineEmits(['close', 'submitted', 'deleted']);

const pad = (n) => String(n).padStart(2, '0');

const isEdit = computed(() => !!props.event);

const buildFormFromEvent = (event) => ({
  type: event.type,
  startDateTime: event.startDateTime,
  endDateTime: event.endDateTime,
  description: event.description ?? '',
  place: event.place ?? '',
  placeCoords: event.placeCoords ?? null,
  placeFrom: event.placeFrom ?? '',
  placeFromCoords: event.placeFromCoords ?? null,
  placeTo: event.placeTo ?? '',
  placeToCoords: event.placeToCoords ?? null,
  price: event.price ?? null,
  currency: event.currency ?? 'USD',
  isPaid: event.isPaid === true,
  links: Array.isArray(event.links) ? event.links.map((l) => ({ ...l })) : [],
});

const defaultForm = () => ({
  type: 'activity',
  startDateTime: props.startDateTime,
  endDateTime: props.endDateTime,
  description: '',
  place: '',
  placeCoords: null,
  placeFrom: '',
  placeFromCoords: null,
  placeTo: '',
  placeToCoords: null,
  price: null,
  currency: 'USD',
  isPaid: false,
  links: [],
});

const form = reactive(isEdit.value ? buildFormFromEvent(props.event) : defaultForm());
const error = ref('');

const placePickInProgress = ref(false);
const placeFromPickInProgress = ref(false);
const placeToPickInProgress = ref(false);

const placeSearch = reactive({
  place: { query: '', results: [], loading: false, open: false, error: '' },
  placeFrom: { query: '', results: [], loading: false, open: false, error: '' },
  placeTo: { query: '', results: [], loading: false, open: false, error: '' },
});

const searchControllers = {
  place: null,
  placeFrom: null,
  placeTo: null,
};

const closeResults = (field) => {
  const s = placeSearch[field];
  s.open = false;
  s.results = [];
  s.error = '';
};

// Build a deduplicated list of places already used in the current trip's
// events, so the user can reuse them instead of re-searching.
const existingPlaces = computed(() => {
  const tripId = props.tripId;
  const all = getAllEvents();
  const seen = new Map();
  const add = (name, coords, kind) => {
    if (!name || !coords || !Number.isFinite(coords.lng) || !Number.isFinite(coords.lat)) {
      return;
    }
    const key = `${name.trim().toLowerCase()}|${coords.lng.toFixed(4)}|${coords.lat.toFixed(4)}`;
    if (!seen.has(key)) {
      seen.set(key, { name: name.trim(), coords: { lng: coords.lng, lat: coords.lat }, kind });
    }
  };
  for (const raw of all) {
    if (tripId && raw.tripId && raw.tripId !== tripId) continue;
    if (raw.type === 'commute') {
      add(raw.placeFrom, raw.placeFromCoords, 'from');
      add(raw.placeTo, raw.placeToCoords, 'to');
    } else {
      add(raw.place, raw.placeCoords, 'place');
    }
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
});

const existingOpen = reactive({ place: false, placeFrom: false, placeTo: false });

const closeExisting = (field) => {
  existingOpen[field] = false;
};

const applyExisting = (field, entry) => {
  if (field === 'place') {
    form.place = entry.name;
    form.placeCoords = { lng: entry.coords.lng, lat: entry.coords.lat };
  } else if (field === 'placeFrom') {
    form.placeFrom = entry.name;
    form.placeFromCoords = { lng: entry.coords.lng, lat: entry.coords.lat };
  } else if (field === 'placeTo') {
    form.placeTo = entry.name;
    form.placeToCoords = { lng: entry.coords.lng, lat: entry.coords.lat };
  }
  closeExisting(field);
  const map = getMap();
  if (map) {
    map.flyTo({
      center: [entry.coords.lng, entry.coords.lat],
      zoom: Math.max(map.getZoom(), 13),
    });
  }
};

const runSearch = async (field) => {
  const s = placeSearch[field];
  const q = s.query.trim();
  if (!q) {
    s.results = [];
    s.open = false;
    s.loading = false;
    return;
  }
  if (searchControllers[field]) {
    searchControllers[field].abort();
  }
  const controller = new AbortController();
  searchControllers[field] = controller;
  s.loading = true;
  s.error = '';
  try {
    const results = await searchPlaces(q, { signal: controller.signal, limit: 6 });
    if (searchControllers[field] !== controller) return;
    s.results = results;
    s.open = true;
  } catch (err) {
    if (err?.name === 'AbortError') return;
    s.error = 'Search failed.';
    s.results = [];
    s.open = true;
  } finally {
    if (searchControllers[field] === controller) {
      s.loading = false;
      searchControllers[field] = null;
    }
  }
};

let debounceTimers = { place: null, placeFrom: null, placeTo: null };
const debouncedSearch = (field) => {
  if (debounceTimers[field]) clearTimeout(debounceTimers[field]);
  debounceTimers[field] = setTimeout(() => runSearch(field), 300);
};

const applyResult = (field, result) => {
  if (field === 'place') {
    form.place = result.name;
    form.placeCoords = { lng: result.lng, lat: result.lat };
  } else if (field === 'placeFrom') {
    form.placeFrom = result.name;
    form.placeFromCoords = { lng: result.lng, lat: result.lat };
  } else if (field === 'placeTo') {
    form.placeTo = result.name;
    form.placeToCoords = { lng: result.lng, lat: result.lat };
  }
  const map = getMap();
  if (map) {
    map.flyTo({ center: [result.lng, result.lat], zoom: Math.max(map.getZoom(), 13) });
  }
  closeResults(field);
};

watch(
  () => [props.startDateTime, props.endDateTime, props.event],
  ([_start, _end, event]) => {
    if (event) {
      Object.assign(form, buildFormFromEvent(event));
    } else {
      Object.assign(form, defaultForm());
    }
    error.value = '';
    for (const field of ['place', 'placeFrom', 'placeTo']) {
      placeSearch[field].query = '';
      placeSearch[field].results = [];
      placeSearch[field].open = false;
      placeSearch[field].loading = false;
      placeSearch[field].error = '';
      if (searchControllers[field]) {
        searchControllers[field].abort();
        searchControllers[field] = null;
      }
    }
  },
);

const syncPreviewMarkers = () => {
  const markers = [];
  if (form.placeCoords) {
    markers.push({
      id: 'preview-place',
      lng: form.placeCoords.lng,
      lat: form.placeCoords.lat,
      label: form.place || 'Place',
      color: '#2b7fff',
      variant: 'preview',
    });
  }
  if (form.placeFromCoords) {
    markers.push({
      id: 'preview-placeFrom',
      lng: form.placeFromCoords.lng,
      lat: form.placeFromCoords.lat,
      label: form.placeFrom || 'From',
      color: '#f79009',
      variant: 'preview',
    });
  }
  if (form.placeToCoords) {
    markers.push({
      id: 'preview-placeTo',
      lng: form.placeToCoords.lng,
      lat: form.placeToCoords.lat,
      label: form.placeTo || 'To',
      color: '#16a34a',
      variant: 'preview',
    });
  }
  setPreviewMarkers(markers);
};

watch(
  () => [form.placeCoords, form.placeFromCoords, form.placeToCoords],
  () => {
    syncPreviewMarkers();
  },
  { deep: true, immediate: true },
);

const isCommute = computed(() => form.type === 'commute');

const beginPick = async (field) => {
  error.value = '';
  if (field === 'place') placePickInProgress.value = true;
  if (field === 'placeFrom') placeFromPickInProgress.value = true;
  if (field === 'placeTo') placeToPickInProgress.value = true;
  try {
    const result = await startPicking(field);
    if (field === 'place') {
      form.place = result.name;
      form.placeCoords = { lng: result.lng, lat: result.lat };
    } else if (field === 'placeFrom') {
      form.placeFrom = result.name;
      form.placeFromCoords = { lng: result.lng, lat: result.lat };
    } else if (field === 'placeTo') {
      form.placeTo = result.name;
      form.placeToCoords = { lng: result.lng, lat: result.lat };
    }
  } catch (err) {
    // ignore cancel
  } finally {
    if (field === 'place') placePickInProgress.value = false;
    if (field === 'placeFrom') placeFromPickInProgress.value = false;
    if (field === 'placeTo') placeToPickInProgress.value = false;
  }
};

const handleSubmit = () => {
  error.value = '';
  const start = parseDateTime(form.startDateTime);
  const end = parseDateTime(form.endDateTime);
  if (!start || !end || end <= start) {
    error.value = 'End must be after start.';
    return;
  }
  if (isCommute.value) {
    if (!form.placeFrom && !form.placeTo) {
      error.value = 'Pick at least a from or to place for the commute.';
      return;
    }
  } else if (form.place && !form.placeCoords) {
    error.value = 'Place is set but has no coordinates. Click the pick button to choose a location on the map.';
    return;
  }

  const payload = {
    type: form.type,
    startDateTime: toISODateTime(start),
    endDateTime: toISODateTime(end),
    description: form.description,
    place: form.place,
    placeCoords: form.placeCoords,
    placeFrom: form.placeFrom,
    placeFromCoords: form.placeFromCoords,
    placeTo: form.placeTo,
    placeToCoords: form.placeToCoords,
    price: form.price,
    currency: form.currency,
    isPaid: form.isPaid,
    links: form.links,
    tripId: props.tripId,
  };

  const stored = isEdit.value
    ? updateEvent(null, props.event.id, payload)
    : addEvent(payload);

  if (stored) emit('submitted', stored);
};

const handleDelete = () => {
  if (!isEdit.value) return;
  removeEvent(null, props.event.id);
  emit('deleted', props.event);
};

const addLink = () => {
  form.links.push({ label: '', url: '' });
};
const removeLink = (index) => {
  form.links.splice(index, 1);
};

onBeforeUnmount(() => {
  cancelPicking();
  clearPreviewMarkers();
  for (const field of ['place', 'placeFrom', 'placeTo']) {
    if (debounceTimers[field]) clearTimeout(debounceTimers[field]);
    if (searchControllers[field]) searchControllers[field].abort();
  }
});
</script>

<template>
  <aside class="sheet" role="dialog" aria-modal="false" aria-labelledby="event-sheet-title">
    <header class="sheet-header">
      <h2 id="event-sheet-title">{{ isEdit ? 'Edit event' : 'New event' }}</h2>
      <button class="close-btn" type="button" @click="$emit('close')" aria-label="Close">
        &times;
      </button>
    </header>

    <form class="sheet-body" @submit.prevent="handleSubmit">
      <p class="hint">Type to search for a place, or use "Pick on map" to click a location.</p>

      <label class="field">
        <span class="field-label">Type</span>
        <select v-model="form.type">
          <option v-for="t in EVENT_TYPES" :key="t.value" :value="t.value">
            {{ t.label }}
          </option>
        </select>
      </label>
      <label class="field">
        <span class="field-label">Start</span>
        <input type="datetime-local" step="900" v-model="form.startDateTime" />
      </label>
      <label class="field">
        <span class="field-label">End</span>
        <input type="datetime-local" step="900" v-model="form.endDateTime" />
      </label>

      <label class="field">
        <span class="field-label">Description</span>
        <input type="text" v-model="form.description" placeholder="What is happening?" />
      </label>
      <template v-if="isCommute">
        <div class="field">
          <span class="field-label">Place from</span>
          <div v-if="form.placeFrom" class="selected-place">
            <span class="selected-place-name">{{ form.placeFrom }}</span>
            <button
              type="button"
              class="clear-place"
              @click="
                form.placeFrom = '';
                form.placeFromCoords = null;
              "
              aria-label="Clear origin"
            >
              &times;
            </button>
          </div>
          <div class="place-search">
            <input
              type="text"
              v-model="placeSearch.placeFrom.query"
              @input="debouncedSearch('placeFrom')"
              @focus="runSearch('placeFrom')"
              @blur="setTimeout(() => closeResults('placeFrom'), 150)"
              placeholder="Search origin…"
            />
            <button
              type="button"
              class="pick-btn"
              :class="{ active: placeFromPickInProgress }"
              :disabled="placeFromPickInProgress"
              @click="beginPick('placeFrom')"
            >
              {{ placeFromPickInProgress ? 'Click on map…' : 'Pick on map' }}
            </button>
            <button
              type="button"
              class="existing-btn"
              :disabled="!existingPlaces.length"
              :class="{ active: existingOpen.placeFrom }"
              @click="existingOpen.placeFrom = !existingOpen.placeFrom"
              :title="existingPlaces.length ? 'Reuse a place already used in this trip' : 'No saved places yet'"
            >
              Existing
            </button>
          </div>
          <ul v-if="placeSearch.placeFrom.open" class="search-results">
            <li v-if="placeSearch.placeFrom.loading" class="search-status">Searching…</li>
            <li v-else-if="placeSearch.placeFrom.error" class="search-status error">
              {{ placeSearch.placeFrom.error }}
            </li>
            <li
              v-for="(r, idx) in placeSearch.placeFrom.results"
              :key="`from-${idx}-${r.lng}-${r.lat}`"
            >
              <button type="button" class="result" @mousedown.prevent="applyResult('placeFrom', r)">
                {{ r.name }}
              </button>
            </li>
            <li
              v-if="
                !placeSearch.placeFrom.loading &&
                !placeSearch.placeFrom.results.length &&
                !placeSearch.placeFrom.error
              "
              class="search-status"
            >
              No results.
            </li>
          </ul>
          <ul v-if="existingOpen.placeFrom && existingPlaces.length" class="search-results existing-list">
            <li
              v-for="(entry, idx) in existingPlaces"
              :key="`existing-from-${idx}-${entry.coords.lng}-${entry.coords.lat}`"
            >
              <button type="button" class="result" @mousedown.prevent="applyExisting('placeFrom', entry)">
                <span class="result-name">{{ entry.name }}</span>
                <span class="result-kind">{{ entry.kind }}</span>
              </button>
            </li>
          </ul>
        </div>
        <div class="field">
          <span class="field-label">Place to</span>
          <div v-if="form.placeTo" class="selected-place">
            <span class="selected-place-name">{{ form.placeTo }}</span>
            <button
              type="button"
              class="clear-place"
              @click="
                form.placeTo = '';
                form.placeToCoords = null;
              "
              aria-label="Clear destination"
            >
              &times;
            </button>
          </div>
          <div class="place-search">
            <input
              type="text"
              v-model="placeSearch.placeTo.query"
              @input="debouncedSearch('placeTo')"
              @focus="runSearch('placeTo')"
              @blur="setTimeout(() => closeResults('placeTo'), 150)"
              placeholder="Search destination…"
            />
            <button
              type="button"
              class="pick-btn"
              :class="{ active: placeToPickInProgress }"
              :disabled="placeToPickInProgress"
              @click="beginPick('placeTo')"
            >
              {{ placeToPickInProgress ? 'Click on map…' : 'Pick on map' }}
            </button>
            <button
              type="button"
              class="existing-btn"
              :disabled="!existingPlaces.length"
              :class="{ active: existingOpen.placeTo }"
              @click="existingOpen.placeTo = !existingOpen.placeTo"
              :title="existingPlaces.length ? 'Reuse a place already used in this trip' : 'No saved places yet'"
            >
              Existing
            </button>
          </div>
          <ul v-if="placeSearch.placeTo.open" class="search-results">
            <li v-if="placeSearch.placeTo.loading" class="search-status">Searching…</li>
            <li v-else-if="placeSearch.placeTo.error" class="search-status error">
              {{ placeSearch.placeTo.error }}
            </li>
            <li
              v-for="(r, idx) in placeSearch.placeTo.results"
              :key="`to-${idx}-${r.lng}-${r.lat}`"
            >
              <button type="button" class="result" @mousedown.prevent="applyResult('placeTo', r)">
                {{ r.name }}
              </button>
            </li>
            <li
              v-if="
                !placeSearch.placeTo.loading &&
                !placeSearch.placeTo.results.length &&
                !placeSearch.placeTo.error
              "
              class="search-status"
            >
              No results.
            </li>
          </ul>
          <ul v-if="existingOpen.placeTo && existingPlaces.length" class="search-results existing-list">
            <li
              v-for="(entry, idx) in existingPlaces"
              :key="`existing-to-${idx}-${entry.coords.lng}-${entry.coords.lat}`"
            >
              <button type="button" class="result" @mousedown.prevent="applyExisting('placeTo', entry)">
                <span class="result-name">{{ entry.name }}</span>
                <span class="result-kind">{{ entry.kind }}</span>
              </button>
            </li>
          </ul>
        </div>
      </template>
      <div v-else class="field">
        <span class="field-label">Place</span>
        <div v-if="form.place" class="selected-place">
          <span class="selected-place-name">{{ form.place }}</span>
          <button
            type="button"
            class="clear-place"
            @click="
              form.place = '';
              form.placeCoords = null;
            "
            aria-label="Clear place"
          >
            &times;
          </button>
        </div>
        <div class="place-search">
          <input
            type="text"
            v-model="placeSearch.place.query"
            @input="debouncedSearch('place')"
            @focus="runSearch('place')"
            @blur="setTimeout(() => closeResults('place'), 150)"
            placeholder="Search a place…"
          />
          <button
            type="button"
            class="pick-btn"
            :class="{ active: placePickInProgress }"
            :disabled="placePickInProgress"
            @click="beginPick('place')"
          >
            {{ placePickInProgress ? 'Click on map…' : 'Pick on map' }}
          </button>
          <button
            type="button"
            class="existing-btn"
            :disabled="!existingPlaces.length"
            :class="{ active: existingOpen.place }"
            @click="existingOpen.place = !existingOpen.place"
            :title="existingPlaces.length ? 'Reuse a place already used in this trip' : 'No saved places yet'"
          >
            Existing
          </button>
        </div>
        <ul v-if="placeSearch.place.open" class="search-results">
          <li v-if="placeSearch.place.loading" class="search-status">Searching…</li>
          <li v-else-if="placeSearch.place.error" class="search-status error">
            {{ placeSearch.place.error }}
          </li>
          <li
            v-for="(r, idx) in placeSearch.place.results"
            :key="`place-${idx}-${r.lng}-${r.lat}`"
          >
            <button type="button" class="result" @mousedown.prevent="applyResult('place', r)">
              {{ r.name }}
            </button>
          </li>
          <li
            v-if="
              !placeSearch.place.loading &&
              !placeSearch.place.results.length &&
              !placeSearch.place.error
            "
            class="search-status"
          >
            No results.
          </li>
        </ul>
        <ul v-if="existingOpen.place && existingPlaces.length" class="search-results existing-list">
          <li
            v-for="(entry, idx) in existingPlaces"
            :key="`existing-place-${idx}-${entry.coords.lng}-${entry.coords.lat}`"
          >
            <button type="button" class="result" @mousedown.prevent="applyExisting('place', entry)">
              <span class="result-name">{{ entry.name }}</span>
              <span class="result-kind">{{ entry.kind }}</span>
            </button>
          </li>
        </ul>
      </div>

      <div class="field">
        <span class="field-label">Price</span>
        <div class="price-row">
          <input
            type="number"
            inputmode="decimal"
            min="0"
            step="0.01"
            placeholder="0"
            v-model.number="form.price"
          />
          <input
            type="text"
            class="currency-input"
            placeholder="USD"
            maxlength="4"
            v-model="form.currency"
          />
          <label class="paid-toggle">
            <input type="checkbox" v-model="form.isPaid" />
            <span>{{ form.isPaid ? 'Paid' : 'Planned' }}</span>
          </label>
        </div>
      </div>

      <div class="field">
        <div class="links-header">
          <span class="field-label">Links</span>
          <button type="button" class="link-add" @click="addLink">
            + Add link
          </button>
        </div>
        <div v-if="!form.links.length" class="links-empty">No links.</div>
        <div
          v-for="(link, idx) in form.links"
          :key="`link-${idx}`"
          class="link-row"
        >
          <input
            type="text"
            v-model="form.links[idx].label"
            placeholder="Label"
            class="link-label"
            maxlength="80"
          />
          <input
            type="url"
            v-model="form.links[idx].url"
            placeholder="https://…"
            class="link-url"
            maxlength="500"
          />
          <button
            type="button"
            class="link-remove"
            @click="removeLink(idx)"
            aria-label="Remove link"
          >
            &times;
          </button>
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <footer class="sheet-footer">
        <button
          v-if="isEdit"
          type="button"
          class="btn btn-danger"
          @click="handleDelete"
        >
          Delete
        </button>
        <div class="footer-spacer"></div>
        <button type="button" class="btn btn-secondary" @click="$emit('close')">Cancel</button>
        <button type="submit" class="btn btn-primary">
          {{ isEdit ? 'Save' : 'Add event' }}
        </button>
      </footer>
    </form>
  </aside>
</template>

<style scoped>
.sheet {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 360px;
  background: #ffffff;
  border-left: 1px solid #e2e2e2;
  box-shadow: -4px 0 16px rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  z-index: 500;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #ececec;
  flex-shrink: 0;
}

.sheet-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: transparent;
  border: 0;
  font-size: 22px;
  line-height: 1;
  color: #555;
  cursor: pointer;
  padding: 0 4px;
}

.close-btn:hover {
  color: #1a1a1a;
}

.sheet-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
  overflow-y: auto;
  flex: 1;
}

.hint {
  margin: 0;
  font-size: 12px;
  color: #555;
  background: #f0f6ff;
  border: 1px solid #c7d7fe;
  padding: 8px 10px;
  border-radius: 6px;
}

.row {
  display: flex;
  gap: 10px;
}

.row .field {
  flex: 1;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.field input,
.field select {
  padding: 6px 8px;
  font-size: 13px;
  border: 1px solid #d4d4d4;
  border-radius: 6px;
  background: #ffffff;
  color: #1a1a1a;
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: #2b7fff;
  box-shadow: 0 0 0 2px rgba(43, 127, 255, 0.15);
}

.selected-place {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: #f0f6ff;
  border: 1px solid #c7d7fe;
  border-radius: 6px;
  font-size: 12px;
  color: #1a1a1a;
}

.selected-place-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clear-place {
  background: transparent;
  border: 0;
  color: #666;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
}

.clear-place:hover {
  color: #1a1a1a;
}

.place-search {
  display: flex;
  gap: 6px;
  align-items: stretch;
  position: relative;
}

.place-search input {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  font-size: 13px;
  border: 1px solid #d4d4d4;
  border-radius: 6px;
  background: #ffffff;
  color: #1a1a1a;
}

.place-search input:focus {
  outline: none;
  border-color: #2b7fff;
  box-shadow: 0 0 0 2px rgba(43, 127, 255, 0.15);
}

.pick-btn {
  padding: 6px 10px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid #2b7fff;
  background: #ffffff;
  color: #2b7fff;
  cursor: pointer;
  white-space: nowrap;
}

.pick-btn:hover:not(:disabled) {
  background: #f0f6ff;
}

.pick-btn.active {
  background: #2b7fff;
  color: #ffffff;
}

.pick-btn:disabled {
  cursor: default;
}

.existing-btn {
  padding: 6px 10px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid #6b7280;
  background: #ffffff;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
}

.existing-btn:hover:not(:disabled) {
  background: #f3f4f6;
}

.existing-btn.active {
  background: #6b7280;
  color: #ffffff;
}

.existing-btn:disabled {
  cursor: default;
  opacity: 0.5;
}

.search-results {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  border: 1px solid #e2e2e2;
  border-radius: 6px;
  background: #ffffff;
  max-height: 220px;
  overflow-y: auto;
}

.search-results li {
  border-bottom: 1px solid #f0f0f0;
}

.search-results li:last-child {
  border-bottom: 0;
}

.search-results .result {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: 0;
  padding: 8px 10px;
  font-size: 12px;
  color: #1a1a1a;
  cursor: pointer;
  line-height: 1.3;
}

.search-results .result:hover {
  background: #f5f8ff;
}

.search-results .result {
  display: flex;
  align-items: center;
  gap: 6px;
}

.result-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-kind {
  flex-shrink: 0;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #888;
  background: #f3f4f6;
  border-radius: 999px;
  padding: 1px 6px;
}

.existing-list .result {
  justify-content: space-between;
}

.search-status {
  padding: 8px 10px;
  font-size: 12px;
  color: #666;
  font-style: italic;
}

.search-status.error {
  color: #b42318;
  font-style: normal;
}

.price-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.price-row input[type='number'] {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  font-size: 13px;
  border: 1px solid #d4d4d4;
  border-radius: 6px;
  background: #ffffff;
  color: #1a1a1a;
}

.price-row input[type='number']:focus {
  outline: none;
  border-color: #2b7fff;
  box-shadow: 0 0 0 2px rgba(43, 127, 255, 0.15);
}

.currency-input {
  width: 70px;
  flex-shrink: 0;
  padding: 6px 8px;
  font-size: 13px;
  border: 1px solid #d4d4d4;
  border-radius: 6px;
  background: #ffffff;
  color: #1a1a1a;
  text-transform: uppercase;
}

.currency-input:focus {
  outline: none;
  border-color: #2b7fff;
  box-shadow: 0 0 0 2px rgba(43, 127, 255, 0.15);
}

.paid-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #555;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  padding: 6px 8px;
  border: 1px solid #d4d4d4;
  border-radius: 6px;
  background: #ffffff;
}

.paid-toggle input {
  margin: 0;
}

.links-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.link-add {
  background: #ffffff;
  border: 1px solid #d4d4d4;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  color: #333;
  cursor: pointer;
}

.link-add:hover {
  background: #f0f0f0;
}

.links-empty {
  font-size: 12px;
  color: #888;
  font-style: italic;
}

.link-row {
  display: flex;
  gap: 4px;
  align-items: center;
  margin-top: 4px;
}

.link-label {
  flex: 0 0 90px;
  min-width: 0;
  padding: 5px 6px;
  font-size: 12px;
  border: 1px solid #d4d4d4;
  border-radius: 6px;
  background: #ffffff;
  color: #1a1a1a;
}

.link-url {
  flex: 1;
  min-width: 0;
  padding: 5px 6px;
  font-size: 12px;
  border: 1px solid #d4d4d4;
  border-radius: 6px;
  background: #ffffff;
  color: #1a1a1a;
}

.link-label:focus,
.link-url:focus {
  outline: none;
  border-color: #2b7fff;
  box-shadow: 0 0 0 2px rgba(43, 127, 255, 0.15);
}

.link-remove {
  background: transparent;
  border: 0;
  color: #888;
  font-size: 16px;
  line-height: 1;
  padding: 0 4px;
  cursor: pointer;
}

.link-remove:hover {
  color: #b42318;
}

.error {
  margin: 0;
  font-size: 12px;
  color: #b42318;
  background: #fef3f2;
  border: 1px solid #fecdca;
  padding: 6px 8px;
  border-radius: 6px;
}

.sheet-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid #ececec;
  background: #fafafa;
  flex-shrink: 0;
}

.footer-spacer {
  flex: 1;
}

.btn {
  padding: 7px 14px;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn-primary {
  background: #2b7fff;
  color: #ffffff;
}

.btn-primary:hover {
  background: #1f6fe5;
}

.btn-secondary {
  background: #ffffff;
  color: #333;
  border-color: #d4d4d4;
}

.btn-secondary:hover {
  background: #f0f0f0;
}

.btn-danger {
  background: #ffffff;
  color: #b42318;
  border-color: #fecdca;
}

.btn-danger:hover {
  background: #fef3f2;
}
</style>
