<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  cancelPicking,
  isPicking,
  loadMapStyle,
  markers as visibleMarkers,
  resolvePicking,
} from '../stores/mapState.js';
import { reverseGeocode } from '../lib/geocode.js';
import { getAllEvents } from '../stores/events.js';
import { useI18n } from '../lib/useI18n.js';

const { t } = useI18n();

const props = defineProps({
  initialCoords: { type: Object, default: null },
  field: { type: String, default: '' },
  tripId: { type: String, default: null },
});

const mapEl = ref(null);
const map = ref(null);
const mapLoaded = ref(false);
const pendingPoint = ref(null);
const pendingLabel = ref('');
const loading = ref(false);
const errorMessage = ref('');

const open = computed(() => isPicking(props.field));
const fieldLabel = computed(() => {
  if (props.field === 'placeFrom') return t('eventSheet.fields.placeFrom');
  if (props.field === 'placeTo') return t('eventSheet.fields.placeTo');
  return t('eventSheet.fields.place');
});

const existingPlaces = computed(() => {
  const tripId = props.tripId;
  const all = getAllEvents();
  const seen = new Map();
  const add = (name, coords) => {
    if (!name || !coords || !Number.isFinite(coords.lng) || !Number.isFinite(coords.lat)) {
      return;
    }
    const key = `${name.trim().toLowerCase()}|${coords.lng.toFixed(4)}|${coords.lat.toFixed(4)}`;
    if (!seen.has(key)) {
      seen.set(key, { name: name.trim(), coords: { lng: coords.lng, lat: coords.lat } });
    }
  };
  for (const raw of all) {
    if (tripId && raw.tripId && tripId !== raw.tripId) continue;
    if (raw.type === 'commute') {
      add(raw.placeFrom, raw.placeFromCoords);
      add(raw.placeTo, raw.placeToCoords);
    } else {
      add(raw.place, raw.placeCoords);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
});

const existingOpen = ref(false);
const existingButtonEl = ref(null);
const existingMenuEl = ref(null);

const toggleExisting = () => {
  if (!existingPlaces.value.length) return;
  existingOpen.value = !existingOpen.value;
};

const selectExisting = (entry) => {
  pendingPoint.value = { lng: entry.coords.lng, lat: entry.coords.lat };
  pendingLabel.value = entry.name;
  loading.value = false;
  errorMessage.value = '';
  existingOpen.value = false;
  if (map.value) {
    renderPending(map.value, pendingPoint.value);
    map.value.flyTo({
      center: [entry.coords.lng, entry.coords.lat],
      zoom: Math.max(map.value.getZoom(), 13),
      duration: 500,
    });
  }
};

const handleDocumentClick = (event) => {
  if (!existingOpen.value) return;
  const target = event.target;
  if (existingButtonEl.value?.contains(target)) return;
  if (existingMenuEl.value?.contains(target)) return;
  existingOpen.value = false;
};

const initialCenter = computed(() => {
  if (props.initialCoords?.lng != null && props.initialCoords?.lat != null) {
    return [props.initialCoords.lng, props.initialCoords.lat];
  }
  if (visibleMarkers.value.length) {
    return [visibleMarkers.value[0].lng, visibleMarkers.value[0].lat];
  }
  return [0, 20];
});

const initialZoom = computed(() =>
  props.initialCoords ? 13 : visibleMarkers.value.length ? 6 : 2,
);

let clickAbort = null;

const ensureArrowImage = (mapInstance) => {
  if (!mapInstance) return;
  if (typeof mapInstance.hasImage === 'function' && mapInstance.hasImage('arrow-head')) return;
  const size = 24;
  const data = new Uint8Array(size * size * 4);
  const v0x = size * 0.85; const v0y = size * 0.5;
  const v1x = size * 0.15; const v1y = size * 0.15;
  const v2x = size * 0.15; const v2y = size * 0.85;
  const edge = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      const w0 = edge(v1x, v1y, v2x, v2y, cx, cy);
      const w1 = edge(v2x, v2y, v0x, v0y, cx, cy);
      const w2 = edge(v0x, v0y, v1x, v1y, cx, cy);
      const inside = (w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0);
      const idx = (y * size + x) * 4;
      if (inside) {
        const minW = Math.min(Math.abs(w0), Math.abs(w1), Math.abs(w2));
        const isEdge = minW < 2.5;
        data[idx] = isEdge ? 26 : 255;
        data[idx + 1] = isEdge ? 26 : 255;
        data[idx + 2] = isEdge ? 26 : 255;
        data[idx + 3] = 255;
      } else {
        data[idx + 3] = 0;
      }
    }
  }
  mapInstance.addImage('arrow-head', { width: size, height: size, data }, { sdf: false });
};

