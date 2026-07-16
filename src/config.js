// Gargantua — central tuning constants and Firebase config.
export const CONFIG = {
  simHz: 60,
  maxPixelRatio: 1.5,
  fov: 70,

  player: {
    radius: 0.45,
    maxSpeed: 4.0,
    rcsAccel: 0.8,
    pushOffSpeed: 2.2,
    grabRange: 3.0,
    grabEase: 0.25,
    tetherMin: 0.6,
    tetherMax: 1.6,
    tetherDefault: 1.0,
    reelSpeed: 0.7,
    swingSpeed: 1.2,
    rollSpeed: Math.PI / 4,
    lookSensitivity: 0.0022,
    comfortAssist: true,
    comfortRate: 0.5,
    hardImpactSpeed: 3.0,
    restitution: 0.1,
    warnDistance: 120,
    returnDistance: 200,
    returnHoldSec: 2.0,
  },

  suit: {
    o2DrainPerSec: 100 / (15 * 60),
    o2ThrustFactor: 1.6,
    o2LowSuitFactor: 1.5,
    o2RefillPerSec: 20,
    o2TowDelaySec: 20,
    o2TowRefillTo: 30,
    powerRcsPerSec: 1.2,
    powerLampPerSec: 0.25,
    powerSolarPerSec: 0.25,
    powerRefillPerSec: 20,
    suitImpactDamage: 2,
    suitFloor: 10,
    suitLowThreshold: 30,
    suitRepairPerSec: 10,
    tempMin: -60,
    tempMax: 90,
    lowBarThreshold: 20,
    interactRange: 3.5,
  },

  net: {
    publishHz: 10,
    interpDelayMs: 150,
    staleMs: 90000,
    heartbeatHiddenMs: 25000,
    maxPlayers: 4,
  },

  world: {
    grid: 4,
    cellSize: 8,
    bhDistance: 8000,
    bhSize: 11000,
    starCount: 4000,
    starRadius: 16000,
  },
};

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCmXyZDf92WsYTnEGYyUMzuzf-ox0Cx47c",
  authDomain: "gargantua-mp.firebaseapp.com",
  databaseURL: "https://gargantua-mp-default-rtdb.firebaseio.com",
  projectId: "gargantua-mp",
  appId: "1:696312046862:web:aa2fe5d0c4aad2a102e35f",
};

export const SPAWN_SLOTS = [
  [0, 3.2, 6], [4, 3.2, -6], [-4, 3.2, 6], [8, 3.2, -6],
];

export const PLAYER_COLORS = [0xffffff, 0xffa94d, 0x74c0fc, 0x69db7c];
