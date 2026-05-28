// ================================================================
// WORLD CONFIG
// ================================================================
const CHUNK_SIZE = 16, WORLD_HEIGHT = 48, RENDER_DIST = 3, WATER_LEVEL = 18;

// ================================================================
// WORLD GLOBALS
// ================================================================
let chunks = {}, chunkMeshes = {};
let waterMeshes = [];
let transparentMeshes = [];
let chunkGenQueue = [];

// Chunk rebuild batching
let dirtyChunks = new Set();
let dirtyFlushScheduled = false;

// Natural water = terrain ocean/lakes/showcase pool.
// Placed water = player placed water block in Creative/Survival.
// Both use BLOCK.WATER, but this set decides how water is rendered.
let naturalWaterCells = new Set();

function waterCellKey(wx, wy, wz) {
    return wx + ',' + wy + ',' + wz;
}

function markNaturalWater(wx, wy, wz) {
    naturalWaterCells.add(waterCellKey(wx, wy, wz));
}

function unmarkNaturalWater(wx, wy, wz) {
    naturalWaterCells.delete(waterCellKey(wx, wy, wz));
}

function isNaturalWaterCell(wx, wy, wz) {
    return naturalWaterCells.has(waterCellKey(wx, wy, wz));
}

function clearNaturalWaterInChunk(cx, cz) {
    const minX = cx * CHUNK_SIZE;
    const maxX = minX + CHUNK_SIZE - 1;
    const minZ = cz * CHUNK_SIZE;
    const maxZ = minZ + CHUNK_SIZE - 1;

    for (const key of Array.from(naturalWaterCells)) {
        const parts = key.split(',').map(Number);
        const wx = parts[0];
        const wz = parts[2];

        if (wx >= minX && wx <= maxX && wz >= minZ && wz <= maxZ) {
            naturalWaterCells.delete(key);
        }
    }
}

// ================================================================
// TERRAIN
// ================================================================
function fbm(x, z, octaves, lac, pers) {
    let v = 0, a = 1, f = 1, m = 0;

    for (let i = 0; i < octaves; i++) {
        v += noise.noise2D(x * f, z * f) * a;
        m += a;
        a *= pers;
        f *= lac;
    }

    return v / m;
}

function getTerrainHeight(wx, wz) {
    let h = fbm(wx * 0.002, wz * 0.002, 4, 2.0, 0.5) * 30;
    h += noise2.noise2D(wx * 0.01, wz * 0.01) * 8;
    h += noise2.noise2D(wx * 0.05, wz * 0.05) * 3;

    const ridge = 1 - Math.abs(noise3.noise2D(wx * 0.006, wz * 0.006));
    const rv = ridge * ridge;

    if (rv > 0.35) h += (rv - 0.35) * 40;

    return Math.floor(h + 24);
}

function shouldPlaceTree(wx, wz, h) {
    if (h <= WATER_LEVEL + 1 || h > 36) return false;
    return noise3.noise2D(wx * 0.5, wz * 0.5) > 0.75;
}

