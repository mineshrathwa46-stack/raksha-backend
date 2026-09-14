const DEFAULT_OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

function routeBounds(geometry) {
  const coordinates = geometry.filter((point) => Array.isArray(point) && point.length >= 2);
  if (coordinates.length === 0) return null;
  const longitudes = coordinates.map((point) => Number(point[0]));
  const latitudes = coordinates.map((point) => Number(point[1]));
  return {
    south: Math.min(...latitudes),
    west: Math.min(...longitudes),
    north: Math.max(...latitudes),
    east: Math.max(...longitudes)
  };
}

async function queryRouteContext(geometry, { fetchImpl = fetch } = {}) {
  const bounds = routeBounds(geometry);
  if (!bounds) return { available: false, source: null, timestamp: null, facilities: [] };

  const overpassUrl = process.env.OVERPASS_URL || DEFAULT_OVERPASS_URL;
  const query = `[out:json][timeout:20];(nwr[amenity~"police|hospital|clinic|pharmacy|fire_station|school|university|bus_station|fuel"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});nwr[shop](${bounds.south},${bounds.west},${bounds.north},${bounds.east}););out center tags;`;
  let response;
  try {
    response = await fetchImpl(overpassUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(20000)
    });
  } catch (_) {
    return { available: false, source: 'OpenStreetMap Overpass', timestamp: null, facilities: [] };
  }

  if (!response.ok) return { available: false, source: 'OpenStreetMap Overpass', timestamp: null, facilities: [] };
  try {
    const payload = await response.json();
    const elements = Array.isArray(payload.elements) ? payload.elements : [];
    return {
      available: true,
      source: 'OpenStreetMap Overpass',
      timestamp: new Date().toISOString(),
      facilities: elements.map((element) => ({
        type: element.tags?.amenity || (element.tags?.shop ? 'shop' : 'unknown'),
        latitude: Number(element.lat ?? element.center?.lat),
        longitude: Number(element.lon ?? element.center?.lon)
      })).filter((facility) => Number.isFinite(facility.latitude) && Number.isFinite(facility.longitude))
    };
  } catch (_) {
    return { available: false, source: 'OpenStreetMap Overpass', timestamp: null, facilities: [] };
  }
}

module.exports = { queryRouteContext, routeBounds };
