<script setup>
import { computed, nextTick, onBeforeUnmount, onUnmounted, ref, watch } from 'vue';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import DayCarousel from './components/DayCarousel.vue';
import EventSheet from './components/EventSheet.vue';
import TripSelectModal from './components/TripSelectModal.vue';
import TripCalendar from './components/TripCalendar.vue';
import LanguageSwitcher from './components/LanguageSwitcher.vue';
import TripCostSummary from './components/TripCostSummary.vue';
import {
  appendStoredMarker,
  cancelPicking,
  clearStoredMarkers,
  getMap,
  getMapStyle,
  getMapStyleId,
  isPicking,
  MAP_STYLES,
  markers as visibleMarkers,
  removeStoredMarkersFor,
  resolvePicking,
  setMap,
  setMapStyle,
  setSheetOpen,
} from './stores/mapState.js';
import {
  activeTrip,
  updateTrip,
} from './stores/trips.js';
import { migrateLegacyEvents, setLegacyMigrationTripId } from './stores/events.js';
import { reverseGeocode } from './lib/geocode.js';
import { useI18n } from './lib/useI18n.js';

const { t } = useI18n();

let map = null;
let mapClickHandler = null;
let moveEndHandler = null;
let mapResizeObserver = null;

const calendarView = ref('carousel'); // 'carousel' | 'all'
const carouselMapEl = ref(null);
const pendingMapInit = ref(true);

const mapStyleId = ref(getMapStyleId());

const handleMapStyleChange = (event) => {
  const next = event.target.value;
  setMapStyle(next);
  mapStyleId.value = next;
  if (map) {
    map.setStyle(getMapStyle());
  }
};

const trip = activeTrip;

const tripSelectorOpen = ref(!trip.value);

const handleTripSelected = (selectedTrip) => {
  setLegacyMigrationTripId(selectedTrip.id);
  tripSelectorOpen.value = false;
};

const openTripSelector = () => {
  tripSelectorOpen.value = true;
};

const closeTripSelector = () => {
  if (trip.value) tripSelectorOpen.value = false;
};

const startDate = computed({
  get: () => trip.value?.startDate ?? '',
  set: (value) => {
    if (trip.value) {
      const next = { ...trip.value, startDate: value };
      if (next.endDate < value) next.endDate = value;
      updateTrip(trip.value.id, next);
    }
  },
});

const endDate = computed({
  get: () => trip.value?.endDate ?? '',
  set: (value) => {
    if (trip.value) {
      const next = { ...trip.value, endDate: value };
      if (next.startDate > value) next.startDate = value;
      updateTrip(trip.value.id, next);
    }
  },
});

const showCarousel = computed(
  () =>
    !!trip.value &&
    !!startDate.value &&
    !!endDate.value &&
    endDate.value >= startDate.value,
);

const dateError = computed(() => {
  if (!startDate.value || !endDate.value) return null;
  if (endDate.value < startDate.value) return t('app.dateError');
  return null;
});

watch(
  () => trip.value?.id,
  (newId, oldId) => {
    if (newId) {
      setLegacyMigrationTripId(newId);
      migrateLegacyEvents(newId);
    }
    if (oldId && newId !== oldId) {
      clearStoredMarkers();
    }
  },
  { immediate: true },
);

const sheetOpen = ref(false);
const sheetContext = ref({ startDateTime: '', endDateTime: '', event: null });

const openSheet = ({ startDateTime, endDateTime }) => {
  sheetContext.value = { startDateTime, endDateTime, event: null };
  sheetOpen.value = true;
  setSheetOpen(true);
};

const openSheetForEdit = (event) => {
  sheetContext.value = {
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime,
    event,
  };
  sheetOpen.value = true;
  setSheetOpen(true);
};

const closeSheet = () => {
  sheetOpen.value = false;
  setSheetOpen(false);
  cancelPicking();
};

const onEventSubmitted = (event) => {
  const isEdit = sheetContext.value.event != null;
  if (isEdit) {
    removeStoredMarkersFor(event);
  }
  if (trip.value && event.tripId && event.tripId !== trip.value.id) {
    closeSheet();
    return;
  }
  if (event.type === 'commute') {
    if (event.placeFromCoords) {
      appendStoredMarker({
        id: `${event.id}-from`,
        lng: event.placeFromCoords.lng,
        lat: event.placeFromCoords.lat,
        label: event.placeFrom,
        color: '#f79009',
      });
    }
    if (event.placeToCoords) {
      appendStoredMarker({
        id: `${event.id}-to`,
        lng: event.placeToCoords.lng,
        lat: event.placeToCoords.lat,
        label: event.placeTo,
        color: '#16a34a',
      });
    }
  } else if (event.placeCoords) {
    appendStoredMarker({
      id: event.id,
      lng: event.placeCoords.lng,
      lat: event.placeCoords.lat,
      label: event.place,
      color: '#2b7fff',
    });
  }
  closeSheet();
};

