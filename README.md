# ⛏️ VoxelCraft - Advanced Three.js Voxel Engine

VoxelCraft is a high-performance, browser-based Minecraft clone built with **Three.js**. It features procedurally generated terrain, a robust physics engine, and optimized voxel rendering.

## 🚀 Key Technical Features

### 🌍 Procedural World Generation
*   **Fractal Brownian Motion (FBM):** Uses multiple octaves of Simplex Noise to create realistic, layered terrain with rolling hills, mountains, and plains.
*   **3D Cave System:** Optimized 3D density noise for underground cave generation.
*   **Biome Variety:** Height-dependent block selection (Sand at water level, Snow on peaks, Grass in valleys).
*   **Infinite-like Chunking:** Dynamic loading/unloading of 16x48x16 chunks based on player proximity to maintain high FPS.

### ⚡ Performance Optimizations
*   **Face Culling:** The engine only generates geometry for voxel faces that are actually visible (neighboring transparent/air blocks), reducing the polygon count by ~90% compared to rendering full cubes.
*   **Texture Atlasing:** All block textures are packed into a single atlas, allowing the entire world to be rendered in a single draw call per chunk.
*   **Coarse Cave Noise:** Underground cave generation skips vertical layers during density checks to reduce expensive 3D noise calculations.
*   **Instanced Rendering:** Collectible items use `THREE.InstancedMesh`, allowing hundreds of spinning items to be rendered with virtually zero performance impact.

### 🕹️ Physics & Movement
*   **Fixed Timestep Accumulator:** The physics engine runs at a consistent 50Hz regardless of the rendering framerate. This eliminates "rubber-banding" and ensures movement is identical across different hardware.
*   **Sub-Step Collision Detection:** Player movement is broken into smaller steps per frame to prevent "tunneling" (clipping through walls at high speeds).
*   **Buoyancy & Water Physics:** Custom physics for swimming, including upward thrust and movement damping.

### 🧟 Entity AI & Gameplay
*   **State-Machine AI:** Entities (Zombies, Cows) use a finite state machine (Idle, Wander, Chase, Flee, Knockback).
*   **Raycast Line-of-Sight:** Zombies use raycasting to detect the player before chasing, preventing them from "seeing" through walls.
*   **Dynamic Day/Night Cycle:** Synchronized lighting transitions (Sun position, Fog color, Ambient intensity, and Sky shading) based on a global game timer.

### 🎨 Visuals & UI
*   **Custom Particle System:** Procedural particle effects for explosions and block breaking.
*   **Interactive Hotbar & Inventory:** Full drag-and-drop inventory system with persistent player state.
*   **Responsive UI:** Fully CSS-animated health bars, pickup notifications, and death screens.

## 🛠️ Built With
*   [Three.js](https://threejs.org/) - 3D Engine
*   [SimplexNoise.js](https://github.com/jwagner/simplex-noise.js) - Procedural Generation
*   Vanilla JavaScript (ES6+)
*   Custom CSS for the HUD/UI
