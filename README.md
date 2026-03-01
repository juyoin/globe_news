# Digital Twin Globe Prototype

A browser-based 3D Earth prototype with a unified input model for mouse, touch, and trackpad-style gestures.

## Features

- Photorealistic Earth rendering with satellite textures, cloud layer, atmosphere glow, and star field.
- UTC-driven sun and moon lighting approximation.
- Unified input mapping:
  - Pointer drag / 1-finger drag: rotate with kinetic inertia.
  - 2-finger pinch: logarithmic zoom.
  - 2-finger vertical slide: camera pitch/tilt adjustment.
  - 2-finger twist: compass-style yaw rotation.
  - Trackpad wheel gestures: zoom, `Shift+wheel` for compass rotation, `Alt+wheel` for pitch.
- LOD-style texture swap between low and high satellite maps based on altitude.
- Dynamic labels that fade by altitude to mimic continent/city hierarchy.

## Run

```bash
python3 -m http.server 4173
```

Open <http://localhost:4173>.
