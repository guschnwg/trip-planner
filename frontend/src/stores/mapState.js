import { computed, reactive } from 'vue';

const state = reactive({
  map: null,
  picking: null, // { field, resolve, reject }
  storedMarkers: [], // committed event markers
  previewMarkers: [], // { id, lng, lat, label, color, variant: 'preview' }
  hoverMarkers: [], // { id, lng, lat, label, color, variant: 'hover' }
  sheetOpen: false,
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