const renderMarkerLayers = (mapInstance, markerList) => {
  if (!mapInstance) return;
  for (const id of ['event-arrows', 'event-lines', 'event-markers']) {
    if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
  }
  for (const id of ['event-arrows', 'event-lines', 'event-markers']) {
    if (mapInstance.getSource(id)) mapInstance.removeSource(id);
  }

  const features = markerList.map((m) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
    properties: {
      id: m.id,
      label: m.label ?? '',
      color: m.color ?? '#2b7fff',
      variant: m.variant ?? 'stored',
    },
  }));

  mapInstance.addSource('event-markers', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features },
  });

  ensureArrowImage(mapInstance);

  mapInstance.addLayer({
    id: 'event-markers',
    type: 'circle',
    source: 'event-markers',
    paint: {
      'circle-radius': 8,
      'circle-color': ['get', 'color'],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
      'circle-opacity': 0.8,
    },
  });
};

const renderPending = (mapInstance, point) => {
  if (!mapInstance) return;
  if (mapInstance.getLayer('pending-pin')) mapInstance.removeLayer('pending-pin');
  if (mapInstance.getSource('pending-pin')) mapInstance.removeSource('pending-pin');
  if (!point) return;
  mapInstance.addSource('pending-pin', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
        properties: {},
      }],
    },
  });
  mapInstance.addLayer({
    id: 'pending-pin',
    type: 'circle',
    source: 'pending-pin',
    paint: {
      'circle-radius': 12,
      'circle-color': '#6366f1',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 3,
      'circle-opacity': 0.95,
    },
  });
};

const teardownMap = () => {
  if (clickAbort) {
    clickAbort.abort();
    clickAbort = null;
  }
  if (map.value) {
    map.value.remove();
    map.value = null;
  }
  mapLoaded.value = false;
  pendingPoint.value = null;
  pendingLabel.value = '';
  existingOpen.value = false;
};

const watchId = watch(open, async (isOpen) => {
  if (!isOpen) {
    teardownMap();
    return;
  }
  await nextTick();
  if (!mapEl.value) return;
  if (map.value) {
    map.value.remove();
    map.value = null;
  }
  pendingPoint.value = null;
  pendingLabel.value = '';
  errorMessage.value = '';
  existingOpen.value = false;
  if (typeof document !== 'undefined') {
    document.addEventListener('click', handleDocumentClick);
  }
  const mapInstance = new maplibregl.Map({
    container: mapEl.value,
    style: await loadMapStyle(),
    center: initialCenter.value,
    zoom: initialZoom.value,
  });
  mapInstance.addControl(new maplibregl.NavigationControl());
  map.value = mapInstance;
  mapInstance.on('load', () => {
    mapLoaded.value = true;
    renderMarkerLayers(mapInstance, visibleMarkers.value);
    renderPending(mapInstance, pendingPoint.value);
  });
  const ac = new AbortController();
  clickAbort = ac;
  mapInstance.on('click', async (event) => {
    if (!isPicking(props.field)) return;
    const { lng, lat } = event.lngLat;
    errorMessage.value = '';
    loading.value = true;
    pendingPoint.value = { lng, lat };
    pendingLabel.value = '';
    renderPending(mapInstance, pendingPoint.value);
    try {
      const result = await reverseGeocode(lng, lat, { signal: ac.signal });
      pendingPoint.value = { lng: result.lng, lat: result.lat };
      pendingLabel.value = result.name;
      renderPending(mapInstance, pendingPoint.value);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        errorMessage.value = t('eventSheet.errors.searchFailed');
      }
    } finally {
      loading.value = false;
    }
  });
});