function generateChunk(cx, cz) {
    const key = cx + ',' + cz;
    if (chunks[key]) return;

    const data = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);

    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            const wx = cx * CHUNK_SIZE + x;
            const wz = cz * CHUNK_SIZE + z;
            const h = getTerrainHeight(wx, wz);

            for (let y = 0; y < WORLD_HEIGHT; y++) {
                let block = BLOCK.AIR;

                if (y === 0) {
                    block = BLOCK.BEDROCK;
                } else if (y < h - 4) {
                    block = BLOCK.STONE;

                    if (y > 5 && y < h - 8 && (y % 2 === 0)) {
                        const c1 = noise.noise3D(wx * 0.05, y * 0.05, wz * 0.05);
                        if (c1 > 0.5) block = BLOCK.AIR;
                    }
                } else if (y < h - 1) {
                    block = h <= WATER_LEVEL + 2 ? BLOCK.SAND : BLOCK.DIRT;
                } else if (y === h - 1 || y === h) {
                    if (h <= WATER_LEVEL + 1) block = BLOCK.SAND;
                    else if (h > 36) block = BLOCK.SNOW;
                    else block = BLOCK.GRASS;
                } else if (y <= WATER_LEVEL && y > h) {
                    block = BLOCK.WATER;
                }

                data[x * WORLD_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + z] = block;

                if (block === BLOCK.WATER) {
                    markNaturalWater(wx, y, wz);
                } else {
                    unmarkNaturalWater(wx, y, wz);
                }
            }

            if (shouldPlaceTree(wx, wz, h)) {
                const tH = 4 + Math.floor(noise.noise2D(wx * 1.3, wz * 1.3) * 2 + 2);

                for (let ty = 1; ty <= tH; ty++) {
                    const yy = h + ty;
                    if (yy >= WORLD_HEIGHT) break;
                    data[x * WORLD_HEIGHT * CHUNK_SIZE + yy * CHUNK_SIZE + z] = BLOCK.WOOD;
                }

                for (let lx = -2; lx <= 2; lx++) {
                    for (let lz = -2; lz <= 2; lz++) {
                        for (let ly = tH - 2; ly <= tH + 1; ly++) {
                            if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && Math.random() > 0.5) continue;
                            if (ly === tH + 1 && (Math.abs(lx) > 1 || Math.abs(lz) > 1)) continue;

                            const tx = x + lx;
                            const tz = z + lz;
                            const ty = h + ly;

                            if (tx < 0 || tx >= CHUNK_SIZE || tz < 0 || tz >= CHUNK_SIZE || ty >= WORLD_HEIGHT) continue;

                            const idx = tx * WORLD_HEIGHT * CHUNK_SIZE + ty * CHUNK_SIZE + tz;
                            if (data[idx] === BLOCK.AIR) data[idx] = BLOCK.LEAVES;
                        }
                    }
                }
            }
        }
    }

    chunks[key] = data;
    buildChunkMesh(cx, cz);
}

function getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= WORLD_HEIGHT) return BLOCK.AIR;

    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const c = chunks[cx + ',' + cz];

    if (!c) return BLOCK.AIR;

    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    return c[lx * WORLD_HEIGHT * CHUNK_SIZE + wy * CHUNK_SIZE + lz];
}

// ================================================================
// BATCHED BLOCK SETTING
// ================================================================
function markChunkDirty(cx, cz) {
    const key = cx + ',' + cz;

    if (!chunks[key]) return;

    dirtyChunks.add(key);

    if (!dirtyFlushScheduled) {
        dirtyFlushScheduled = true;
        requestAnimationFrame(() => flushDirtyChunks());
    }
}

function flushDirtyChunks() {
    dirtyFlushScheduled = false;

    const keys = Array.from(dirtyChunks);
    dirtyChunks.clear();

    for (const key of keys) {
        const [cx, cz] = key.split(',').map(Number);

        if (chunks[key]) {
            buildChunkMesh(cx, cz);
        }
    }
}

function forceRebuildAllDirtyChunks() {
    if (dirtyChunks.size > 0) {
        flushDirtyChunks();
    }
}

function setBlock(wx, wy, wz, type) {
    if (wy < 0 || wy >= WORLD_HEIGHT) return;

    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const key = cx + ',' + cz;

    const c = chunks[key];
    if (!c) return;

    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    c[lx * WORLD_HEIGHT * CHUNK_SIZE + wy * CHUNK_SIZE + lz] = type;

    // Normal setBlock() means player/editor placed block.
    // If it is water, render it as cube-style placed water.
    unmarkNaturalWater(wx, wy, wz);

    markChunkDirty(cx, cz);

    if (lx === 0) markChunkDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) markChunkDirty(cx + 1, cz);
    if (lz === 0) markChunkDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) markChunkDirty(cx, cz + 1);
}

function setNaturalWaterBlock(wx, wy, wz) {
    if (wy < 0 || wy >= WORLD_HEIGHT) return;

    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const key = cx + ',' + cz;

    const c = chunks[key];
    if (!c) return;

    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    c[lx * WORLD_HEIGHT * CHUNK_SIZE + wy * CHUNK_SIZE + lz] = BLOCK.WATER;
    markNaturalWater(wx, wy, wz);

    markChunkDirty(cx, cz);

    if (lx === 0) markChunkDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) markChunkDirty(cx + 1, cz);
    if (lz === 0) markChunkDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) markChunkDirty(cx, cz + 1);
}

// ================================================================
// CHUNK MESH
// ================================================================
const FACE_DIRS = [
    {
        dir: [0, 1, 0],
        face: 'top',
        verts: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]
    },
    {
        dir: [0, -1, 0],
        face: 'bottom',
        verts: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]
    },
    {
        dir: [1, 0, 0],
        face: 'right',
        verts: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]
    },
    {
        dir: [-1, 0, 0],
        face: 'left',
        verts: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]
    },
    {
        dir: [0, 0, 1],
        face: 'front',
        verts: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]
    },
    {
        dir: [0, 0, -1],
        face: 'back',
        verts: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]
    }
];

