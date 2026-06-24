const ENDPOINT = 'https://nominatim.openstreetmap.org';

const headers = {
  Accept: 'application/json',
};

const shortName = (displayName) =>
  displayName?.split(',').slice(0, 3).join(', ').trim() || '';

export const reverseGeocode = async (lng, lat, { signal } = {}) => {
  const url = new URL(`${ENDPOINT}/reverse`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '0');
  const res = await fetch(url, { headers, signal });
  if (!res.ok) {
    throw new Error(`Reverse geocode failed: ${res.status}`);
  }
  const data = await res.json();
  return {
    name: shortName(data?.display_name) || 'Unnamed location',
    fullName: data?.display_name ?? '',
    lng: Number(data?.lon ?? lng),
    lat: Number(data?.lat ?? lat),
  };
};

export const searchPlaces = async (query, { signal, limit = 6 } = {}) => {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const url = new URL(`${ENDPOINT}/search`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', trimmed);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('addressdetails', '0');
  const res = await fetch(url, { headers, signal });
  if (!res.ok) {
    throw new Error(`Place search failed: ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((item) => ({
    name: shortName(item.display_name) || item.display_name || trimmed,
    fullName: item.display_name ?? '',
    lng: Number(item.lon),
    lat: Number(item.lat),
  }));
};