const watchMarkers = watch(
  visibleMarkers,
  (markers) => {
    if (mapLoaded.value && map.value) {
      renderMarkerLayers(map.value, markers);
    }
  },
  { deep: true },
);

onBeforeUnmount(() => {
  watchId();
  watchMarkers();
  if (typeof document !== 'undefined') {
    document.removeEventListener('click', handleDocumentClick);
  }
  teardownMap();
});

const handleConfirm = () => {
  if (!pendingPoint.value) return;
  const result = {
    name: pendingLabel.value || `${pendingPoint.value.lat.toFixed(4)}, ${pendingPoint.value.lng.toFixed(4)}`,
    lng: pendingPoint.value.lng,
    lat: pendingPoint.value.lat,
  };
  resolvePicking(result);
};

const handleCancel = () => {
  cancelPicking();
};

const handleBackdropClick = (event) => {
  if (event.target === event.currentTarget) handleCancel();
};
</script>

<template>
  <transition name="picker">
    <div v-if="open" class="map-picker" role="dialog" aria-modal="true" :aria-label="fieldLabel" @click="handleBackdropClick">
      <div class="map-picker-frame">
        <header class="map-picker-header">
          <button
            type="button"
            class="map-picker-close"
            :aria-label="t('eventSheet.actions.cancel')"
            @click="handleCancel"
          >
            <span aria-hidden="true">&times;</span>
          </button>
          <div class="map-picker-title">
            <span class="map-picker-eyebrow">{{ t('app.trip') }}</span>
            <strong>{{ fieldLabel }}</strong>
          </div>
          <span class="map-picker-spacer" aria-hidden="true"></span>
        </header>

        <div ref="mapEl" class="map-picker-map">
          <div class="map-picker-top">
            <button
              ref="existingButtonEl"
              type="button"
              class="map-picker-pill"
              :disabled="!existingPlaces.length"
              :class="{ active: existingOpen }"
              :aria-expanded="existingOpen"
              :title="existingPlaces.length ? t('eventSheet.existing.reuseTitle') : t('eventSheet.existing.noSaved')"
              @click.stop="toggleExisting"
            >
              {{ t('eventSheet.actions.existing') }}
              <span class="map-picker-pill-caret" aria-hidden="true">▾</span>
            </button>
            <ul
              v-if="existingOpen && existingPlaces.length"
              ref="existingMenuEl"
              class="map-picker-existing-menu"
              role="listbox"
            >
              <li
                v-for="entry in existingPlaces"
                :key="`${entry.coords.lng.toFixed(4)}-${entry.coords.lat.toFixed(4)}-${entry.name}`"
                role="option"
                class="map-picker-existing-item"
                @click.stop="selectExisting(entry)"
              >
                {{ entry.name }}
              </li>
            </ul>
          </div>
        </div>

        <p v-if="errorMessage" class="map-picker-error">{{ errorMessage }}</p>
        <p v-else-if="pendingLabel" class="map-picker-hint">{{ pendingLabel }}</p>
        <p v-else class="map-picker-hint">{{ t('eventSheet.actions.clickOnMap') }}</p>

        <footer class="map-picker-footer">
          <button
            type="button"
            class="map-picker-btn map-picker-btn--ghost"
            @click="handleCancel"
          >
            {{ t('eventSheet.actions.cancel') }}
          </button>
          <button
            type="button"
            class="map-picker-btn map-picker-btn--primary"
            :disabled="!pendingPoint || loading"
            @click="handleConfirm"
          >
            {{ loading ? t('eventSheet.errors.searching') : t('eventSheet.actions.save') }}
          </button>
        </footer>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.map-picker {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.55);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  padding: 0;
}

.map-picker-frame {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--color-surface);
  animation: slideUp var(--dur-slow) var(--ease-spring);
}

.map-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-strong);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  flex-shrink: 0;
}

.map-picker-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.map-picker-eyebrow {
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-primary);
  font-weight: 700;
}