const onEventDeleted = (event) => {
  removeStoredMarkersFor(event);
  closeSheet();
};

const ensureArrowImage = () => {
  if (!map) return;
  if (typeof map.hasImage === 'function' && map.hasImage('arrow-head')) return;
  const size = 24;
  const data = new Uint8Array(size * size * 4);
  const v0x = size * 0.85, v0y = size * 0.5;
  const v1x = size * 0.15, v1y = size * 0.15;
  const v2x = size * 0.15, v2y = size * 0.85;
  const edge = (ax, ay, bx, by, cx, cy) =>
    (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
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
  map.addImage('arrow-head', { width: size, height: size, data }, { sdf: false });
};

const bearing = (fromLng, fromLat, toLng, toLat) => {
  const φ1 = (fromLat * Math.PI) / 180;
  const φ2 = (toLat * Math.PI) / 180;
  const Δλ = ((toLng - fromLng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
};

const renderMarkers = (markerList) => {
  if (!map) return;
  for (const id of ['event-arrows', 'event-lines', 'event-markers']) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  for (const id of ['event-arrows', 'event-lines', 'event-markers']) {
    if (map.getSource(id)) map.removeSource(id);
  }
  if (!markerList.length) return;

  const pointFeatures = markerList.map((m) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
    properties: {
      id: m.id,
      label: m.label ?? '',
      color: m.color ?? '#2b7fff',
      variant: m.variant ?? 'stored',
    },
  }));

  const byId = new Map();
  for (const m of markerList) {
    if (m.id.endsWith('-from')) {
      const eventId = m.id.slice(0, -'-from'.length);
      byId.set(eventId, { from: m, to: null, ...(byId.get(eventId) ?? {}) });
      byId.get(eventId).from = m;
    } else if (m.id.endsWith('-to')) {
      const eventId = m.id.slice(0, -'-to'.length);
      byId.set(eventId, { from: null, to: m, ...(byId.get(eventId) ?? {}) });
      byId.get(eventId).to = m;
    }
  }

  const lineFeatures = [];
  const arrowFeatures = [];
  for (const [eventId, pair] of byId.entries()) {
    if (!pair.from || !pair.to) continue;
    const variant = pair.to.variant ?? 'stored';
    const color = pair.to.color ?? '#16a34a';
    lineFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [pair.from.lng, pair.from.lat],
          [pair.to.lng, pair.to.lat],
        ],
      },
      properties: { id: `${eventId}-line`, color, variant },
    });
    const angle = bearing(pair.from.lng, pair.from.lat, pair.to.lng, pair.to.lat);
    arrowFeatures.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pair.to.lng, pair.to.lat] },
      properties: { id: `${eventId}-arrow`, color, variant, angle },
    });
  }

  map.addSource('event-markers', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: pointFeatures },
  });

  if (lineFeatures.length) {
    map.addSource('event-lines', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: lineFeatures },
    });
  }

  ensureArrowImage();

  if (lineFeatures.length) {
    map.addLayer({
      id: 'event-lines',
      type: 'line',
      source: 'event-lines',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': [
          'match',
          ['get', 'variant'],
          'hover', 4,
          2.5,
        ],
        'line-opacity': [
          'match',
          ['get', 'variant'],
          'preview', 0.7,
          'hover', 0.95,
          0.8,
        ],
        'line-dasharray': [2, 2],
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
  }

  if (arrowFeatures.length) {
    map.addSource('event-arrows', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: arrowFeatures },
    });
    map.addLayer({
      id: 'event-arrows',
      type: 'symbol',
      source: 'event-arrows',
      layout: {
        'icon-image': 'arrow-head',
        'icon-rotate': ['get', 'angle'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-size': [
          'match',
          ['get', 'variant'],
          'hover', 0.9,
          0.6,
        ],
      },
      paint: {
        'icon-opacity': [
          'match',
          ['get', 'variant'],
          'preview', 0.7,
          'hover', 1,
          0.9,
        ],
      },
    });
  }

  map.addLayer({
    id: 'event-markers',
    type: 'circle',
    source: 'event-markers',
    paint: {
      'circle-radius': [
        'match',
        ['get', 'variant'],
        'preview', 9,
        'hover', 12,
        8,
      ],
      'circle-color': ['get', 'color'],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': [
        'match',
        ['get', 'variant'],
        'preview', 3,
        'hover', 4,
        2,
      ],
      'circle-opacity': [
        'match',
        ['get', 'variant'],
        'preview', 0.85,
        'hover', 1,
        1,
      ],
    },
  });
};

