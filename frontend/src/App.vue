<script setup>
import { computed, nextTick, onBeforeUnmount, onUnmounted, ref, watch } from 'vue';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import DayCarousel from './components/DayCarousel.vue';
import EventSheet from './components/EventSheet.vue';
import TripSelectModal from './components/TripSelectModal.vue';
import TripCalendar from './components/TripCalendar.vue';
import {
  appendStoredMarker,
  cancelPicking,
  clearStoredMarkers,
  getMap,
  isPicking,
  markers as visibleMarkers,
  removeStoredMarkersFor,
  resolvePicking,
  setMap,
  setSheetOpen,
} from './stores/mapState.js';
import {
  activeTrip,
  updateTrip,
} from './stores/trips.js';
import { migrateLegacyEvents, setLegacyMigrationTripId } from './stores/events.js';
import { reverseGeocode } from './lib/geocode.js';

let map = null;
let mapClickHandler = null;
let moveEndHandler = null;
let mapResizeObserver = null;

const calendarView = ref('carousel'); // 'carousel' | 'all'
const carouselMapEl = ref(null);
const sidebarMapEl = ref(null);
const pendingMapInit = ref(true);

const trip = activeTrip;

const tripSelectorOpen = ref(!trip.value);

const handleTripSelected = (selectedTrip) => {
  setLegacyMigrationTripId(selectedTrip.id);
  // Re-tag any events without a tripId to the selected trip.
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
  if (endDate.value < startDate.value) return 'End date must be on or after start date.';
  return null;
});

// Clear map markers when the active trip changes.
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
  // Only add map markers for events belonging to the active trip.
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
  // Rasterize a right-pointing triangle into RGBA pixel data.
  // Triangle vertices in image coords (y grows downward):
  //   tip: (size*0.85, size*0.5)
  //   top-left: (size*0.15, size*0.15)
  //   bottom-left: (size*0.15, size*0.85)
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
        // White fill with dark stroke approximated by darker pixels near edges
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

  // Build commute line + arrow features by pairing from/to markers sharing an event id prefix
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
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors',
        },
      },
      layers: [
        {
          id: 'osm',
          type: 'raster',
          source: 'osm',
          paint: { 'raster-saturation': -1, 'raster-contrast': 0.15 },
        },
      ],
    },
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

  // Persist the map's view to the active trip whenever the user pans or zooms.
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

  // Resize the map when the floating window is resized.
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

// Reinitialize the map when the view mode changes (map moves between
// the right pane in day mode and the sidebar in all-days mode).
watch(calendarView, async (mode) => {
  disposeMap();
  await nextTick();
  const el = mode === 'carousel' ? carouselMapEl.value : sidebarMapEl.value;
  if (el) {
    initializeMap(el);
  } else {
    pendingMapInit.value = true;
  }
});