.map-picker-title strong {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.map-picker-close {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.map-picker-close {
  font-family: inherit;
  font-size: 22px;
  line-height: 1;
  padding: 0;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition:
    background var(--dur-base) var(--ease-out),
    transform var(--dur-fast) var(--ease-spring),
    box-shadow var(--dur-base) var(--ease-out);
}

.map-picker-close:hover {
  background: var(--color-surface-strong);
  box-shadow: var(--shadow-md);
}

.map-picker-close,
.map-picker-spacer {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.map-picker-close:active {
  transform: scale(0.94);
}

.map-picker-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface-strong);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  color: var(--color-text);
  cursor: pointer;
  box-shadow: var(--shadow-md);
  transition:
    background var(--dur-base) var(--ease-out),
    border-color var(--dur-base) var(--ease-out),
    color var(--dur-base) var(--ease-out),
    transform var(--dur-fast) var(--ease-spring);
}

.map-picker-pill:hover:not(:disabled):not(.active) {
  background: var(--color-surface);
  border-color: var(--color-border-strong);
}

.map-picker-pill.active {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  border-color: var(--color-primary);
  color: var(--color-text-inverse);
  box-shadow: 0 6px 18px var(--color-primary-glow);
}

.map-picker-pill:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.map-picker-pill-caret {
  font-size: 10px;
  transition: transform var(--dur-base) var(--ease-out);
}

.map-picker-pill.active .map-picker-pill-caret {
  transform: rotate(180deg);
}

@keyframes dropdownIn {
  from {
    opacity: 0;
    transform: translate(-50%, -6px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

.map-picker-map {
  flex: 1;
  min-height: 0;
  position: relative;
  background: var(--color-bg-base);
}

.map-picker-top {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 2;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.map-picker-top .map-picker-pill {
  pointer-events: auto;
}

.map-picker-existing-menu {
  pointer-events: auto;
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  min-width: 220px;
  max-width: calc(100vw - 24px);
  max-height: 50vh;
  overflow-y: auto;
  margin: 0;
  padding: 6px;
  list-style: none;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface-strong);
  -webkit-backdrop-filter: var(--glass-blur-strong);
  backdrop-filter: var(--glass-blur-strong);
  box-shadow: var(--shadow-md);
  animation: dropdownIn var(--dur-base) var(--ease-out);
}

.map-picker-existing-item {
  display: block;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.map-picker-existing-item:hover,
.map-picker-existing-item:focus-visible {
  background: linear-gradient(135deg, var(--color-primary-soft) 0%, var(--color-accent-soft) 100%);
  color: var(--color-primary-strong);
  outline: none;
}

.map-picker-hint,
.map-picker-error {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 88px;
  margin: 0;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-surface-strong);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
  text-align: center;
  pointer-events: none;
  z-index: 2;
}

.map-picker-error {
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border-color: rgba(239, 68, 68, 0.35);
}

.map-picker-footer {
  display: flex;
  gap: 10px;
  padding: 12px 14px calc(12px + env(safe-area-inset-bottom)) 14px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-strong);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  flex-shrink: 0;
}

.map-picker-btn {
  flex: 1;
  padding: 12px 14px;
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    background var(--dur-base) var(--ease-out),
    transform var(--dur-fast) var(--ease-spring),
    box-shadow var(--dur-base) var(--ease-out),
    opacity var(--dur-base) var(--ease-out);
}

.map-picker-btn:active {
  transform: translateY(1px);
}

.map-picker-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.map-picker-btn--ghost {
  background: var(--color-surface);
  border-color: var(--color-border);
  color: var(--color-text);
  box-shadow: var(--shadow-sm);
}

.map-picker-btn--ghost:hover {
  background: var(--color-surface-strong);
  border-color: var(--color-border-strong);
}

.map-picker-btn--primary {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  color: var(--color-text-inverse);
  border-color: var(--color-primary);
  box-shadow: 0 6px 18px var(--color-primary-glow);
}

.map-picker-btn--primary:hover:not(:disabled) {
  filter: brightness(1.04);
  box-shadow: 0 10px 28px var(--color-primary-glow);
}

.picker-enter-active,
.picker-leave-active {
  transition: opacity var(--dur-base) var(--ease-out);
}

.picker-enter-active .map-picker-frame,
.picker-leave-active .map-picker-frame {
  transition: transform var(--dur-slow) var(--ease-spring);
}

.picker-enter-from,
.picker-leave-to {
  opacity: 0;
}

.picker-enter-from .map-picker-frame,
.picker-leave-to .map-picker-frame {
  transform: translateY(40px);
}
</style>