const onPickComplete = (result) => {
  resolvePicking(result);
};

const initializeMap = (container) => {
  if (map) {
    if (mapClickHandler) map.off('click', mapClickHandler);
    if (moveEndHandler) map.off('moveend', moveEndHandler);
    map.remove();
    map = null;
  }
  if (mapResizeObserver) {
    mapResizeObserver.disconnect();
    mapResizeObserver = null;
  }

  const savedView = trip.value?.mapView;
  const initialCenter = savedView ? [savedView.lng, savedView.lat] : [0, 0];
  const initialZoom = savedView ? savedView.zoom : 2;
  const initialBearing = savedView?.bearing ?? 0;

  map = new maplibregl.Map({
    container,
    style: getMapStyle(),
    center: initialCenter,
    zoom: initialZoom,
    bearing: initialBearing,
    transformRequest: (url, resourceType) => {
      if (resourceType === 'Tile' && url.startsWith('https://tile.openstreetmap.org/')) {
        return { url, headers: { Referer: 'https://tracker.local/' } };
      }
      return { url };
    },
  });

  map.addControl(new maplibregl.NavigationControl());

  setMap(map);

  map.on('load', () => {
    renderMarkers(visibleMarkers.value);
  });

  mapClickHandler = (event) => {
    if (!isPicking()) return;
    const { lng, lat } = event.lngLat;
    reverseGeocode(lng, lat)
      .then((result) => onPickComplete(result))
      .catch((err) => {
        console.error('Reverse geocode failed', err);
        cancelPicking();
      });
  };
  map.on('click', mapClickHandler);

  moveEndHandler = () => {
    const active = trip.value;
    if (!active) return;
    const center = map.getCenter();
    const view = {
      lng: center.lng,
      lat: center.lat,
      zoom: map.getZoom(),
      bearing: map.getBearing(),
    };
    updateTrip(active.id, { mapView: view });
  };
  map.on('moveend', moveEndHandler);

  if (typeof ResizeObserver !== 'undefined') {
    mapResizeObserver = new ResizeObserver(() => {
      try {
        map?.resize();
      } catch {
        // ignore
      }
    });
    mapResizeObserver.observe(container);
  }
};

const disposeMap = () => {
  if (mapResizeObserver) {
    mapResizeObserver.disconnect();
    mapResizeObserver = null;
  }
  if (map && mapClickHandler) {
    map.off('click', mapClickHandler);
    mapClickHandler = null;
  }
  if (map && moveEndHandler) {
    map.off('moveend', moveEndHandler);
    moveEndHandler = null;
  }
  if (map) {
    map.remove();
    map = null;
  }
  setMap(null);
};

watch(sheetOpen, async (isOpen) => {
  await nextTick();
  getMap()?.resize();
  if (isOpen) {
    getMap()?.getCanvas()?.classList.add('picking-cursor');
  } else {
    getMap()?.getCanvas()?.classList.remove('picking-cursor');
  }
  renderMarkers(visibleMarkers.value);
});

watch(calendarView, async () => {
  await nextTick();
  getMap()?.resize();
});

watch(carouselMapEl, (el) => {
  if (!pendingMapInit.value) return;
  if (el) {
    pendingMapInit.value = false;
    initializeMap(el);
  }
});

const fitToMarkers = (markerList) => {
  if (!map || !markerList.length) return;
  if (markerList.length === 1) {
    const m = markerList[0];
    const targetZoom = Math.max(map.getZoom(), 13);
    map.flyTo({ center: [m.lng, m.lat], zoom: targetZoom, duration: 500 });
    return;
  }
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const m of markerList) {
    if (m.lng < minLng) minLng = m.lng;
    if (m.lng > maxLng) maxLng = m.lng;
    if (m.lat < minLat) minLat = m.lat;
    if (m.lat > maxLat) maxLat = m.lat;
  }
  const bounds = new maplibregl.LngLatBounds(
    [minLng, minLat],
    [maxLng, maxLat],
  );
  map.fitBounds(bounds, {
    padding: 80,
    maxZoom: 15,
    duration: 500,
  });
};

const hasTransient = (markerList) =>
  markerList.some((m) => m.variant === 'preview' || m.variant === 'hover');

