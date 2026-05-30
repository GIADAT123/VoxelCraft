// ================================================================
// WORLD CONFIG
// ================================================================
const CHUNK_SIZE = 16, WORLD_HEIGHT = 48, RENDER_DIST = 3, WATER_LEVEL = 18;
const WATER_SURFACE_OFFSET = 0.92;

// ================================================================
// WORLD GLOBALS
// ================================================================
let chunks = {}, chunkMeshes = {};
let waterMeshes = [];
let chunkGenQueue = [];

// ================================================================
// WORLD EDIT BATCHING
// ================================================================
// Dùng để dựng Graphics Showcase nhanh hơn:
// trong batch, setBlock() chỉ đánh dấu chunk dirty, không rebuild mesh ngay.
let worldBatchDepth = 0;
let dirtyChunkKeys = new Set();

function getChunkKey(cx, cz){
    return cx + ',' + cz;
}

function markChunkDirty(cx, cz){
    const key = getChunkKey(cx, cz);
    if(chunks[key]){
        dirtyChunkKeys.add(key);
    }
}

function beginWorldBatch(){
    worldBatchDepth++;
}

function endWorldBatch(){
    worldBatchDepth = Math.max(0, worldBatchDepth - 1);

    if(worldBatchDepth === 0){
        rebuildDirtyChunks();
    }
}

function rebuildDirtyChunks(){
    if(dirtyChunkKeys.size === 0) return;

    const keys = Array.from(dirtyChunkKeys);
    dirtyChunkKeys.clear();

    for(const key of keys){
        if(!chunks[key]) continue;
        const [cx, cz] = key.split(',').map(Number);
        buildChunkMesh(cx, cz);
    }
}

function forceRebuildAllDirtyChunks(){
    rebuildDirtyChunks();
}

// ================================================================
// TERRAIN
// ================================================================
function fbm(x, z, octaves, lac, pers){
    let v = 0, a = 1, f = 1, m = 0;

    for(let i = 0; i < octaves; i++){
        v += noise.noise2D(x * f, z * f) * a;
        m += a;
        a *= pers;
        f *= lac;
    }

    return v / m;
}

function getTerrainHeight(wx, wz){
    let h = fbm(wx * 0.002, wz * 0.002, 4, 2.0, 0.5) * 30;
    h += noise2.noise2D(wx * 0.01, wz * 0.01) * 8;
    h += noise2.noise2D(wx * 0.05, wz * 0.05) * 3;

    const ridge = 1 - Math.abs(noise3.noise2D(wx * 0.006, wz * 0.006));
    const rv = ridge * ridge;

    if(rv > 0.35){
        h += (rv - 0.35) * 40;
    }

    return Math.floor(h + 24);
}

function shouldPlaceTree(wx, wz, h){
    if(h <= WATER_LEVEL + 1 || h > 36) return false;
    return noise3.noise2D(wx * 0.5, wz * 0.5) > 0.75;
}

function rebuildAdjacentChunkBorders(cx, cz){
    const neighbors = [
        [cx - 1, cz],
        [cx + 1, cz],
        [cx, cz - 1],
        [cx, cz + 1]
    ];

    for(const [nx, nz] of neighbors){
        const nKey = nx + ',' + nz;

        if(chunks[nKey]){
            if(worldBatchDepth > 0){
                markChunkDirty(nx, nz);
            }else{
                buildChunkMesh(nx, nz);
            }
        }
    }
}