function isSolid(bt) {
    const d = BLOCK_DATA[bt];
    return d ? d.solid : false;
}

function isTransparent(bt) {
    const d = BLOCK_DATA[bt];
    return d ? !!d.transparent : true;
}

function isWaterBlock(bt) {
    return bt === BLOCK.WATER;
}

function isTransparentBlock(bt) {
    // Leaves are intentionally NOT transparent.
    // Only glass uses the transparent mesh.
    return bt === BLOCK.GLASS;
}

function disposeMeshList(list, key) {
    return list.filter(m => {
        if (m.userData.chunkKey === key) {
            scene.remove(m);
            if (m.geometry) m.geometry.dispose();
            return false;
        }

        return true;
    });
}

function makeTarget() {
    return {
        positions: [],
        colors: [],
        normals: [],
        indices: [],
        uvs: [],
        vertexCount: 0
    };
}

function getWaterFaceVerts(face, isNaturalWater) {
    if (!isNaturalWater) {
        // Player placed water should look like a normal voxel block/cube.
        return face.verts;
    }

    // Natural water should look like a lake/ocean surface.
    // Keep it slightly lower than a full block.
    // Side rim is very thin to avoid ugly stacked transparent blue panels.
    const top = 0.88;
    const sideBottom = 0.82;

    if (face.face === 'top') {
        return [[0, top, 1], [1, top, 1], [1, top, 0], [0, top, 0]];
    }

    if (face.face === 'right') {
        return [[1, sideBottom, 0], [1, top, 0], [1, top, 1], [1, sideBottom, 1]];
    }

    if (face.face === 'left') {
        return [[0, sideBottom, 1], [0, top, 1], [0, top, 0], [0, sideBottom, 0]];
    }

    if (face.face === 'front') {
        return [[0, sideBottom, 1], [1, sideBottom, 1], [1, top, 1], [0, top, 1]];
    }

    if (face.face === 'back') {
        return [[1, sideBottom, 0], [0, sideBottom, 0], [0, top, 0], [1, top, 0]];
    }

    return face.verts;
}

function getFaceUVs(faceName, tu0, tu1, tv0, tv1) {
    if (faceName === 'right' || faceName === 'left') {
        return [
            tu0, tv0,
            tu0, tv1,
            tu1, tv1,
            tu1, tv0
        ];
    }

    if (faceName === 'front' || faceName === 'back') {
        return [
            tu0, tv0,
            tu1, tv0,
            tu1, tv1,
            tu0, tv1
        ];
    }

    return [
        tu0, tv1,
        tu1, tv1,
        tu1, tv0,
        tu0, tv0
    ];
}

function pushFace(target, ox, oz, x, y, z, block, face, tileIdx, colorMul, isNaturalWaterFace) {
    const p = target.positions;
    const c = target.colors;
    const n = target.normals;
    const idx = target.indices;
    const uv = target.uvs;

    const v = target.vertexCount;

    const tCol = tileIdx % ATLAS_COLS;
    const tRow = Math.floor(tileIdx / ATLAS_COLS);

    const tu0 = tCol / ATLAS_COLS;
    const tu1 = (tCol + 1) / ATLAS_COLS;
    const tv0 = 1 - (tRow + 1) / ATLAS_ROWS;
    const tv1 = 1 - tRow / ATLAS_ROWS;

    const verts = block === BLOCK.WATER ? getWaterFaceVerts(face, !!isNaturalWaterFace) : face.verts;

    for (let vv = 0; vv < 4; vv++) {
        p.push(
            ox + x + verts[vv][0],
            y + verts[vv][1],
            oz + z + verts[vv][2]
        );

        c.push(colorMul[0], colorMul[1], colorMul[2]);
        n.push(face.dir[0], face.dir[1], face.dir[2]);
    }

    const faceUvs = getFaceUVs(face.face, tu0, tu1, tv0, tv1);
    uv.push(...faceUvs);

    idx.push(v, v + 1, v + 2, v, v + 2, v + 3);

    target.vertexCount += 4;
}