const stopMarkersWatch = watch(
  visibleMarkers,
  (markers, prev) => {
    renderMarkers(markers);
    const wasTransient = hasTransient(prev || []);
    const isTransient = hasTransient(markers);
    if (isTransient && !wasTransient) {
      const targets = markers.filter(
        (m) => m.variant === 'preview' || m.variant === 'hover',
      );
      fitToMarkers(targets);
    }
  },
  { deep: true },
);

onUnmounted(() => {
  stopMarkersWatch();
});

onBeforeUnmount(() => {
  disposeMap();
});
</script>

<template>
  <div class="layout" :class="{ 'layout--all': calendarView === 'all' }">
    <header class="topbar">
      <div class="topbar-brand">
        <span class="topbar-label">
          {{ t('app.trip') }}
          <button class="trip-switch-btn" type="button" @click="openTripSelector">
            {{ t('app.switchTrip') }}
          </button>
        </span>
        <span class="topbar-trip-name" v-if="trip">{{ trip.name }}</span>
        <span class="topbar-trip-name muted" v-else>{{ t('app.noTrip') }}</span>
      </div>

      <div class="topbar-section topbar-dates" v-if="trip">
        <label class="topbar-field">
          <span class="topbar-field-label">{{ t('app.startDate') }}</span>
          <input class="tp-input tp-input--compact" type="date" v-model="startDate" :max="endDate || undefined" />
        </label>
        <label class="topbar-field">
          <span class="topbar-field-label">{{ t('app.endDate') }}</span>
          <input class="tp-input tp-input--compact" type="date" v-model="endDate" :min="startDate || undefined" />
        </label>
      </div>

      <TripCostSummary v-if="trip" :trip-id="trip.id" compact />

      <div class="topbar-section topbar-view" v-if="showCarousel">
        <div class="view-toggle">
          <button
            class="view-btn"
            :class="{ active: calendarView === 'carousel' }"
            type="button"
            @click="calendarView = 'carousel'"
          >
            {{ t('app.view.day') }}
          </button>
          <button
            class="view-btn"
            :class="{ active: calendarView === 'all' }"
            type="button"
            @click="calendarView = 'all'"
          >
            {{ t('app.view.allDays') }}
          </button>
        </div>
      </div>

      <div class="topbar-section topbar-actions">
        <label class="map-style-select">
          <span class="map-style-select-label">Map</span>
          <select
            class="tp-input tp-input--compact"
            :value="mapStyleId"
            @change="handleMapStyleChange"
          >
            <option v-for="s in MAP_STYLES" :key="s.id" :value="s.id">
              {{ s.label }}
            </option>
          </select>
        </label>
        <LanguageSwitcher />
      </div>
    </header>

    <transition name="slide-down">
      <p v-if="dateError" class="error">{{ dateError }}</p>
    </transition>

    <div class="layout-row">
      <aside class="sidebar">
        <div
          class="sidebar-body"
          v-if="showCarousel && calendarView === 'carousel'"
        >
          <DayCarousel
            :start-date="startDate"
            :end-date="endDate"
            :trip-id="trip?.id ?? null"
            @request-add-event="openSheet"
            @request-edit-event="openSheetForEdit"
          />
        </div>

        <div
          class="sidebar-calendar"
          v-else-if="showCarousel && calendarView === 'all'"
        >
          <TripCalendar
            :start-date="startDate"
            :end-date="endDate"
            :trip-id="trip?.id ?? null"
            @request-add-event="openSheet"
            @request-edit-event="openSheetForEdit"
          />
        </div>
      </aside>

      <div
        class="map-pane"
      >
        <div ref="carouselMapEl" class="map"></div>
      </div>

      <Transition name="sheet">
        <EventSheet
          v-if="sheetOpen"
          class="event-sheet"
          :start-date-time="sheetContext.startDateTime"
          :end-date-time="sheetContext.endDateTime"
          :event="sheetContext.event"
          :trip-id="trip?.id ?? null"
          @close="closeSheet"
          @submitted="onEventSubmitted"
          @deleted="onEventDeleted"
        />
      </Transition>
    </div>

    <TripSelectModal
      :open="tripSelectorOpen"
      :can-close="!!trip"
      @close="closeTripSelector"
      @selected="handleTripSelected"
    />
  </div>
</template>

<style>
.layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: relative;
}

