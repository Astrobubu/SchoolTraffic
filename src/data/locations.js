// GEMS Jumeirah Primary School - exact coordinates
// Format: [longitude, latitude] for GeoJSON/Mapbox

export const SCHOOL = {
  name: 'GEMS Jumeirah Primary School',
  coordinates: [55.238788, 25.175912],
  gates: [
    { name: 'Main Gate', coordinates: [55.238788, 25.175912] }
  ]
};

// SafePod locations - positioned on nearby roads ~300m from school
export const PODS = [
  { id: 1, name: 'Pod North', coordinates: [55.2385, 25.1790], color: [0, 212, 170] },
  { id: 2, name: 'Pod East', coordinates: [55.2420, 25.1760], color: [0, 212, 170] },
  { id: 3, name: 'Pod South', coordinates: [55.2380, 25.1730], color: [0, 212, 170] },
  { id: 4, name: 'Pod West', coordinates: [55.2355, 25.1755], color: [0, 212, 170] },
  { id: 5, name: 'Pod Northwest', coordinates: [55.2360, 25.1780], color: [0, 212, 170] }
];

// Traffic origins - WEIGHTED BY REALISTIC SOURCES
// Highways = major source (Sheikh Zayed Road, Al Wasl Road)
// Local streets = minor source
export const ORIGINS = [
  // HIGHWAYS - 70% of traffic
  { id: 'szr_north', name: 'Sheikh Zayed Road (North)', coordinates: [55.2550, 25.1850], weight: 0.25, type: 'highway' },
  { id: 'szr_south', name: 'Sheikh Zayed Road (South)', coordinates: [55.2550, 25.1680], weight: 0.20, type: 'highway' },
  { id: 'alwasl_north', name: 'Al Wasl Road (North)', coordinates: [55.2350, 25.1880], weight: 0.15, type: 'highway' },
  { id: 'alwasl_south', name: 'Al Wasl Road (South)', coordinates: [55.2340, 25.1680], weight: 0.10, type: 'highway' },

  // LOCAL ROADS - 25% of traffic (around the block, not inside)
  { id: 'local_east', name: 'Local East', coordinates: [55.2480, 25.1760], weight: 0.10, type: 'local' },
  { id: 'local_west', name: 'Local West', coordinates: [55.2300, 25.1760], weight: 0.08, type: 'local' },
  { id: 'local_north', name: 'Local North', coordinates: [55.2390, 25.1830], weight: 0.07, type: 'local' },

  // INSIDE BLOCK - 5% of traffic (residents)
  { id: 'resident', name: 'Local Resident', coordinates: [55.2400, 25.1780], weight: 0.05, type: 'resident' }
];

// Pod assignments based on approach direction
export const POD_ASSIGNMENTS = {
  'szr_north': PODS[1],     // Pod East - catches SZR north traffic
  'szr_south': PODS[2],     // Pod South - catches SZR south traffic
  'alwasl_north': PODS[0],  // Pod North - catches Al Wasl north
  'alwasl_south': PODS[3],  // Pod West - catches Al Wasl south
  'local_east': PODS[1],    // Pod East
  'local_west': PODS[3],    // Pod West
  'local_north': PODS[4],   // Pod Northwest
  'resident': PODS[4]       // Pod Northwest (closest)
};

// Exit points (where cars go after drop-off)
export const EXITS = [
  { id: 'exit_szr_north', coordinates: [55.2560, 25.1870] },
  { id: 'exit_szr_south', coordinates: [55.2560, 25.1660] },
  { id: 'exit_alwasl', coordinates: [55.2330, 25.1700] },
  { id: 'exit_local', coordinates: [55.2450, 25.1800] }
];

// Map view settings
export const MAP_CENTER = [55.238788, 25.175912];
export const MAP_ZOOM = 15.5;
export const MAP_PITCH = 45;
export const MAP_BEARING = -15;

// Mapbox Directions API helper
export async function getRoute(origin, destination, accessToken) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?geometries=geojson&access_token=${accessToken}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.routes && data.routes[0]) {
      return {
        path: data.routes[0].geometry.coordinates,
        duration: data.routes[0].duration, // seconds
        distance: data.routes[0].distance  // meters
      };
    }
  } catch (error) {
    console.error('Failed to fetch route:', error);
  }

  // Fallback: straight line with estimated duration
  const dx = destination[0] - origin[0];
  const dy = destination[1] - origin[1];
  const dist = Math.sqrt(dx*dx + dy*dy) * 111000; // rough meters
  return {
    path: [origin, destination],
    duration: dist / 8, // ~30 km/h
    distance: dist
  };
}

// Fetch all routes needed for simulation
export async function fetchAllRoutes(accessToken) {
  console.log('Fetching real road routes from Mapbox Directions API...');
  console.log('(This respects one-way streets, turn restrictions, etc.)');

  const routesToSchool = {};
  const routesFromSchool = {};
  const routesToPods = {};
  const routesFromPods = {};
  const shuttleRoutes = [];

  // 1. Routes TO school (before scenario - arrival)
  for (const origin of ORIGINS) {
    const route = await getRoute(origin.coordinates, SCHOOL.coordinates, accessToken);
    routesToSchool[origin.id] = {
      origin: origin,
      ...route,
      destination: SCHOOL
    };
    await delay(80);
  }

  // 2. Routes FROM school to exits (before scenario - departure)
  for (const exit of EXITS) {
    const route = await getRoute(SCHOOL.coordinates, exit.coordinates, accessToken);
    routesFromSchool[exit.id] = {
      ...route,
      destination: exit
    };
    await delay(80);
  }

  // 3. Routes TO pods (after scenario - arrival)
  for (const origin of ORIGINS) {
    const pod = POD_ASSIGNMENTS[origin.id];
    const route = await getRoute(origin.coordinates, pod.coordinates, accessToken);
    routesToPods[origin.id] = {
      origin: origin,
      ...route,
      destination: pod
    };
    await delay(80);
  }

  // 4. Routes FROM pods to exits (after scenario - departure)
  for (const pod of PODS) {
    const nearestExit = EXITS[pod.id % EXITS.length];
    const route = await getRoute(pod.coordinates, nearestExit.coordinates, accessToken);
    routesFromPods[pod.id] = {
      ...route,
      destination: nearestExit
    };
    await delay(80);
  }

  // 5. Shuttle routes: Pod → School (minibuses in after scenario)
  for (const pod of PODS) {
    const route = await getRoute(pod.coordinates, SCHOOL.coordinates, accessToken);
    shuttleRoutes.push({
      pod: pod,
      ...route,
      destination: SCHOOL
    });
    await delay(80);
  }

  console.log('All routes fetched successfully!');

  return {
    routesToSchool,
    routesFromSchool,
    routesToPods,
    routesFromPods,
    shuttleRoutes
  };
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
