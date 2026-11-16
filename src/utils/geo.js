import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform } from 'react-native';

/** Calculates straight-line distance in km between two lat/lng points */
export function calcDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function openExternalMap(lat, lng, label = 'Location') {
  const encoded = encodeURIComponent(label);
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?ll=${lat},${lng}&q=${encoded}`
      : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  Linking.openURL(url).catch(() => {});
}

const PARANAQUE_LANDMARKS = [
  { lat: 14.4997, lng: 120.9949, name: 'Col. E. de Leon St. (CSN Center), Brgy. Sto. Niño, Parañaque City' },
  { lat: 14.4991, lng: 120.9923, name: 'Quirino Ave (Ospital ng Parañaque), Brgy. La Huerta, Parañaque City' },
  { lat: 14.4793, lng: 121.0198, name: 'Parañaque City Hall Compound, San Antonio Valley 1, Parañaque City' },
  { lat: 14.4780, lng: 121.0085, name: 'Silverio Compound, Sucat Rd, Brgy. San Isidro, Parañaque City' },
  { lat: 14.4705, lng: 121.0130, name: 'Dr. F. C. Santos Compound, Dr. A. Santos Ave, Brgy. San Isidro, Parañaque City' },
  { lat: 14.4682, lng: 121.0178, name: 'Greenheights Subdivision, Brgy. San Isidro, Parañaque City' },
  { lat: 14.4735, lng: 121.0140, name: 'Fortunata Village, Brgy. San Isidro, Parañaque City' },
  { lat: 14.4532, lng: 121.0189, name: 'Aguirre Ave, Brgy. BF Homes, Parañaque City' },
  { lat: 14.4826, lng: 121.0264, name: 'San Antonio Valley 1, Brgy. San Antonio, Parañaque City' },
  { lat: 14.4889, lng: 121.0381, name: 'Doña Soledad Ave (Better Living), Brgy. Don Bosco, Parañaque City' },
  { lat: 14.4981, lng: 121.0125, name: 'Armstrong Ave, Brgy. Moonwalk, Parañaque City' },
  { lat: 14.5312, lng: 120.9934, name: 'Redemptorist Rd, Brgy. Baclaran, Parañaque City' },
  { lat: 14.4756, lng: 120.9928, name: 'Evacom, Brgy. San Dionisio, Parañaque City' },
  { lat: 14.5150, lng: 120.9961, name: 'Quirino Ave, Brgy. Tambo, Parañaque City' },
  { lat: 14.5052, lng: 121.0028, name: 'Ninoy Aquino Ave, Brgy. Santo Niño, Parañaque City' },
  { lat: 14.4921, lng: 121.0412, name: 'Sun Valley Drive, Brgy. Sun Valley, Parañaque City' },
  { lat: 14.4691, lng: 121.0392, name: 'Marcelo Ave, Brgy. Marcelo Green, Parañaque City' },
  { lat: 14.5098, lng: 121.0268, name: 'West Service Rd, Brgy. Merville, Parañaque City' },
  { lat: 14.5022, lng: 120.9892, name: 'Quirino Ave, Brgy. Don Galo, Parañaque City' },
  { lat: 14.4947, lng: 120.9881, name: 'Kabihasnan Rd, Brgy. La Huerta, Parañaque City' },
  { lat: 14.5208, lng: 121.0003, name: 'Ninoy Aquino Ave, Brgy. Vitalez, Parañaque City' },
  { lat: 14.4503, lng: 121.0478, name: 'Sucat Interchange, Parañaque City' },
];

const geocodeCache = new Map();

/**
 * Synchronously resolves a lat/lng pair to the closest recognizable Parañaque street/barangay name.
 */
export function resolveParanaqueLocationName(lat, lng) {
  if (lat == null || lng == null || isNaN(Number(lat)) || isNaN(Number(lng))) {
    return 'Parañaque City';
  }
  const nLat = Number(lat);
  const nLng = Number(lng);
  let best = PARANAQUE_LANDMARKS[2];
  let bestDist = Infinity;

  for (const loc of PARANAQUE_LANDMARKS) {
    const d = calcDistanceKm(nLat, nLng, loc.lat, loc.lng);
    if (d != null && d < bestDist) {
      bestDist = d;
      best = loc;
    }
  }

  return best ? best.name : 'Parañaque City';
}

/**
 * Reverse geocodes coordinates using OpenStreetMap Nominatim with a fast Parañaque fallback.
 */
export async function reverseGeocodeOsm(lat, lng) {
  if (lat == null || lng == null || isNaN(Number(lat)) || isNaN(Number(lng))) {
    return 'Parañaque City';
  }
  const nLat = Number(lat);
  const nLng = Number(lng);
  const cacheKey = `${nLat.toFixed(4)},${nLng.toFixed(4)}`;

  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  const fallback = resolveParanaqueLocationName(nLat, nLng);

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(nLat)}&lon=${encodeURIComponent(nLng)}&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ParanaqueCSNMobile/1.0',
      },
      ...(controller ? { signal: controller.signal } : {}),
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = (data && data.address) || {};
      const street = addr.road || addr.pedestrian || addr.residential || addr.amenity || null;
      const area = addr.neighbourhood || addr.suburb || addr.quarter || addr.village || null;
      const city = addr.city || addr.town || addr.municipality || 'Parañaque City';

      const parts = [];
      if (street) parts.push(street);
      if (area && area !== street) {
        parts.push(area.toLowerCase().includes('brgy') || area.toLowerCase().includes('barangay') ? area : `Brgy. ${area}`);
      }
      parts.push(city);

      const formatted = parts.length >= 2 ? Array.from(new Set(parts)).join(', ') : (data.display_name ? data.display_name.split(',').slice(0, 3).join(',').trim() : fallback);
      if (formatted) {
        geocodeCache.set(cacheKey, formatted);
        return formatted;
      }
    }
  } catch {
    // Fallback to nearest Parañaque landmark/barangay
  }

  geocodeCache.set(cacheKey, fallback);
  return fallback;
}

/**
 * React hook returning a user-friendly specific location name for coordinates without flashing raw lat/lng.
 */
export function useLocationName(lat, lng, explicitLocation = null) {
  const cleanExplicit =
    explicitLocation && !String(explicitLocation).startsWith('Live GPS')
      ? String(explicitLocation)
      : null;

  const coordKey =
    lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng))
      ? `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`
      : null;

  const fallback = useMemo(
    () => cleanExplicit || resolveParanaqueLocationName(lat, lng),
    [cleanExplicit, lat, lng]
  );

  const [resolved, setResolved] = useState(null);

  useEffect(() => {
    if (cleanExplicit || !coordKey) return undefined;
    let active = true;
    reverseGeocodeOsm(lat, lng).then((name) => {
      if (active && name) {
        setResolved({ key: coordKey, name });
      }
    });
    return () => {
      active = false;
    };
  }, [cleanExplicit, coordKey, lat, lng]);

  if (cleanExplicit) return cleanExplicit;
  if (resolved && resolved.key === coordKey) return resolved.name;
  return fallback;
}