function generateChunk(cx, cz){
    const key = cx + ',' + cz;
    if(chunks[key]) return;

    const data = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);

    for(let x = 0; x < CHUNK_SIZE; x++){
        for(let z = 0; z < CHUNK_SIZE; z++){
            const wx = cx * CHUNK_SIZE + x;
            const wz = cz * CHUNK_SIZE + z;
            const h = getTerrainHeight(wx, wz);

            for(let y = 0; y < WORLD_HEIGHT; y++){
                let block = BLOCK.AIR;

                if(y === 0){
                    block = BLOCK.BEDROCK;
                }else if(y < h - 4){
                    block = BLOCK.STONE;

                    if(y > 5 && y < h - 8 && (y % 2 === 0)){
                        const c1 = noise.noise3D(wx * 0.05, y * 0.05, wz * 0.05);

                        if(c1 > 0.5){
                            block = BLOCK.AIR;
                        }
                    }
                }else if(y < h - 1){
                    block = h <= WATER_LEVEL + 2 ? BLOCK.SAND : BLOCK.DIRT;
                }else if(y === h - 1 || y === h){
                    if(h <= WATER_LEVEL + 1){
                        block = BLOCK.SAND;
                    }else if(h > 36){
                        block = BLOCK.SNOW;
                    }else{
                        block = BLOCK.GRASS;
                    }
                }else if(y <= WATER_LEVEL && y > h){
                    block = BLOCK.WATER;
                }

                data[x * WORLD_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + z] = block;
            }

            if(shouldPlaceTree(wx, wz, h)){
                const tH = 4 + Math.floor(noise.noise2D(wx * 1.3, wz * 1.3) * 2 + 2);

                for(let ty = 1; ty <= tH; ty++){
                    const yy = h + ty;

                    if(yy >= WORLD_HEIGHT) break;

                    data[x * WORLD_HEIGHT * CHUNK_SIZE + yy * CHUNK_SIZE + z] = BLOCK.WOOD;
                }

                for(let lx = -2; lx <= 2; lx++){
                    for(let lz = -2; lz <= 2; lz++){
                        for(let ly = tH - 2; ly <= tH + 1; ly++){
                            if(Math.abs(lx) === 2 && Math.abs(lz) === 2 && Math.random() > 0.5) continue;
                            if(ly === tH + 1 && (Math.abs(lx) > 1 || Math.abs(lz) > 1)) continue;

                            const tx = x + lx;
                            const tz = z + lz;
                            const ty = h + ly;

                            if(tx < 0 || tx >= CHUNK_SIZE || tz < 0 || tz >= CHUNK_SIZE || ty >= WORLD_HEIGHT) continue;

                            const idx = tx * WORLD_HEIGHT * CHUNK_SIZE + ty * CHUNK_SIZE + tz;

                            if(data[idx] === BLOCK.AIR){
                                data[idx] = BLOCK.LEAVES;
                            }
                        }
                    }
                }
            }
        }
    }

    chunks[key] = data;

    if(worldBatchDepth > 0){
        markChunkDirty(cx, cz);
        rebuildAdjacentChunkBorders(cx, cz);
    }else{
        buildChunkMesh(cx, cz);
        rebuildAdjacentChunkBorders(cx, cz);
    }
}

function getBlock(wx, wy, wz){
    if(wy < 0 || wy >= WORLD_HEIGHT) return BLOCK.AIR;

    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const c = chunks[cx + ',' + cz];

    if(!c) return BLOCK.AIR;

    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    return c[lx * WORLD_HEIGHT * CHUNK_SIZE + wy * CHUNK_SIZE + lz];
}

function setBlock(wx, wy, wz, type){
    if(wy < 0 || wy >= WORLD_HEIGHT) return;

    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const key = cx + ',' + cz;
    const c = chunks[key];

    if(!c) return;

    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    c[lx * WORLD_HEIGHT * CHUNK_SIZE + wy * CHUNK_SIZE + lz] = type;

    markChunkDirty(cx, cz);

    if(lx === 0) markChunkDirty(cx - 1, cz);
    if(lx === CHUNK_SIZE - 1) markChunkDirty(cx + 1, cz);
    if(lz === 0) markChunkDirty(cx, cz - 1);
    if(lz === CHUNK_SIZE - 1) markChunkDirty(cx, cz + 1);

    if(worldBatchDepth === 0){
        rebuildDirtyChunks();
    }
}

