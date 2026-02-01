import mapboxgl from 'mapbox-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { TripsLayer } from '@deck.gl/geo-layers';
import { ScatterplotLayer } from '@deck.gl/layers';

import {
  SCHOOL,
  PODS,
  MAP_CENTER,
  MAP_ZOOM,
  MAP_PITCH,
  MAP_BEARING,
  fetchAllRoutes
} from './data/locations.js';

import {
  generateBeforeTrips,
  generateAfterTrips,
  formatTime,
  calculateStats,
  SIM_START_TIME,
  SIM_END_TIME,
  PEAK_START,
  PEAK_END
} from './data/trips.js';

// Mapbox access token
const MAPBOX_TOKEN = 'pk.eyJ1IjoiZGVhdGhoYW1vb2QxIiwiYSI6ImNtbDF5aXo0cTA5cTIzZ3NkcDVqaGcwaTQifQ.yzJJKKvc0GrMIiTn_P8zdA';
mapboxgl.accessToken = MAPBOX_TOKEN;

// Application state
const state = {
  mode: 'before',
  isPlaying: false,
  currentTime: PEAK_START, // Start at 7:30 AM
  speed: 5,
  routes: null,
  trips: { before: [], after: [] },
  animationFrame: null,
  lastFrameTime: 0
};

// DOM elements
const elements = {
  loading: document.getElementById('loading'),
  loadingText: document.querySelector('.loading-text'),
  playBtn: document.getElementById('playBtn'),
  playIcon: document.getElementById('playIcon'),
  timeDisplay: document.getElementById('timeDisplay'),
  progressFill: document.getElementById('progressFill'),
  progressBar: document.getElementById('progressBar'),
  statsMode: document.getElementById('statsMode'),
  activeVehicles: document.getElementById('activeVehicles'),
  peakQueue: document.getElementById('peakQueue'),
  avgWaitTime: document.getElementById('avgWaitTime'),
  congestion: document.getElementById('congestion')
};

let map;
let deckOverlay;

async function initApp() {
  try {
    elements.loadingText.textContent = 'Loading map...';
    await initMap();

    elements.loadingText.textContent = 'Fetching road routes from Mapbox...';
    state.routes = await fetchAllRoutes(MAPBOX_TOKEN);

    console.log('Routes fetched:', state.routes);
    console.log('To school:', Object.keys(state.routes.routesToSchool || {}).length);
    console.log('From school:', Object.keys(state.routes.routesFromSchool || {}).length);

    elements.loadingText.textContent = 'Generating traffic simulation...';
    generateTrips();

    console.log('Trips generated - Before:', state.trips.before.length, 'After:', state.trips.after.length);

    updateLayers();
    hideLoading();
    updateTimeDisplay();

    console.log('=== SafePod Traffic Simulation ===');
    console.log('Algorithm: Mapbox Directions API (real roads)');
    console.log('Press SPACE to play/pause');

  } catch (error) {
    console.error('Init failed:', error);
    elements.loadingText.textContent = 'Error: ' + error.message;
  }
}

function initMap() {
  return new Promise((resolve) => {
    map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/dark-v11',
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      pitch: MAP_PITCH,
      bearing: MAP_BEARING,
      antialias: true
    });

    // Create deck.gl overlay
    deckOverlay = new MapboxOverlay({
      interleaved: true,
      layers: []
    });

    map.on('load', () => {
      // Add deck.gl overlay to map
      map.addControl(deckOverlay);

      // 3D buildings
      const layers = map.getStyle().layers;
      const labelLayerId = layers.find(
        (layer) => layer.type === 'symbol' && layer.layout['text-field']
      )?.id;

      map.addLayer({
        id: '3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': '#1a1a2e',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.6
        }
      }, labelLayerId);

      resolve();
    });
  });
}

function generateTrips() {
  state.trips.before = generateBeforeTrips(state.routes, 350);
  state.trips.after = generateAfterTrips(state.routes, 350);
}

function hideLoading() {
  elements.loading.classList.add('hidden');
  setTimeout(() => elements.loading.style.display = 'none', 500);
}

function updateLayers() {
  const trips = state.mode === 'before' ? state.trips.before : state.trips.after;
  const isBefore = state.mode === 'before';
  const isPeakTime = state.currentTime >= PEAK_START && state.currentTime <= PEAK_END;

  // Trips layer - animated vehicle paths
  const tripsLayer = new TripsLayer({
    id: 'trips',
    data: trips,
    getPath: d => d.path,
    getTimestamps: d => d.timestamps,
    getColor: d => d.color,
    getWidth: d => d.isShuttle ? 8 : 5,
    widthMinPixels: 3,
    widthMaxPixels: 15,
    jointRounded: true,
    capRounded: true,
    trailLength: 300,
    currentTime: state.currentTime,
    opacity: 0.9
  });

  // School marker
  const schoolColor = isBefore
    ? [255, 68, 68, 230]
    : (isPeakTime ? [255, 100, 100, 200] : [100, 255, 150, 230]);

  const schoolLayer = new ScatterplotLayer({
    id: 'school',
    data: [SCHOOL],
    getPosition: d => d.coordinates,
    getFillColor: schoolColor,
    getLineColor: [255, 255, 255],
    getRadius: 60,
    radiusMinPixels: 14,
    radiusMaxPixels: 35,
    stroked: true,
    lineWidthMinPixels: 3
  });

  // Pod markers (only in "after" mode)
  const podLayer = new ScatterplotLayer({
    id: 'pods',
    data: isBefore ? [] : PODS,
    getPosition: d => d.coordinates,
    getFillColor: [0, 212, 170, 230],
    getLineColor: [255, 255, 255],
    getRadius: 45,
    radiusMinPixels: 10,
    radiusMaxPixels: 25,
    stroked: true,
    lineWidthMinPixels: 2
  });

  // Update the overlay
  deckOverlay.setProps({
    layers: [tripsLayer, podLayer, schoolLayer]
  });

  updateStats();
  updateTimeIndicator();
}