function buildGeometryFromTarget(target) {
    const g = new THREE.BufferGeometry();

    g.setAttribute('position', new THREE.Float32BufferAttribute(target.positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(target.colors, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(target.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(target.uvs, 2));
    g.setIndex(target.indices);
    g.computeBoundingSphere();

    return g;
}

function isWaterSurfaceBlock(chunk, x, y, z, ox, oz) {
    const aboveY = y + 1;

    if (aboveY >= WORLD_HEIGHT) return true;

    let above = BLOCK.AIR;

    if (aboveY >= 0 && aboveY < WORLD_HEIGHT) {
        above = chunk[x * WORLD_HEIGHT * CHUNK_SIZE + aboveY * CHUNK_SIZE + z];
    }

    return above !== BLOCK.WATER;
}

function shouldShowWaterFace(face, neighborBlock, isSurfaceWater, isNaturalWater) {
    if (isNaturalWater) {
        if (face.face === 'bottom') return false;

        if (face.face === 'top') {
            return isSurfaceWater;
        }

        // Natural water:
        // Only show a very thin side rim when water touches actual air.
        // Do NOT show water side through glass, otherwise the pool looks like stacked blue panels.
        if (!isSurfaceWater) return false;

        return neighborBlock === BLOCK.AIR;
    }

    // Placed water = Creative/player water block.
    // Render like a cube block so the player clearly sees the placed block.
    return neighborBlock !== BLOCK.WATER && (
        neighborBlock === BLOCK.AIR ||
        neighborBlock === BLOCK.GLASS ||
        neighborBlock === BLOCK.LEAVES ||
        !isSolid(neighborBlock)
    );
}

function buildChunkMesh(cx, cz) {
    const key = cx + ',' + cz;
    const chunk = chunks[key];

    if (!chunk) return;

    if (chunkMeshes[key]) {
        chunkMeshes[key].forEach(m => {
            scene.remove(m);
            if (m.geometry) m.geometry.dispose();
        });
    }

    waterMeshes = disposeMeshList(waterMeshes, key);
    transparentMeshes = disposeMeshList(transparentMeshes, key);

    const opaque = makeTarget();
    const transparent = makeTarget();
    const water = makeTarget();

    const ox = cx * CHUNK_SIZE;
    const oz = cz * CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const block = chunk[x * WORLD_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + z];

                if (block === BLOCK.AIR) continue;

                const isWater = isWaterBlock(block);
                const isTrans = isTransparentBlock(block);
                const wx = ox + x;
                const wz = oz + z;
                const isNaturalWater = isWater ? isNaturalWaterCell(wx, y, wz) : false;
                const isSurfaceWater = isWater && isNaturalWater ? isWaterSurfaceBlock(chunk, x, y, z, ox, oz) : false;

                for (let f = 0; f < 6; f++) {
                    const face = FACE_DIRS[f];

                    const lx = x + face.dir[0];
                    const ly = y + face.dir[1];
                    const lz = z + face.dir[2];

                    let nb = BLOCK.AIR;

                    if (ly >= 0 && ly < WORLD_HEIGHT) {
                        if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
                            nb = chunk[lx * WORLD_HEIGHT * CHUNK_SIZE + ly * CHUNK_SIZE + lz];
                        } else {
                            nb = getBlock(ox + lx, ly, oz + lz);
                        }
                    }

                    let show = false;

                    if (isWater) {
                        show = shouldShowWaterFace(face, nb, isSurfaceWater, isNaturalWater);
                    } else if (isTrans) {
                        show = nb === BLOCK.AIR || nb === BLOCK.WATER || !isSolid(nb) || (isTransparentBlock(nb) && nb !== block);
                    } else {
                        show = nb === BLOCK.AIR || nb === BLOCK.WATER || isTransparent(nb);
                    }

                    if (!show) continue;

                    const h = ((x * 7919 + y * 104729 + z * 15485863 + face.dir[0] * 31 + face.dir[2] * 37) & 0xff) / 255;
                    const cn = (h - 0.5) * 0.08;

                    let r = Math.max(0.9, Math.min(1.1, 1 + cn));
                    let g = Math.max(0.9, Math.min(1.1, 1 + cn));
                    let b = Math.max(0.9, Math.min(1.1, 1 + cn));

                    if (block === BLOCK.GLASS) {
                        r *= 0.9;
                        g *= 1.03;
                        b *= 1.12;
                    }

                    if (block === BLOCK.WATER) {
                        if (isNaturalWater) {
                            r *= 0.55;
                            g *= 0.82;
                            b *= 1.12;
                        } else {
                            r *= 0.45;
                            g *= 0.75;
                            b *= 1.28;
                        }
                    }

                    const tileIdx = isWater ? T.WATER : getBlockTileForFace(block, face.face);

                    if (isWater) {
                        pushFace(water, ox, oz, x, y, z, block, face, tileIdx, [r, g, b], isNaturalWater);
                    } else if (isTrans) {
                        pushFace(transparent, ox, oz, x, y, z, block, face, tileIdx, [r, g, b], false);
                    } else {
                        pushFace(opaque, ox, oz, x, y, z, block, face, tileIdx, [r, g, b], false);
                    }
                }
            }
        }
    }

    const meshes = [];

    if (opaque.positions.length > 0) {
        const g = buildGeometryFromTarget(opaque);
        const m = new THREE.Mesh(g, chunkMaterial);

        m.userData.chunkKey = key;
        m.castShadow = true;
        m.receiveShadow = true;

        scene.add(m);
        meshes.push(m);
    }

    if (transparent.positions.length > 0) {
        const g = buildGeometryFromTarget(transparent);
        const m = new THREE.Mesh(g, transparentMaterial);

        m.userData.chunkKey = key;
        m.renderOrder = 10;
        m.castShadow = false;
        m.receiveShadow = true;

        scene.add(m);
        transparentMeshes.push(m);
    }

    if (water.positions.length > 0) {
        const g = buildGeometryFromTarget(water);
        const m = new THREE.Mesh(g, waterMaterial);

        m.userData.chunkKey = key;
        m.renderOrder = 20;
        m.castShadow = false;
        m.receiveShadow = false;

        scene.add(m);
        waterMeshes.push(m);
    }

    chunkMeshes[key] = meshes;
}