// ================================================================
// CHUNK MESH
// ================================================================
// Quan trọng:
// - Giữ nguyên texture/config block cỏ.
// - Chỉ sửa UV mapping theo từng mặt.
// - Mặt bên block: vertex dưới dùng tv0, vertex trên dùng tv1.
// - Nhờ vậy viền cỏ nằm đúng ở mép trên của mặt bên, không bị kéo sọc dọc.
// ================================================================
const FACE_DIRS = [
    {
        dir: [0, 1, 0],
        face: 'top',
        verts: [
            [0, 1, 1],
            [1, 1, 1],
            [1, 1, 0],
            [0, 1, 0]
        ],
        uvOrder: [
            [0, 1],
            [1, 1],
            [1, 0],
            [0, 0]
        ]
    },
    {
        dir: [0, -1, 0],
        face: 'bottom',
        verts: [
            [0, 0, 0],
            [1, 0, 0],
            [1, 0, 1],
            [0, 0, 1]
        ],
        uvOrder: [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1]
        ]
    },
    {
        dir: [1, 0, 0],
        face: 'right',
        verts: [
            [1, 0, 0],
            [1, 1, 0],
            [1, 1, 1],
            [1, 0, 1]
        ],
        uvOrder: [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0]
        ]
    },
    {
        dir: [-1, 0, 0],
        face: 'left',
        verts: [
            [0, 0, 1],
            [0, 1, 1],
            [0, 1, 0],
            [0, 0, 0]
        ],
        uvOrder: [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0]
        ]
    },
    {
        dir: [0, 0, 1],
        face: 'front',
        verts: [
            [0, 0, 1],
            [1, 0, 1],
            [1, 1, 1],
            [0, 1, 1]
        ],
        uvOrder: [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1]
        ]
    },
    {
        dir: [0, 0, -1],
        face: 'back',
        verts: [
            [1, 0, 0],
            [0, 0, 0],
            [0, 1, 0],
            [1, 1, 0]
        ],
        uvOrder: [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1]
        ]
    }
];

function isSolid(bt){
    const d = BLOCK_DATA[bt];
    return d ? d.solid : false;
}

function isTransparent(bt){
    const d = BLOCK_DATA[bt];
    return d ? !!d.transparent : true;
}

function pushFaceData(target, ox, oy, oz, face, color, uvRect, indexBase, lowerTopForWater){
    const { positions, colors, normals, uvs, indices } = target;

    for(let i = 0; i < 4; i++){
        const vx = face.verts[i][0];
        let vy = face.verts[i][1];
        const vz = face.verts[i][2];

        if(lowerTopForWater && vy === 1){
            vy = WATER_SURFACE_OFFSET;
        }

        positions.push(
            ox + vx,
            oy + vy,
            oz + vz
        );

        colors.push(
            color[0],
            color[1],
            color[2]
        );

        normals.push(
            face.dir[0],
            face.dir[1],
            face.dir[2]
        );
    }

    for(let i = 0; i < 4; i++){
        const fu = face.uvOrder[i][0];
        const fv = face.uvOrder[i][1];

        const U = fu === 0 ? uvRect[0] : uvRect[1];
        const V = fv === 0 ? uvRect[2] : uvRect[3];

        uvs.push(U, V);
    }

    indices.push(
        indexBase,
        indexBase + 1,
        indexBase + 2,
        indexBase,
        indexBase + 2,
        indexBase + 3
    );
}

