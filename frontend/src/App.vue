<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const mapContainer = ref(null);
let map = null;

onMounted(() => {
  map = new maplibregl.Map({
    container: mapContainer.value,
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
    center: [0, 0],
    zoom: 2,
    transformRequest: (url, resourceType) => {
      if (resourceType === 'Tile' && url.startsWith('https://tile.openstreetmap.org/')) {
        return { url, headers: { Referer: 'https://tracker.local/' } };
      }
      return { url };
    },
  });

  map.addControl(new maplibregl.NavigationControl());
});

onBeforeUnmount(() => {
  map?.remove();
  map = null;
});
</script>

<template>
  <h2>HIII23456</h2>
  <div ref="mapContainer" class="map"></div>
</template>

<style>
html,
body,
#app {
  margin: 0;
  padding: 0;
  height: 100%;
}

.map {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
}
</style>
