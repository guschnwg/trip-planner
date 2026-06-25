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
import { useI18n } from '../lib/useI18n.js';
import { CURRENCIES, formatAmount } from '../lib/costSummary.js';

const { t, locale } = useI18n();

const props = defineProps({
  startDateTime: { type: String, default: '' },
  endDateTime: { type: String, default: '' },
  event: { type: Object, default: null },
  tripId: { type: String, default: null },
});

const emit = defineEmits(['close', 'submitted', 'deleted']);

const pad = (n) => String(n).padStart(2, '0');

const isEdit = computed(() => !!props.event);

const localizedEventTypes = computed(() =>
  EVENT_TYPES.map((type) => ({ ...type, label: t(`eventTypes.${type.value}`) })),
);

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
    s.error = t('eventSheet.errors.searchFailed');
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

const pricePreview = computed(() => {
  if (form.price == null || form.price === '' || Number.isNaN(Number(form.price))) return '';
  const value = Number(form.price);
  if (!Number.isFinite(value) || value < 0) return '';
  return formatAmount(value, form.currency || 'USD', locale.value);
});

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
    error.value = t('eventSheet.errors.endBeforeStart');
    return;
  }
  if (isCommute.value) {
    if (!form.placeFrom && !form.placeTo) {
      error.value = t('eventSheet.errors.commuteNeedsPlace');
      return;
    }
  } else if (form.place && !form.placeCoords) {
    error.value = t('eventSheet.errors.placeNeedsCoords');
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
    <div class="sheet-glow" aria-hidden="true"></div>
    <header class="sheet-header">
      <h2 id="event-sheet-title">{{ isEdit ? t('eventSheet.editTitle') : t('eventSheet.newTitle') }}</h2>
      <button class="close-btn" type="button" @click="$emit('close')" :aria-label="t('eventSheet.actions.close')">
        &times;
      </button>
    </header>

    <form class="sheet-body" @submit.prevent="handleSubmit">
      <p class="hint">{{ t('eventSheet.hint') }}</p>

      <label class="field">
        <span class="field-label">{{ t('eventSheet.fields.type') }}</span>
        <select class="tp-input" v-model="form.type">
          <option v-for="t in localizedEventTypes" :key="t.value" :value="t.value">
            {{ t.label }}
          </option>
        </select>
      </label>
      <label class="field">
        <span class="field-label">{{ t('eventSheet.fields.start') }}</span>
        <input class="tp-input" type="datetime-local" step="900" v-model="form.startDateTime" />
      </label>
      <label class="field">
        <span class="field-label">{{ t('eventSheet.fields.end') }}</span>
        <input class="tp-input" type="datetime-local" step="900" v-model="form.endDateTime" />
      </label>

      <label class="field">
        <span class="field-label">{{ t('eventSheet.fields.description') }}</span>
        <input class="tp-input" type="text" v-model="form.description" :placeholder="t('eventSheet.fields.description')" />
      </label>
      <template v-if="isCommute">
        <div class="field">
          <span class="field-label">{{ t('eventSheet.fields.placeFrom') }}</span>
          <div v-if="form.placeFrom" class="selected-place">
            <span class="selected-place-name">{{ form.placeFrom }}</span>
            <button
              type="button"
              class="clear-place"
              @click="
                form.placeFrom = '';
                form.placeFromCoords = null;
              "
              :aria-label="t('eventSheet.actions.clearOrigin')"
            >
              &times;
            </button>
          </div>
          <div class="place-search">
            <input
              class="tp-input"
              type="text"
              v-model="placeSearch.placeFrom.query"
              @input="debouncedSearch('placeFrom')"
              @focus="runSearch('placeFrom')"
              @blur="setTimeout(() => closeResults('placeFrom'), 150)"
              :placeholder="t('eventSheet.actions.searchOrigin')"
            />
            <button
              type="button"
              class="pick-btn"
              :class="{ active: placeFromPickInProgress }"
              :disabled="placeFromPickInProgress"
              @click="beginPick('placeFrom')"
            >
              {{ placeFromPickInProgress ? t('eventSheet.actions.clickOnMap') : t('eventSheet.actions.pickOnMap') }}
            </button>
            <button
              type="button"
              class="existing-btn"
              :disabled="!existingPlaces.length"
              :class="{ active: existingOpen.placeFrom }"
              @click="existingOpen.placeFrom = !existingOpen.placeFrom"
              :title="existingPlaces.length ? t('eventSheet.existing.reuseTitle') : t('eventSheet.existing.noSaved')"
            >
              {{ t('eventSheet.actions.existing') }}
            </button>
          </div>
          <ul v-if="placeSearch.placeFrom.open" class="search-results">
            <li v-if="placeSearch.placeFrom.loading" class="search-status">{{ t('eventSheet.errors.searching') }}</li>
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
              {{ t('eventSheet.errors.noResults') }}
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
          <span class="field-label">{{ t('eventSheet.fields.placeTo') }}</span>
          <div v-if="form.placeTo" class="selected-place">
            <span class="selected-place-name">{{ form.placeTo }}</span>
            <button
              type="button"
              class="clear-place"
              @click="
                form.placeTo = '';
                form.placeToCoords = null;
              "
              :aria-label="t('eventSheet.actions.clearDestination')"
            >
              &times;
            </button>
          </div>
          <div class="place-search">
            <input
              class="tp-input"
              type="text"
              v-model="placeSearch.placeTo.query"
              @input="debouncedSearch('placeTo')"
              @focus="runSearch('placeTo')"
              @blur="setTimeout(() => closeResults('placeTo'), 150)"
              :placeholder="t('eventSheet.actions.searchDestination')"
            />
            <button
              type="button"
              class="pick-btn"
              :class="{ active: placeToPickInProgress }"
              :disabled="placeToPickInProgress"
              @click="beginPick('placeTo')"
            >
              {{ placeToPickInProgress ? t('eventSheet.actions.clickOnMap') : t('eventSheet.actions.pickOnMap') }}
            </button>
            <button
              type="button"
              class="existing-btn"
              :disabled="!existingPlaces.length"
              :class="{ active: existingOpen.placeTo }"
              @click="existingOpen.placeTo = !existingOpen.placeTo"
              :title="existingPlaces.length ? t('eventSheet.existing.reuseTitle') : t('eventSheet.existing.noSaved')"
            >
              {{ t('eventSheet.actions.existing') }}
            </button>
          </div>
          <ul v-if="placeSearch.placeTo.open" class="search-results">
            <li v-if="placeSearch.placeTo.loading" class="search-status">{{ t('eventSheet.errors.searching') }}</li>
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
              {{ t('eventSheet.errors.noResults') }}
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
        <span class="field-label">{{ t('eventSheet.fields.place') }}</span>
        <div v-if="form.place" class="selected-place">
          <span class="selected-place-name">{{ form.place }}</span>
          <button
            type="button"
            class="clear-place"
            @click="
              form.place = '';
              form.placeCoords = null;
            "
            :aria-label="t('eventSheet.actions.clearPlace')"
          >
            &times;
          </button>
        </div>
        <div class="place-search">
          <input
            class="tp-input"
            type="text"
            v-model="placeSearch.place.query"
            @input="debouncedSearch('place')"
            @focus="runSearch('place')"
            @blur="setTimeout(() => closeResults('place'), 150)"
            :placeholder="t('eventSheet.actions.searchPlace')"
          />
          <button
            type="button"
            class="pick-btn"
            :class="{ active: placePickInProgress }"
            :disabled="placePickInProgress"
            @click="beginPick('place')"
          >
            {{ placePickInProgress ? t('eventSheet.actions.clickOnMap') : t('eventSheet.actions.pickOnMap') }}
          </button>
          <button
            type="button"
            class="existing-btn"
            :disabled="!existingPlaces.length"
            :class="{ active: existingOpen.place }"
            @click="existingOpen.place = !existingOpen.place"
            :title="existingPlaces.length ? t('eventSheet.existing.reuseTitle') : t('eventSheet.existing.noSaved')"
          >
            {{ t('eventSheet.actions.existing') }}
          </button>
        </div>
        <ul v-if="placeSearch.place.open" class="search-results">
          <li v-if="placeSearch.place.loading" class="search-status">{{ t('eventSheet.errors.searching') }}</li>
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
            {{ t('eventSheet.errors.noResults') }}
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
        <span class="field-label">{{ t('eventSheet.fields.price') }}</span>
        <div class="price-row">
          <input
            class="tp-input"
            type="number"
            inputmode="decimal"
            min="0"
            step="0.01"
            placeholder="0"
            v-model.number="form.price"
          />
          <select class="tp-input currency-select" v-model="form.currency">
            <option v-for="c in CURRENCIES" :key="c.code" :value="c.code">
              {{ c.code }} · {{ c.symbol }}
            </option>
          </select>
          <label class="paid-toggle">
            <input type="checkbox" v-model="form.isPaid" />
            <span>{{ form.isPaid ? t('eventSheet.paid.paid') : t('eventSheet.paid.planned') }}</span>
          </label>
        </div>
        <div v-if="pricePreview" class="price-preview" aria-live="polite">
          {{ pricePreview }}
        </div>
      </div>

      <div class="field">
        <div class="links-header">
          <span class="field-label">{{ t('eventSheet.fields.links') }}</span>
          <button type="button" class="link-add" @click="addLink">
            {{ t('eventSheet.actions.addLink') }}
          </button>
        </div>
        <div v-if="!form.links.length" class="links-empty">{{ t('eventSheet.actions.noLinks') }}</div>
        <TransitionGroup name="link-row" tag="div" class="links-list">
          <div
            v-for="(link, idx) in form.links"
            :key="`link-${idx}-${link.url}`"
            class="link-row"
          >
            <input
              class="tp-input link-label"
              type="text"
              v-model="form.links[idx].label"
              :placeholder="t('eventSheet.actions.linkLabel')"
              maxlength="80"
            />
            <input
              class="tp-input link-url"
              type="url"
              v-model="form.links[idx].url"
              :placeholder="t('eventSheet.actions.linkUrl')"
              maxlength="500"
            />
            <button
              type="button"
              class="link-remove"
              @click="removeLink(idx)"
              :aria-label="t('eventSheet.actions.removeLink')"
            >
              &times;
            </button>
          </div>
        </TransitionGroup>
      </div>

      <Transition name="error-fade">
        <p v-if="error" class="error">{{ error }}</p>
      </Transition>

      <footer class="sheet-footer">
        <button
          v-if="isEdit"
          type="button"
          class="tp-btn tp-btn-danger"
          @click="handleDelete"
        >
          {{ t('eventSheet.actions.delete') }}
        </button>
        <div class="footer-spacer"></div>
        <button type="button" class="tp-btn tp-btn-secondary" @click="$emit('close')">
          {{ t('eventSheet.actions.cancel') }}
        </button>
        <button type="submit" class="tp-btn tp-btn-primary">
          {{ isEdit ? t('eventSheet.actions.save') : t('eventSheet.actions.addEvent') }}
        </button>
      </footer>
    </form>
  </aside>
</template>

<style scoped>
.sheet {
  position: relative;
  height: 100%;
  flex: 0 0 380px;
  min-width: 0;
  background: var(--color-surface);
  -webkit-backdrop-filter: var(--glass-blur-strong);
  backdrop-filter: var(--glass-blur-strong);
  border-left: 1px solid var(--color-border);
  box-shadow: -16px 0 40px rgba(15, 23, 42, 0.12);
  display: flex;
  flex-direction: column;
  z-index: 500;
  overflow: hidden;
  transition: flex-basis var(--dur-slow) var(--ease-out);
}

.sheet-glow {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -1px;
  width: 2px;
  background: linear-gradient(180deg,
    transparent 0%,
    var(--color-primary) 30%,
    var(--color-accent) 70%,
    transparent 100%);
  pointer-events: none;
  filter: blur(2px);
  opacity: 0.7;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border-soft);
  background: var(--color-surface-strong);
  flex-shrink: 0;
  position: relative;
}