function buildChunkMesh(cx, cz){
    const key = cx + ',' + cz;
    const chunk = chunks[key];

    if(!chunk) return;

    if(chunkMeshes[key]){
        chunkMeshes[key].forEach((m)=>{
            scene.remove(m);
            m.geometry.dispose();
        });
    }

    waterMeshes = waterMeshes.filter((m)=>{
        if(m.userData.chunkKey === key){
            scene.remove(m);
            m.geometry.dispose();
            return false;
        }

        return true;
    });

    const solidData = {
        positions: [],
        colors: [],
        normals: [],
        uvs: [],
        indices: []
    };

    const waterData = {
        positions: [],
        colors: [],
        normals: [],
        uvs: [],
        indices: []
    };

    const glassData = {
        positions: [],
        colors: [],
        normals: [],
        uvs: [],
        indices: []
    };

    let solidVC = 0;
    let waterVC = 0;
    let glassVC = 0;

    const ox = cx * CHUNK_SIZE;
    const oz = cz * CHUNK_SIZE;

    for(let x = 0; x < CHUNK_SIZE; x++){
        for(let y = 0; y < WORLD_HEIGHT; y++){
            for(let z = 0; z < CHUNK_SIZE; z++){
                const block = chunk[x * WORLD_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + z];

                if(block === BLOCK.AIR) continue;

                const wx = ox + x;
                const wz = oz + z;
                const isWater = block === BLOCK.WATER;
                const isGlass = block === BLOCK.GLASS;

                const blockAbove = getBlock(wx, y + 1, wz);
                const isSurfaceWater = isWater && blockAbove !== BLOCK.WATER;

                // Chỉ render lớp nước mặt để hồ không bị chia khối bên trong.
                if(isWater && !isSurfaceWater) continue;

                for(let f = 0; f < 6; f++){
                    const face = FACE_DIRS[f];

                    const lx = x + face.dir[0];
                    const ly = y + face.dir[1];
                    const lz = z + face.dir[2];

                    let neighbor = BLOCK.AIR;

                    if(ly >= 0 && ly < WORLD_HEIGHT){
                        if(lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE){
                            neighbor = chunk[lx * WORLD_HEIGHT * CHUNK_SIZE + ly * CHUNK_SIZE + lz];
                        }else{
                            neighbor = getBlock(
                                wx + face.dir[0],
                                ly,
                                wz + face.dir[2]
                            );
                        }
                    }

                    let show = false;

                    if(isWater){
                        if(face.face === 'bottom'){
                            show = false;
                        }else if(face.face === 'top'){
                            show = neighbor !== BLOCK.WATER;
                        }else{
                            show = neighbor !== BLOCK.WATER && (neighbor === BLOCK.AIR || isTransparent(neighbor));
                        }
                    }else if(isGlass){
                        // Kính phải render riêng với material transparent.
                        // Ẩn mặt nằm giữa 2 block kính để hồ kính không bị đặc và không quá nhiều đường chia ô.
                        show = neighbor !== BLOCK.GLASS && (neighbor === BLOCK.AIR || isTransparent(neighbor));
                    }else{
                        show = neighbor === BLOCK.AIR || isTransparent(neighbor);
                    }

                    if(!show) continue;

                    let color;

                    if(isWater){
                        color = [1, 1, 1];
                    }else if(isGlass){
                        color = [0.96, 1.0, 1.08];
                    }else{
                        const h = (
                            (
                                x * 7919 +
                                y * 104729 +
                                z * 15485863 +
                                face.dir[0] * 31 +
                                face.dir[2] * 37
                            ) & 0xff
                        ) / 255;

                        const cn = (h - 0.5) * 0.1;

                        color = [
                            Math.max(0.88, Math.min(1.12, 1 + cn)),
                            Math.max(0.88, Math.min(1.12, 1 + cn)),
                            Math.max(0.88, Math.min(1.12, 1 + cn))
                        ];
                    }

                    const tileIdx = isWater ? T.WATER : getBlockTileForFace(block, face.face);

                    const tCol = tileIdx % ATLAS_COLS;
                    const tRow = Math.floor(tileIdx / ATLAS_COLS);

                    const tu0 = tCol / ATLAS_COLS;
                    const tu1 = (tCol + 1) / ATLAS_COLS;

                    const tv0 = 1 - (tRow + 1) / ATLAS_ROWS;
                    const tv1 = 1 - tRow / ATLAS_ROWS;

                    const uvRect = [tu0, tu1, tv0, tv1];

                    if(isWater){
                        pushFaceData(
                            waterData,
                            wx,
                            y,
                            wz,
                            face,
                            color,
                            uvRect,
                            waterVC,
                            true
                        );

                        waterVC += 4;
                    }else if(isGlass){
                        pushFaceData(
                            glassData,
                            wx,
                            y,
                            wz,
                            face,
                            color,
                            uvRect,
                            glassVC,
                            false
                        );

                        glassVC += 4;
                    }else{
                        pushFaceData(
                            solidData,
                            wx,
                            y,
                            wz,
                            face,
                            color,
                            uvRect,
                            solidVC,
                            false
                        );

                        solidVC += 4;
                    }
                }
            }
        }
    }

    const meshes = [];

    if(solidData.positions.length > 0){
        const g = new THREE.BufferGeometry();

        g.setAttribute('position', new THREE.Float32BufferAttribute(solidData.positions, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(solidData.colors, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(solidData.normals, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(solidData.uvs, 2));

        g.setIndex(solidData.indices);

        const m = new THREE.Mesh(g, chunkMaterial);

        scene.add(m);
        meshes.push(m);
    }

    if(glassData.positions.length > 0){
        const g = new THREE.BufferGeometry();

        g.setAttribute('position', new THREE.Float32BufferAttribute(glassData.positions, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(glassData.colors, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(glassData.normals, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(glassData.uvs, 2));

        g.setIndex(glassData.indices);

        const mat = typeof glassMaterial !== 'undefined' ? glassMaterial : chunkMaterial;
        const m = new THREE.Mesh(g, mat);

        m.userData.chunkKey = key;
        m.userData.isGlassMesh = true;
        m.renderOrder = 2;
        m.castShadow = false;
        m.receiveShadow = false;

        scene.add(m);
        meshes.push(m);
    }

    if(waterData.positions.length > 0){
        const g = new THREE.BufferGeometry();

        g.setAttribute('position', new THREE.Float32BufferAttribute(waterData.positions, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(waterData.colors, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(waterData.normals, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(waterData.uvs, 2));

        g.setIndex(waterData.indices);

        const m = new THREE.Mesh(g, waterMaterial);

        m.userData.chunkKey = key;
        m.renderOrder = 1;

        scene.add(m);
        waterMeshes.push(m);
    }

    chunkMeshes[key] = meshes;
}

// ================================================================
// CHUNK MANAGEMENT
// ================================================================
function generateInitialWorld(){
    for(let x = -RENDER_DIST; x <= RENDER_DIST; x++){
        for(let z = -RENDER_DIST; z <= RENDER_DIST; z++){
            generateChunk(x, z);
        }
    }
}

function updateChunks(){
    const pcx = Math.floor(playerPos.x / CHUNK_SIZE);
    const pcz = Math.floor(playerPos.z / CHUNK_SIZE);

    chunkGenQueue = [];

    for(let x = -RENDER_DIST; x <= RENDER_DIST; x++){
        for(let z = -RENDER_DIST; z <= RENDER_DIST; z++){
            const cx = pcx + x;
            const cz = pcz + z;

            if(!chunks[cx + ',' + cz]){
                chunkGenQueue.push({
                    cx,
                    cz,
                    d: Math.abs(x) + Math.abs(z)
                });
            }
        }
    }

    chunkGenQueue.sort((a, b)=>a.d - b.d);

    if(chunkGenQueue.length > 0){
        generateChunk(chunkGenQueue[0].cx, chunkGenQueue[0].cz);
    }

    for(const key in chunkMeshes){
        const [ccx, ccz] = key.split(',').map(Number);

        if(Math.abs(ccx - pcx) > RENDER_DIST + 1 || Math.abs(ccz - pcz) > RENDER_DIST + 1){
            chunkMeshes[key].forEach((m)=>{
                scene.remove(m);
                m.geometry.dispose();
            });

            delete chunkMeshes[key];
            delete chunks[key];
        }
    }

    waterMeshes = waterMeshes.filter((m)=>{
        const [ccx, ccz] = m.userData.chunkKey.split(',').map(Number);

        if(Math.abs(ccx - pcx) > RENDER_DIST + 1 || Math.abs(ccz - pcz) > RENDER_DIST + 1){
            scene.remove(m);
            m.geometry.dispose();
            return false;
        }

        return true;
    });
}

// ================================================================
// RAYCASTING
// ================================================================
function raycast(maxDist){
    maxDist = maxDist || 6;

    const dir = new THREE.Vector3(
        -Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch)
    ).normalize();

    const pos = camera.position.clone();
    const step = 0.05;

    let px;
    let py;
    let pz;

    for(let d = 0; d < maxDist; d += step){
        const x = Math.floor(pos.x + dir.x * d);
        const y = Math.floor(pos.y + dir.y * d);
        const z = Math.floor(pos.z + dir.z * d);

        if(isSolid(getBlock(x, y, z))){
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