.layout-row {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

.layout--all .sidebar {
  flex: 1 1 50%;
  min-width: 0;
}

.sidebar {
  flex: 0 1 380px;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border-right: 1px solid var(--color-border);
  box-sizing: border-box;
  height: 100%;
  overflow: hidden;
  box-shadow: 8px 0 32px rgba(15, 23, 42, 0.06);
  animation: slideInLeft var(--dur-slow) var(--ease-out);
  transition: flex-basis var(--dur-slow) var(--ease-out);
}

.sidebar-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.sidebar-calendar {
  flex: 1;
  display: flex;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.topbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-strong);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  position: relative;
  flex-shrink: 0;
}

.topbar::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 14px;
  right: 14px;
  height: 2px;
  background: linear-gradient(90deg,
    transparent 0%,
    var(--color-primary) 30%,
    var(--color-accent) 70%,
    transparent 100%);
  border-radius: 2px;
  opacity: 0.65;
}

.topbar-brand {
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-width: 220px;
}

.topbar-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-primary);
  font-weight: 700;
}

.topbar-trip-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 1px;
}

.topbar-trip-name.muted {
  color: var(--color-text-faint);
  font-weight: 500;
}

.topbar-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.topbar-dates {
  display: flex;
  align-items: center;
  gap: 8px;
}

.topbar-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.topbar-field-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  font-weight: 700;
}

.tp-input--compact {
  padding: 5px 8px;
  font-size: 12px;
  min-width: 130px;
}

.topbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.map-style-select {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px 5px 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-surface);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition:
    background var(--dur-base) var(--ease-out),
    border-color var(--dur-base) var(--ease-out);
}

.map-style-select:hover {
  background: var(--color-surface-strong);
  border-color: var(--color-border-strong);
}

.map-style-select-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--color-text-inverse);
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
}

.map-style-select select {
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  border: 0;
  padding: 0 18px 0 0;
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  color: var(--color-text);
  cursor: pointer;
  outline: none;
  min-width: 0;
}

.map-style-select::after {
  content: '▾';
  position: relative;
  right: 14px;
  font-size: 10px;
  color: var(--color-text-muted);
  pointer-events: none;
}

.trip-switch-btn {
  padding: 2px 12px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface-strong);
  color: var(--color-text);
  cursor: pointer;
  transition:
    background var(--dur-base) var(--ease-out),
    transform var(--dur-fast) var(--ease-spring),
    border-color var(--dur-base) var(--ease-out),
    box-shadow var(--dur-base) var(--ease-out);
  box-shadow: var(--shadow-sm);
}

.trip-switch-btn:hover {
  background: linear-gradient(135deg, var(--color-primary-soft) 0%, var(--color-accent-soft) 100%);
  border-color: var(--color-primary);
  color: var(--color-primary-strong);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.trip-switch-btn:active {
  transform: translateY(0);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.field-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  font-weight: 700;
}

.error {
  margin: 0;
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border-bottom: 1px solid rgba(239, 68, 68, 0.25);
}

.view-toggle {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-surface-strong);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-sm);
}

.view-btn {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  background: transparent;
  border: 0;
  border-radius: var(--radius-pill);
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    background var(--dur-base) var(--ease-out),
    color var(--dur-base) var(--ease-out),
    box-shadow var(--dur-base) var(--ease-out);
}

.view-btn:hover:not(.active) {
  color: var(--color-text);
  background: var(--color-primary-soft);
}

.view-btn.active {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  color: var(--color-text-inverse);
  box-shadow: 0 4px 14px var(--color-primary-glow);
}

.map-pane {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  transition: flex-basis var(--dur-slow) var(--ease-out);
  animation: fadeIn var(--dur-slow) var(--ease-out);
}

.map {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
}

.maplibregl-canvas.picking-cursor,
.maplibregl-canvas.picking-cursor.maplibregl-interactive {
  cursor: crosshair !important;
}

.maplibregl-ctrl-group {
  background: var(--color-surface-strong) !important;
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--color-border) !important;
  box-shadow: var(--shadow-md) !important;
  border-radius: var(--radius-md) !important;
  overflow: hidden;
}

.maplibregl-ctrl-group button {
  background-color: transparent !important;
  transition: background var(--dur-fast) var(--ease-out) !important;
}

.maplibregl-ctrl-group button:hover {
  background: var(--color-primary-soft) !important;
}

.maplibregl-ctrl-attrib {
  background: var(--color-surface-soft) !important;
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border-radius: var(--radius-sm) !important;
  font-size: 10px !important;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition:
    opacity var(--dur-base) var(--ease-out),
    transform var(--dur-base) var(--ease-out);
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.sheet-enter-active,
.sheet-leave-active {
  transition:
    opacity var(--dur-slow) var(--ease-out),
    transform var(--dur-slow) var(--ease-spring);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
  transform: translateX(60px);
}
</style>