.sheet-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  -webkit-background-clip: text;
          background-clip: text;
  color: transparent;
}

.close-btn {
  background: transparent;
  border: 0;
  font-size: 22px;
  line-height: 1;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-md);
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-spring);
}

.close-btn:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  transform: rotate(90deg);
}

.sheet-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px;
  overflow-y: auto;
  flex: 1;
}

.hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-primary-strong);
  background: var(--color-primary-soft);
  border: 1px solid rgba(99, 102, 241, 0.25);
  padding: 10px 12px;
  border-radius: var(--radius-md);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  font-weight: 700;
}

.selected-place {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  background: var(--color-primary-soft);
  border: 1px solid rgba(99, 102, 241, 0.30);
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
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
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 4px;
  border-radius: 50%;
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-spring);
}

.clear-place:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  transform: rotate(90deg);
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
}

.pick-btn,
.existing-btn {
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  border-radius: var(--radius-md);
  cursor: pointer;
  white-space: nowrap;
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-spring);
}

.pick-btn {
  border: 1px solid var(--color-primary);
  background: var(--color-surface-strong);
  color: var(--color-primary-strong);
}

.pick-btn:hover:not(:disabled) {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--color-primary-glow);
}

.pick-btn.active {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  animation: pulseGlow 1.6s ease-in-out infinite;
}