watch([carouselMapEl, sidebarMapEl], ([carouselEl, sidebarEl]) => {
  if (!pendingMapInit.value) return;
  const el = calendarView.value === 'carousel' ? carouselEl : sidebarEl;
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
    // Fit the map to the relevant markers when transient ones appear
    // (preview on sheet open / pick, hover on calendar). Skip stored-only
    // updates to avoid jumping the map after a submit.
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
    <aside class="sidebar">
      <header class="trip-header">
        <div class="trip-header-info">
          <span class="trip-label">Trip</span>
          <span class="trip-name" v-if="trip">{{ trip.name }}</span>
          <span class="trip-name muted" v-else>No trip</span>
        </div>
        <button class="trip-switch-btn" type="button" @click="openTripSelector">
          Switch
        </button>
      </header>

      <div class="date-fields" v-if="trip">
        <label class="field">
          <span class="field-label">Start date</span>
          <input type="date" v-model="startDate" :max="endDate || undefined" />
        </label>
        <label class="field">
          <span class="field-label">End date</span>
          <input type="date" v-model="endDate" :min="startDate || undefined" />
        </label>
      </div>

      <p v-if="dateError" class="error">{{ dateError }}</p>

      <div class="view-toggle" v-if="showCarousel">
        <button
          class="view-btn"
          :class="{ active: calendarView === 'carousel' }"
          type="button"
          @click="calendarView = 'carousel'"
        >
          Day
        </button>
        <button
          class="view-btn"
          :class="{ active: calendarView === 'all' }"
          type="button"
          @click="calendarView = 'all'"
        >
          All days
        </button>
      </div>

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
        class="sidebar-map"
        v-else-if="showCarousel && calendarView === 'all'"
      >
        <div ref="sidebarMapEl" class="map"></div>
      </div>
    </aside>

    <div
      v-if="calendarView === 'carousel'"
      class="map-pane"
      :class="{ 'with-sheet': sheetOpen }"
    >
      <div ref="carouselMapEl" class="map"></div>
    </div>

    <div
      v-else-if="calendarView === 'all' && showCarousel"
      class="main-content"
    >
      <TripCalendar
        :start-date="startDate"
        :end-date="endDate"
        :trip-id="trip?.id ?? null"
        @request-add-event="openSheet"
        @request-edit-event="openSheetForEdit"
      />
    </div>

    <EventSheet
      v-if="sheetOpen"
      :start-date-time="sheetContext.startDateTime"
      :end-date-time="sheetContext.endDateTime"
      :event="sheetContext.event"
      :trip-id="trip?.id ?? null"
      @close="closeSheet"
      @submitted="onEventSubmitted"
      @deleted="onEventDeleted"
    />

    <TripSelectModal
      :open="tripSelectorOpen"
      :can-close="!!trip"
      @close="closeTripSelector"
      @selected="handleTripSelected"
    />
  </div>
</template>

<style>
html,
body,
#app {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1a1a1a;
}

.layout {
  display: flex;
  height: 100%;
  width: 100%;
  position: relative;
}

.layout--all .sidebar {
  width: 380px;
}

.sidebar {
  width: 380px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-right: 1px solid #e2e2e2;
  box-sizing: border-box;
  height: 100%;
  overflow: hidden;
}

.sidebar-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.sidebar-map {
  flex: 1;
  position: relative;
  min-height: 0;
  border-top: 1px solid #ececec;
}

.main-content {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  min-height: 0;
}

.title {
  margin: 0;
  padding: 16px;
  font-size: 18px;
  font-weight: 600;
  border-bottom: 1px solid #ececec;
  background: #fafafa;
}

.trip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 16px;
  border-bottom: 1px solid #e2e2e2;
  background: #fafafa;
  height: 56px;
}

.trip-header-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.trip-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #888;
  font-weight: 600;
}

.trip-name {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trip-name.muted {
  color: #888;
  font-weight: 500;
}

.trip-switch-btn {
  background: #ffffff;
  border: 1px solid #d4d4d4;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12px;
  color: #333;
  cursor: pointer;
  flex-shrink: 0;
}

.trip-switch-btn:hover {
  background: #f0f0f0;
}

.date-fields {
  display: flex;
  flex-direction: row;
  gap: 10px;
  padding: 16px;
  border-bottom: 1px solid #ececec;
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

.field input[type='date'] {
  padding: 6px 8px;
  font-size: 13px;
  border: 1px solid #d4d4d4;
  border-radius: 6px;
  background: #ffffff;
  color: #1a1a1a;
}

.field input[type='date']:focus {
  outline: none;
  border-color: #2b7fff;
  box-shadow: 0 0 0 2px rgba(43, 127, 255, 0.15);
}

.error {
  margin: 0;
  padding: 8px 16px;
  font-size: 12px;
  color: #b42318;
  background: #fef3f2;
  border-bottom: 1px solid #fecdca;
}

.sidebar-calendar {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.view-toggle {
  display: flex;
  gap: 0;
  padding: 8px 12px;
  border-bottom: 1px solid #ececec;
  background: #fafafa;
}

.view-btn {
  flex: 1;
  background: #ffffff;
  border: 1px solid #d4d4d4;
  padding: 6px 10px;
  font-size: 12px;
  color: #333;
  cursor: pointer;
}

.view-btn:first-child {
  border-radius: 6px 0 0 6px;
  border-right: 0;
}

.view-btn:last-child {
  border-radius: 0 6px 6px 0;
}

.view-btn.active {
  background: #2b7fff;
  color: #ffffff;
  border-color: #2b7fff;
}

.view-btn:not(.active):hover {
  background: #f0f0f0;
}

.map-pane {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  transition: margin-right 0.2s ease;
}

.map-pane.with-sheet {
  margin-right: 360px;
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
</style>