function updateStats() {
  const trips = state.mode === 'before' ? state.trips.before : state.trips.after;
  const isBefore = state.mode === 'before';
  const stats = calculateStats(trips, state.currentTime, isBefore);

  // Vehicles currently on roads in the school area
  elements.activeVehicles.textContent = stats.vehiclesOnRoad;

  // Cars queuing at destination (gates or pods)
  elements.peakQueue.innerHTML = `${stats.queueAtDestination}<span class="stat-unit">cars</span>`;

  // Average time spent waiting (in queue, not driving)
  elements.avgWaitTime.innerHTML = `${stats.avgWaitTime}<span class="stat-unit">min</span>`;

  // Road congestion: vehicles vs road capacity
  elements.congestion.innerHTML = `${stats.congestionPercent}<span class="stat-unit">%</span>`;

  // Color coding: red/warning for "before", green/good for "after"
  const valueClass = isBefore ? 'stat-value warning' : 'stat-value highlight';
  elements.peakQueue.className = valueClass;
  elements.avgWaitTime.className = valueClass;
  elements.congestion.className = valueClass;
}

function updateTimeDisplay() {
  elements.timeDisplay.textContent = formatTime(state.currentTime);
  const progress = ((state.currentTime - SIM_START_TIME) / (SIM_END_TIME - SIM_START_TIME)) * 100;
  elements.progressFill.style.width = `${progress}%`;
}

function updateTimeIndicator() {
  const isPeak = state.currentTime >= PEAK_START && state.currentTime <= PEAK_END;
  elements.timeDisplay.style.color = isPeak ? '#ff6666' : '#fff';
}

function animate(timestamp) {
  if (!state.isPlaying) return;

  if (state.lastFrameTime === 0) {
    state.lastFrameTime = timestamp;
  }

  const deltaTime = timestamp - state.lastFrameTime;
  state.lastFrameTime = timestamp;

  state.currentTime += (deltaTime / 1000) * state.speed * 10;

  if (state.currentTime >= SIM_END_TIME) {
    state.currentTime = SIM_START_TIME;
  }

  updateTimeDisplay();
  updateLayers();

  state.animationFrame = requestAnimationFrame(animate);
}

function togglePlay() {
  state.isPlaying = !state.isPlaying;
  elements.playIcon.textContent = state.isPlaying ? '⏸' : '▶';

  if (state.isPlaying) {
    state.lastFrameTime = 0;
    state.animationFrame = requestAnimationFrame(animate);
  } else if (state.animationFrame) {
    cancelAnimationFrame(state.animationFrame);
  }
}

function setMode(mode) {
  state.mode = mode;

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.remove('active', 'after');
    if (btn.dataset.mode === mode) {
      btn.classList.add('active');
      if (mode === 'after') btn.classList.add('after');
    }
  });

  elements.statsMode.textContent = mode === 'before' ? 'Before' : 'SafePod';
  elements.statsMode.className = `stats-mode ${mode}`;

  updateLayers();
}

function setSpeed(speed) {
  state.speed = speed;
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.speed) === speed);
  });
}

function setTimeFromProgress(e) {
  const rect = elements.progressBar.getBoundingClientRect();
  const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  state.currentTime = SIM_START_TIME + (SIM_END_TIME - SIM_START_TIME) * percent;
  updateTimeDisplay();
  updateLayers();
}

function initEventListeners() {
  elements.playBtn.addEventListener('click', togglePlay);

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => setSpeed(parseInt(btn.dataset.speed)));
  });

  elements.progressBar.addEventListener('click', setTimeFromProgress);

  // Mobile legend toggle
  const legendToggle = document.getElementById('legendToggle');
  const legend = document.getElementById('legend');
  if (legendToggle && legend) {
    legendToggle.addEventListener('click', () => {
      legend.classList.toggle('mobile-visible');
    });
    // Close legend when clicking outside
    document.addEventListener('click', (e) => {
      if (!legend.contains(e.target) && e.target !== legendToggle) {
        legend.classList.remove('mobile-visible');
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    }
    if (e.code === 'KeyB') setMode('before');
    if (e.code === 'KeyA') setMode('after');
    if (e.code === 'Digit1') setSpeed(1);
    if (e.code === 'Digit5') setSpeed(5);
    if (e.code === 'Digit0') setSpeed(10);
  });
}

// Start
initEventListeners();
initApp();