.existing-btn {
  border: 1px solid var(--color-border);
  background: var(--color-surface-strong);
  color: var(--color-text-muted);
}

.existing-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary-strong);
  background: var(--color-primary-soft);
}

.existing-btn.active {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-primary);
}

.existing-btn:disabled {
  cursor: default;
  opacity: 0.45;
}

.search-results {
  list-style: none;
  margin: 6px 0 0;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-strong);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  max-height: 240px;
  overflow-y: auto;
  box-shadow: var(--shadow-md);
  animation: fadeIn var(--dur-base) var(--ease-out);
}

.search-results li {
  border-radius: var(--radius-sm);
}

.search-results .result {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  text-align: left;
  background: transparent;
  border: 0;
  padding: 8px 10px;
  font-size: 12px;
  font-family: inherit;
  color: var(--color-text);
  cursor: pointer;
  line-height: 1.3;
  border-radius: var(--radius-sm);
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.search-results .result:hover {
  background: var(--color-primary-soft);
  color: var(--color-primary-strong);
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
  color: var(--color-text-muted);
  background: var(--color-surface-soft);
  border-radius: var(--radius-pill);
  padding: 1px 6px;
  font-weight: 700;
}

.existing-list .result {
  justify-content: space-between;
}

.search-status {
  padding: 8px 10px;
  font-size: 12px;
  color: var(--color-text-muted);
  font-style: italic;
}

.search-status.error {
  color: var(--color-danger);
  font-style: normal;
  background: var(--color-danger-soft);
  border-radius: var(--radius-sm);
}

.price-row {
  display: flex;
  gap: 6px;
  align-items: stretch;
}

.price-row .tp-input[type='number'] {
  flex: 1;
  min-width: 0;
}

.currency-select {
  width: 110px;
  flex-shrink: 0;
  text-transform: none;
  font-variant-numeric: tabular-nums;
}

.price-preview {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-primary-strong);
  background: var(--color-primary-soft);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: var(--radius-md);
  padding: 6px 10px;
  font-variant-numeric: tabular-nums;
  align-self: flex-start;
}

