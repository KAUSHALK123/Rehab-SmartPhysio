/**
 * SmartPhysio GLB Movement Calibration Configuration Service
 * Provides structured schema, default ranges, and persistence for Wrist and Finger GLB calibration.
 */

export const WRIST_MOVEMENTS = [
  { 
    id: 'hiMovement', 
    label: 'Hi Movement', 
    description: 'Left ↔ Right hand wave / greeting movement',
    targetBone: 'Circle',
    defaultRanges: {
      x: { min: -35, max: 35 },
      y: { min: -25, max: 25 },
      z: { min: -35, max: 35 }
    }
  },
  { 
    id: 'upDown', 
    label: 'Up / Down Waving', 
    description: 'Up ↕ Down wrist flexion and extension',
    targetBone: 'Circle',
    defaultRanges: {
      x: { min: -45, max: 45 },
      y: { min: -10, max: 10 },
      z: { min: -10, max: 10 }
    }
  },
  { 
    id: 'twist', 
    label: 'Left / Right Twist', 
    description: 'Twist Left ↔ Twist Right forearm/wrist pronation & supination',
    targetBone: 'Circle',
    defaultRanges: {
      x: { min: -5, max: 5 },
      y: { min: -60, max: 60 },
      z: { min: -5, max: 5 }
    }
  }
];

export const FINGER_MOVEMENTS = [
  { 
    id: 'thumb', 
    label: 'Thumb', 
    bone: 'right_thumb',
    defaultRanges: {
      x: { min: -60, max: 10 },
      y: { min: -20, max: 20 },
      z: { min: -15, max: 15 }
    }
  },
  { 
    id: 'index', 
    label: 'Index', 
    bone: 'right_index',
    defaultRanges: {
      x: { min: -85, max: 10 },
      y: { min: -15, max: 15 },
      z: { min: -15, max: 15 }
    }
  },
  { 
    id: 'middle', 
    label: 'Middle', 
    bone: 'right_middle',
    defaultRanges: {
      x: { min: -85, max: 10 },
      y: { min: -15, max: 15 },
      z: { min: -15, max: 15 }
    }
  },
  { 
    id: 'ring', 
    label: 'Ring', 
    bone: 'right_ring',
    defaultRanges: {
      x: { min: -80, max: 10 },
      y: { min: -15, max: 15 },
      z: { min: -15, max: 15 }
    }
  },
  { 
    id: 'little', 
    label: 'Little', 
    bone: 'right_little',
    defaultRanges: {
      x: { min: -75, max: 10 },
      y: { min: -15, max: 15 },
      z: { min: -15, max: 15 }
    }
  }
];

export const ELBOW_MOVEMENTS = [
  { 
    id: 'elbowFlexion', 
    label: 'Elbow Flexion / Extension', 
    description: 'Bending and straightening of the elbow joint',
    targetBone: 'WristArm',
    defaultRanges: {
      x: { min: -110, max: 0 },
      y: { min: -15, max: 15 },
      z: { min: -15, max: 15 }
    }
  }
];

const STORAGE_KEY = 'smartphysio_glb_calibration';

/**
 * Generate initial default calibration object
 */
export const getDefaultCalibration = () => {
  const config = {
    version: 1,
    wrist: {},
    fingers: {},
    elbow: {}
  };

  WRIST_MOVEMENTS.forEach(m => {
    config.wrist[m.id] = {
      targetBone: m.targetBone,
      rotationOrder: 'XYZ',
      x: { ...m.defaultRanges.x },
      y: { ...m.defaultRanges.y },
      z: { ...m.defaultRanges.z },
      approved: false,
      approvedAt: null
    };
  });

  FINGER_MOVEMENTS.forEach(f => {
    config.fingers[f.id] = {
      targetBone: f.bone,
      rotationOrder: 'XYZ',
      x: { ...f.defaultRanges.x },
      y: { ...f.defaultRanges.y },
      z: { ...f.defaultRanges.z },
      approved: false,
      approvedAt: null
    };
  });

  ELBOW_MOVEMENTS.forEach(e => {
    config.elbow[e.id] = {
      targetBone: e.targetBone,
      rotationOrder: 'XYZ',
      x: { ...e.defaultRanges.x },
      y: { ...e.defaultRanges.y },
      z: { ...e.defaultRanges.z },
      approved: false,
      approvedAt: null
    };
  });

  return config;
};

/**
 * Load calibration configuration from localStorage, merged with defaults
 */
export const loadCalibrationConfig = () => {
  const defaults = getDefaultCalibration();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);

    // Deep merge to ensure all movements and axes exist
    const merged = { ...defaults };
    if (parsed.wrist) {
      WRIST_MOVEMENTS.forEach(m => {
        if (parsed.wrist[m.id]) {
          merged.wrist[m.id] = {
            ...defaults.wrist[m.id],
            ...parsed.wrist[m.id],
            x: { ...defaults.wrist[m.id].x, ...(parsed.wrist[m.id].x || {}) },
            y: { ...defaults.wrist[m.id].y, ...(parsed.wrist[m.id].y || {}) },
            z: { ...defaults.wrist[m.id].z, ...(parsed.wrist[m.id].z || {}) },
          };
        }
      });
    }

    if (parsed.fingers) {
      FINGER_MOVEMENTS.forEach(f => {
        if (parsed.fingers[f.id]) {
          merged.fingers[f.id] = {
            ...defaults.fingers[f.id],
            ...parsed.fingers[f.id],
            x: { ...defaults.fingers[f.id].x, ...(parsed.fingers[f.id].x || {}) },
            y: { ...defaults.fingers[f.id].y, ...(parsed.fingers[f.id].y || {}) },
            z: { ...defaults.fingers[f.id].z, ...(parsed.fingers[f.id].z || {}) },
          };
        }
      });
    }

    if (parsed.elbow) {
      ELBOW_MOVEMENTS.forEach(e => {
        if (parsed.elbow[e.id]) {
          merged.elbow[e.id] = {
            ...defaults.elbow[e.id],
            ...parsed.elbow[e.id],
            x: { ...defaults.elbow[e.id].x, ...(parsed.elbow[e.id].x || {}) },
            y: { ...defaults.elbow[e.id].y, ...(parsed.elbow[e.id].y || {}) },
            z: { ...defaults.elbow[e.id].z, ...(parsed.elbow[e.id].z || {}) },
          };
        }
      });
    }

    return merged;
  } catch (err) {
    console.warn('[CalibrationConfig] Failed to parse stored calibration, using defaults', err);
    return defaults;
  }
};

/**
 * Persist calibration configuration to localStorage
 */
export const saveCalibrationConfig = (config) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (err) {
    console.error('[CalibrationConfig] Failed to save calibration to localStorage', err);
    return false;
  }
};
