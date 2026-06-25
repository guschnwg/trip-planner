import { computed, reactive } from 'vue';

const STYLE_STORAGE_KEY = 'tracker.mapStyle';

export const MAP_STYLES = [
  {
    id: 'osm',
    label: 'OSM Standard',
    build: () => ({
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
    }),
  },
  {
    id: 'opentopomap',
    label: 'OpenTopoMap',
    build: () => ({
      version: 8,
      sources: {
        otm: {
          type: 'raster',
          tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution:
            'Map data: &copy; OpenStreetMap, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
        },
      },
      layers: [
        {
          id: 'otm',
          type: 'raster',
          source: 'otm',
        },
      ],
    }),
  },
  {
    id: 'positron',
    label: 'Carto Positron',
    build: () => ({
      version: 8,
      sources: {
        positron: {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution:
            '&copy; OpenStreetMap contributors &copy; CARTO',
        },
      },
      layers: [
        {
          id: 'positron',
          type: 'raster',
          source: 'positron',
        },
      ],
    }),
  },
  {
    id: 'darkmatter',
    label: 'Carto Dark Matter',
    build: () => ({
      version: 8,
      sources: {
        darkmatter: {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution:
            '&copy; OpenStreetMap contributors &copy; CARTO',
        },
      },
      layers: [
        {
          id: 'darkmatter',
          type: 'raster',
          source: 'darkmatter',
        },
      ],
    }),
  },
  {
    id: 'stamen-terrain',
    label: 'Stamen Terrain',
    build: () => ({
      version: 8,
      sources: {
        terrain: {
          type: 'raster',
          tiles: [
            'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution:
            'Map tiles by Stamen Design, CC BY 3.0 | Map data &copy; OpenStreetMap contributors',
        },
      },
      layers: [
        {
          id: 'terrain',
          type: 'raster',
          source: 'terrain',
        },
      ],
    }),
  },
];

const STYLES_BY_ID = new Map(MAP_STYLES.map((s) => [s.id, s]));

const loadStoredStyleId = () => {
  if (typeof localStorage === 'undefined') return MAP_STYLES[0].id;
  try {
    const stored = localStorage.getItem(STYLE_STORAGE_KEY);
    if (stored && STYLES_BY_ID.has(stored)) return stored;
  } catch {
    // ignore
  }
  return MAP_STYLES[0].id;
};

const state = reactive({
  map: null,
  picking: null, // { field, resolve, reject }
  storedMarkers: [], // committed event markers
  previewMarkers: [], // { id, lng, lat, label, color, variant: 'preview' }
  hoverMarkers: [], // { id, lng, lat, label, color, variant: 'hover' }
  sheetOpen: false,
  mapStyleId: loadStoredStyleId(),
});

export const storedMarkers = state.storedMarkers;
export const previewMarkers = state.previewMarkers;
export const hoverMarkers = state.hoverMarkers;
export const markers = computed(() => {
  if (state.sheetOpen) {
    return [...state.storedMarkers, ...state.previewMarkers];
  }
  return [...state.storedMarkers, ...state.hoverMarkers];
});

export const setMap = (mapInstance) => {
  state.map = mapInstance;
};

export const getMap = () => state.map;

export const getMapStyleId = () => state.mapStyleId;

export const getMapStyle = () => {
  const def = STYLES_BY_ID.get(state.mapStyleId) || MAP_STYLES[0];
  return def.build();
};

export const setMapStyle = (styleId) => {
  if (!STYLES_BY_ID.has(styleId)) return;
  if (state.mapStyleId === styleId) return;
  state.mapStyleId = styleId;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STYLE_STORAGE_KEY, styleId);
    } catch {
      // ignore
    }
  }
};

export const startPicking = (field) => {
  return new Promise((resolve, reject) => {
    if (state.picking) {
      state.picking.reject(new Error('Another pick is in progress'));
      state.picking = null;
    }
    state.picking = { field, resolve, reject };
  });
};

export const cancelPicking = () => {
  if (!state.picking) return;
  state.picking.reject(new Error('Pick cancelled'));
  state.picking = null;
};

export const resolvePicking = (result) => {
  if (!state.picking) return;
  state.picking.resolve(result);
  state.picking = null;
};

export const isPicking = (field) => {
  if (!state.picking) return false;
  if (!field) return true;
  return state.picking.field === field;
};

export const setSheetOpen = (isOpen) => {
  state.sheetOpen = isOpen;
  if (isOpen) {
    state.hoverMarkers = [];
  } else {
    state.previewMarkers = [];
  }
};

export const setStoredMarkers = (markers) => {
  state.storedMarkers = markers;
};

export const appendStoredMarker = (marker) => {
  state.storedMarkers = [...state.storedMarkers, marker];
};

export const removeStoredMarkersFor = (event) => {
  state.storedMarkers = state.storedMarkers.filter(
    (m) => m.id !== event.id && m.id !== `${event.id}-from` && m.id !== `${event.id}-to`,
  );
};

export const clearStoredMarkers = () => {
  state.storedMarkers = [];
};

export const setPreviewMarkers = (markers) => {
  state.previewMarkers = markers;
};

export const setHoverMarkers = (markers) => {
  state.hoverMarkers = markers;
};

export const clearPreviewMarkers = () => {
  state.previewMarkers = [];
};

export const clearHoverMarkers = () => {
  state.hoverMarkers = [];
};