// ================================================================
// CHUNK MANAGEMENT
// ================================================================
function generateInitialWorld() {
    for (let x = -RENDER_DIST; x <= RENDER_DIST; x++) {
        for (let z = -RENDER_DIST; z <= RENDER_DIST; z++) {
            generateChunk(x, z);
        }
    }
}

function updateChunks() {
    const pcx = Math.floor(playerPos.x / CHUNK_SIZE);
    const pcz = Math.floor(playerPos.z / CHUNK_SIZE);

    chunkGenQueue = [];

    for (let x = -RENDER_DIST; x <= RENDER_DIST; x++) {
        for (let z = -RENDER_DIST; z <= RENDER_DIST; z++) {
            const cx = pcx + x;
            const cz = pcz + z;

            if (!chunks[cx + ',' + cz]) {
                chunkGenQueue.push({ cx, cz, d: Math.abs(x) + Math.abs(z) });
            }
        }
    }

    chunkGenQueue.sort((a, b) => a.d - b.d);

    if (chunkGenQueue.length > 0) {
        generateChunk(chunkGenQueue[0].cx, chunkGenQueue[0].cz);
    }

    for (const key in chunkMeshes) {
        const [cx, cz] = key.split(',').map(Number);

        if (Math.abs(cx - pcx) > RENDER_DIST + 1 || Math.abs(cz - pcz) > RENDER_DIST + 1) {
            chunkMeshes[key].forEach(m => {
                scene.remove(m);
                if (m.geometry) m.geometry.dispose();
            });

            delete chunkMeshes[key];
            delete chunks[key];
            clearNaturalWaterInChunk(cx, cz);

            waterMeshes = disposeMeshList(waterMeshes, key);
            transparentMeshes = disposeMeshList(transparentMeshes, key);
        }
    }
}

// ================================================================
// RAYCASTING
// ================================================================
function raycast(maxDist) {
    maxDist = maxDist || 6;

    const dir = new THREE.Vector3(
        -Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch)
    ).normalize();

    const pos = camera.position.clone();
    const step = 0.05;

    let px, py, pz;

    for (let d = 0; d < maxDist; d += step) {
        const x = Math.floor(pos.x + dir.x * d);
        const y = Math.floor(pos.y + dir.y * d);
        const z = Math.floor(pos.z + dir.z * d);

        if (isSolid(getBlock(x, y, z))) {
            return {
                x,
                y,
                z,
                block: getBlock(x, y, z),
                placeX: px !== undefined ? px : x,
                placeY: py !== undefined ? py : y,
                placeZ: pz !== undefined ? pz : z
            };
        }

        px = x;
        py = y;
        pz = z;
    }

    return null;
}