.paid-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-strong);
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
}

.paid-toggle:hover {
  border-color: var(--color-primary);
  color: var(--color-primary-strong);
  background: var(--color-primary-soft);
}

.paid-toggle input {
  margin: 0;
  accent-color: var(--color-primary);
}

.links-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.link-add {
  background: var(--color-surface-strong);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  color: var(--color-primary-strong);
  cursor: pointer;
  transition:
    background var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-spring);
}

.link-add:hover {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  transform: translateY(-1px);
}

.links-empty {
  font-size: 12px;
  color: var(--color-text-faint);
  font-style: italic;
  padding: 4px 0;
}

.links-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.link-row {
  display: flex;
  gap: 4px;
  align-items: stretch;
}

.link-label {
  flex: 0 0 90px;
  min-width: 0;
}

.link-url {
  flex: 1;
  min-width: 0;
}

.link-remove {
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-size: 16px;
  line-height: 1;
  padding: 0 8px;
  cursor: pointer;
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
}

.link-remove:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.error {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border: 1px solid rgba(239, 68, 68, 0.25);
  padding: 8px 10px;
  border-radius: var(--radius-md);
}

.sheet-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--color-border-soft);
  background: var(--color-surface-strong);
  flex-shrink: 0;
}

.footer-spacer {
  flex: 1;
}

.error-fade-enter-active,
.error-fade-leave-active {
  transition:
    opacity var(--dur-base) var(--ease-out),
    transform var(--dur-base) var(--ease-spring);
}

.error-fade-enter-from,
.error-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.link-row-enter-active,
.link-row-leave-active {
  transition:
    opacity var(--dur-base) var(--ease-out),
    transform var(--dur-base) var(--ease-spring);
}

.link-row-enter-from,
.link-row-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>