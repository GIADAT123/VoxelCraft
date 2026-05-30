// ================================================================
// AQUATIC ANIMALS SYSTEM
// File: js/aquatic.js
// ================================================================

let aquaticAnimals = [];
let aquaticSpawnTimer = 0;
let showcaseAquariumReady = false;

const MAX_NATURAL_AQUATIC = 18;
const NATURAL_AQUATIC_SPAWN_INTERVAL = 2.5;
const NATURAL_AQUATIC_SPAWN_RADIUS_MIN = 10;
const NATURAL_AQUATIC_SPAWN_RADIUS_MAX = 38;
const NATURAL_AQUATIC_DESPAWN_DISTANCE = 70;

const MAX_SHOWCASE_AQUATIC = 18;
const AQUATIC_TURN_SMOOTHING = 0.08;

const SHOWCASE_AQUARIUM = {
    minX: 10,
    maxX: 30,
    minY: 33,
    maxY: 37,
    minZ: 11,
    maxZ: 27
};

function clampAquatic(v, min, max){
    return Math.max(min, Math.min(max, v));
}

function randRange(min, max){
    return min + Math.random() * (max - min);
}

function randChoice(arr){
    return arr[Math.floor(Math.random() * arr.length)];
}

function disposeAquaticObject(obj){
    if(!obj) return;

    obj.traverse(child=>{
        if(child.geometry) child.geometry.dispose();

        if(child.material){
            if(Array.isArray(child.material)){
                child.material.forEach(m=>{
                    if(m.map) m.map.dispose();
                    m.dispose();
                });
            }else{
                if(child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        }
    });

    if(obj.parent){
        obj.parent.remove(obj);
    }else if(typeof scene !== 'undefined'){
        scene.remove(obj);
    }
}

function isWaterBlockAt(x, y, z){
    if(typeof getBlock !== 'function') return false;
    if(typeof BLOCK === 'undefined') return false;
    if(y < 0 || y >= WORLD_HEIGHT) return false;

    return getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === BLOCK.WATER;
}

function isSolidOrBlockedAt(x, y, z){
    if(typeof getBlock !== 'function') return true;
    if(typeof BLOCK === 'undefined') return true;

    const b = getBlock(Math.floor(x), Math.floor(y), Math.floor(z));

    if(b === BLOCK.AIR) return false;
    if(b === BLOCK.WATER) return false;

    return true;
}

function isPositionValidForAquatic(pos, animal){
    if(!pos) return false;

    if(animal && animal.isShowcaseAquarium){
        return (
            pos.x >= animal.bounds.minX + 0.3 &&
            pos.x <= animal.bounds.maxX - 0.3 &&
            pos.y >= animal.bounds.minY + 0.25 &&
            pos.y <= animal.bounds.maxY - 0.25 &&
            pos.z >= animal.bounds.minZ + 0.3 &&
            pos.z <= animal.bounds.maxZ - 0.3
        );
    }

    return isWaterBlockAt(pos.x, pos.y, pos.z);
}

function getForwardVectorFromYaw(yawValue){
    return new THREE.Vector3(
        Math.sin(yawValue),
        0,
        Math.cos(yawValue)
    ).normalize();
}

function getAquaticColor(type){
    if(type === 'fish_blue') return 0x2aa8ff;
    if(type === 'fish_orange') return 0xff9d2e;
    if(type === 'fish_yellow') return 0xffdd55;
    if(type === 'turtle') return 0x3f8f57;
    if(type === 'squid') return 0x7b61ff;
    return 0x2aa8ff;
}

function getAquaticSpeed(type){
    if(type === 'fish_blue') return randRange(1.4, 2.0);
    if(type === 'fish_orange') return randRange(1.2, 1.8);
    if(type === 'fish_yellow') return randRange(1.5, 2.3);
    if(type === 'turtle') return randRange(0.55, 0.9);
    if(type === 'squid') return randRange(0.65, 1.05);
    return randRange(1.0, 1.8);
}

function getAquaticScale(type){
    if(type === 'turtle') return randRange(0.85, 1.15);
    if(type === 'squid') return randRange(0.75, 1.05);
    return randRange(0.55, 0.85);
}

function getAquaticHealth(type){
    if(type === 'turtle') return 10;
    if(type === 'squid') return 8;
    return 5;
}

function getAquaticDropType(type){
    if(typeof getMeatItemForAnimal === 'function'){
        return getMeatItemForAnimal(type);
    }

    if(typeof ITEM !== 'undefined'){
        if(type === 'turtle' && ITEM.TURTLE_MEAT !== undefined) return ITEM.TURTLE_MEAT;
        if(type === 'squid' && ITEM.SQUID_MEAT !== undefined) return ITEM.SQUID_MEAT;
        if(ITEM.FISH !== undefined) return ITEM.FISH;
        if(ITEM.BEEF !== undefined) return ITEM.BEEF;
    }

    return null;
}

function dropAquaticMeat(animal){
    if(!animal) return;

    const dropType = getAquaticDropType(animal.type);
    if(dropType === null || dropType === undefined) return;

    const count = animal.type === 'turtle' ? 1 : animal.type === 'squid' ? 1 + Math.floor(Math.random() * 2) : 1;

    for(let i = 0; i < count; i++){
        const x = animal.mesh.position.x + (Math.random() - 0.5) * 0.35;
        const y = animal.mesh.position.y + 0.15;
        const z = animal.mesh.position.z + (Math.random() - 0.5) * 0.35;

        if(typeof spawnAnimalMeatDrop === 'function'){
            spawnAnimalMeatDrop(animal.type, x, y, z);
        }else if(typeof spawnDropItem === 'function'){
            spawnDropItem(dropType, x, y, z);
        }
    }
}

function damageAquaticAnimal(animal, amount, attackerPos){
    if(!animal || !animal.mesh) return false;

    if(animal.health === undefined){
        animal.health = getAquaticHealth(animal.type);
        animal.maxHealth = animal.health;
    }

    animal.health -= amount;
    animal.hurtTimer = 0.28;

    const kbDir = animal.mesh.position.clone().sub(attackerPos || camera.position);
    if(kbDir.lengthSq() < 0.001){
        kbDir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    }
    kbDir.normalize();

    if(!animal.knockbackVel) animal.knockbackVel = new THREE.Vector3();
    animal.knockbackVel.set(kbDir.x * 4.2, 0.9, kbDir.z * 4.2);

    animal.targetYaw = Math.atan2(kbDir.x, kbDir.z);
    animal.turnTimer = 0.35;

    playSound(520 + Math.random() * 120, 'sine', 0.10, 0.05);
    playSound(240 + Math.random() * 60, 'square', 0.08, 0.04);

    if(animal.health <= 0){
        dropAquaticMeat(animal);

        if(typeof createExplosionParticles === 'function'){
            const particleColor = getAquaticColor(animal.type);
            createExplosionParticles(animal.mesh.position.clone(), particleColor, animal.type === 'squid' ? 10 : 6);
        }

        removeAquaticAnimal(animal);
        return true;
    }

    return false;
}

function makeLambert(color){
    return new THREE.MeshLambertMaterial({
        color,
        flatShading: true
    });
}

// ================================================================
// FISH
// ================================================================
function createFishMesh(type){
    const group = new THREE.Group();

    const bodyColor = getAquaticColor(type);
    const bodyMat = makeLambert(bodyColor);
    const finMat = makeLambert(bodyColor);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x050505 });

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.36, 0.32),
        bodyMat
    );
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.30, 0.28),
        makeLambert(bodyColor)
    );
    head.position.x = 0.42;
    head.castShadow = true;
    head.receiveShadow = true;
    group.add(head);

    const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.42, 0.08),
        finMat
    );
    tail.position.x = -0.55;
    tail.rotation.y = Math.PI / 4;
    tail.castShadow = true;
    tail.receiveShadow = true;
    group.add(tail);

    const tail2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.42, 0.08),
        finMat
    );
    tail2.position.x = -0.55;
    tail2.rotation.y = -Math.PI / 4;
    tail2.castShadow = true;
    tail2.receiveShadow = true;
    group.add(tail2);

    const topFin = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.08, 0.08),
        finMat
    );
    topFin.position.set(-0.05, 0.25, 0);
    topFin.rotation.z = Math.PI / 5;
    topFin.castShadow = true;
    topFin.receiveShadow = true;
    group.add(topFin);

    const finL = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.06, 0.08),
        finMat
    );
    finL.position.set(0.05, -0.02, 0.22);
    finL.rotation.y = -0.6;
    group.add(finL);

    const finR = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.06, 0.08),
        finMat
    );
    finR.position.set(0.05, -0.02, -0.22);
    finR.rotation.y = 0.6;
    group.add(finR);

    const eyeL = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.045, 0.045),
        eyeMat
    );
    eyeL.position.set(0.57, 0.08, 0.12);
    group.add(eyeL);

    const eyeR = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.045, 0.045),
        eyeMat
    );
    eyeR.position.set(0.57, 0.08, -0.12);
    group.add(eyeR);

    group.userData.tail = tail;
    group.userData.tail2 = tail2;
    group.userData.finL = finL;
    group.userData.finR = finR;

    return group;
}

// ================================================================
// TURTLE
// ================================================================
function createTurtleMesh(){
    const group = new THREE.Group();

    const shellMat = makeLambert(0x315f3d);
    const bodyMat = makeLambert(0x5ca06b);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x050505 });

    const shell = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.28, 0.58),
        shellMat
    );
    shell.position.y = 0.05;
    shell.castShadow = true;
    shell.receiveShadow = true;
    group.add(shell);

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.20, 0.42),
        bodyMat
    );
    body.position.y = -0.07;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.22, 0.22),
        bodyMat
    );
    head.position.x = 0.48;
    head.castShadow = true;
    head.receiveShadow = true;
    group.add(head);

    const flipperGeo = new THREE.BoxGeometry(0.28, 0.08, 0.16);
    const flippers = [];

    const flipperData = [
        [0.18, -0.10, 0.38, -0.35],
        [0.18, -0.10, -0.38, 0.35],
        [-0.34, -0.10, 0.34, 0.35],
        [-0.34, -0.10, -0.34, -0.35]
    ];

    for(const d of flipperData){
        const fl = new THREE.Mesh(flipperGeo, bodyMat);
        fl.position.set(d[0], d[1], d[2]);
        fl.rotation.y = d[3];
        fl.castShadow = true;
        fl.receiveShadow = true;
        group.add(fl);
        flippers.push(fl);
    }

    const eyeL = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.04, 0.04),
        eyeMat
    );
    eyeL.position.set(0.62, 0.03, 0.08);
    group.add(eyeL);

    const eyeR = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.04, 0.04),
        eyeMat
    );
    eyeR.position.set(0.62, 0.03, -0.08);
    group.add(eyeR);

    group.userData.flippers = flippers;

    return group;
}

// ================================================================
// SQUID
// ================================================================
function createSquidMesh(){
    const group = new THREE.Group();

    const bodyMat = makeLambert(0x7557d9);
    const tentacleMat = makeLambert(0x5c46ad);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x050505 });

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.70, 0.46),
        bodyMat
    );
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.38, 0.56),
        bodyMat
    );
    head.position.y = -0.43;
    head.castShadow = true;
    head.receiveShadow = true;
    group.add(head);

    const tentacles = [];
    const offsets = [
        [-0.20, -0.75, -0.20],
        [0.00, -0.78, -0.22],
        [0.20, -0.75, -0.20],
        [-0.20, -0.75, 0.20],
        [0.00, -0.78, 0.22],
        [0.20, -0.75, 0.20]
    ];

    for(const o of offsets){
        const t = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.48, 0.08),
            tentacleMat
        );
        t.position.set(o[0], o[1], o[2]);
        t.castShadow = true;
        t.receiveShadow = true;
        group.add(t);
        tentacles.push(t);
    }

    const eyeL = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 0.035),
        eyeMat
    );
    eyeL.position.set(0.19, -0.40, 0.30);
    group.add(eyeL);

    const eyeR = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 0.035),
        eyeMat
    );
    eyeR.position.set(-0.19, -0.40, 0.30);
    group.add(eyeR);

    const pupilL = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.045, 0.04),
        pupilMat
    );
    pupilL.position.set(0.19, -0.40, 0.33);
    group.add(pupilL);

    const pupilR = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.045, 0.04),
        pupilMat
    );
    pupilR.position.set(-0.19, -0.40, 0.33);
    group.add(pupilR);

    group.userData.tentacles = tentacles;

    return group;
}

function createAquaticMesh(type){
    if(type === 'turtle') return createTurtleMesh();
    if(type === 'squid') return createSquidMesh();

    return createFishMesh(type);
}

// ================================================================
// SPAWN / REMOVE
// ================================================================
function spawnAquaticAnimal(type, x, y, z, options){
    if(typeof scene === 'undefined') return null;

    options = options || {};

    const mesh = createAquaticMesh(type);
    const scale = options.scale || getAquaticScale(type);

    mesh.scale.set(scale, scale, scale);
    mesh.userData.baseScale = scale;
    mesh.position.set(x, y, z);

    const yawValue = randRange(0, Math.PI * 2);
    mesh.rotation.y = yawValue - Math.PI / 2;

    const animal = {
        type,
        mesh,
        baseScale: scale,
        pos: new THREE.Vector3(x, y, z),
        vel: new THREE.Vector3(),
        yaw: yawValue,
        targetYaw: yawValue,
        speed: options.speed || getAquaticSpeed(type),
        health: options.health || getAquaticHealth(type),
        maxHealth: options.health || getAquaticHealth(type),
        hurtTimer: 0,
        knockbackVel: new THREE.Vector3(),
        swimPhase: Math.random() * Math.PI * 2,
        turnTimer: randRange(0.8, 2.5),
        verticalTimer: randRange(0.8, 2.5),
        desiredY: y,
        isShowcaseAquarium: !!options.isShowcaseAquarium,
        bounds: options.bounds || null,
        home: new THREE.Vector3(x, y, z),
        lifetime: 0
    };

    scene.add(mesh);
    aquaticAnimals.push(animal);

    return animal;
}

function removeAquaticAnimal(animal){
    if(!animal) return;

    disposeAquaticObject(animal.mesh);

    const idx = aquaticAnimals.indexOf(animal);
    if(idx >= 0){
        aquaticAnimals.splice(idx, 1);
    }
}

function clearAquaticAnimals(){
    for(const a of aquaticAnimals){
        disposeAquaticObject(a.mesh);
    }

    aquaticAnimals = [];
    window.aquaticAnimals = aquaticAnimals;
    showcaseAquariumReady = false;
}

function countNaturalAquaticAnimals(){
    let n = 0;

    for(const a of aquaticAnimals){
        if(!a.isShowcaseAquarium) n++;
    }

    return n;
}

function countShowcaseAquaticAnimals(){
    let n = 0;

    for(const a of aquaticAnimals){
        if(a.isShowcaseAquarium) n++;
    }

    return n;
}

// ================================================================
// NATURAL SPAWN
// ================================================================
function findWaterSpawnNearPlayer(){
    if(typeof playerPos === 'undefined') return null;

    for(let tries = 0; tries < 32; tries++){
        const angle = Math.random() * Math.PI * 2;
        const r = randRange(
            NATURAL_AQUATIC_SPAWN_RADIUS_MIN,
            NATURAL_AQUATIC_SPAWN_RADIUS_MAX
        );

        const x = Math.floor(playerPos.x + Math.cos(angle) * r);
        const z = Math.floor(playerPos.z + Math.sin(angle) * r);

        const startY = clampAquatic(
            Math.floor(playerPos.y + 10),
            2,
            WORLD_HEIGHT - 2
        );

        for(let y = startY; y >= 2; y--){
            if(isWaterBlockAt(x, y, z)){
                return new THREE.Vector3(
                    x + 0.5,
                    y + 0.35,
                    z + 0.5
                );
            }
        }
    }

    return null;
}

function spawnNaturalAquaticNearPlayer(){
    if(typeof gameMode !== 'undefined' && gameMode === 'showcase') return;
    if(countNaturalAquaticAnimals() >= MAX_NATURAL_AQUATIC) return;

    const p = findWaterSpawnNearPlayer();
    if(!p) return;

    const type = randChoice([
        'fish_blue',
        'fish_orange',
        'fish_yellow',
        'fish_blue',
        'fish_orange',
        'turtle',
        'squid'
    ]);

    spawnAquaticAnimal(type, p.x, p.y, p.z, {
        isShowcaseAquarium: false
    });
}

// ================================================================
// SHOWCASE AQUARIUM
// ================================================================
function placeAquariumWaterBlock(x, y, z){
    if(typeof setNaturalWaterBlock === 'function'){
        setNaturalWaterBlock(x, y, z);
        return;
    }

    if(typeof setBlock === 'function' && typeof BLOCK !== 'undefined'){
        setBlock(x, y, z, BLOCK.WATER);
    }
}

function fillShowcaseAquariumWater(){
    if(typeof setBlock !== 'function') return;
    if(typeof BLOCK === 'undefined') return;

    const b = SHOWCASE_AQUARIUM;

    for(let x = b.minX; x <= b.maxX; x++){
        for(let z = b.minZ; z <= b.maxZ; z++){
            if(x === b.minX || x === b.maxX || z === b.minZ || z === b.maxZ){
                setBlock(x, b.minY - 1, z, BLOCK.GLASS);
            }else{
                setBlock(x, b.minY - 1, z, BLOCK.SAND);
            }
        }
    }

    for(let y = b.minY; y <= b.maxY; y++){
        for(let x = b.minX; x <= b.maxX; x++){
            setBlock(x, y, b.minZ, BLOCK.GLASS);
            setBlock(x, y, b.maxZ, BLOCK.GLASS);
        }

        for(let z = b.minZ; z <= b.maxZ; z++){
            setBlock(b.minX, y, z, BLOCK.GLASS);
            setBlock(b.maxX, y, z, BLOCK.GLASS);
        }
    }

    for(let x = b.minX + 1; x <= b.maxX - 1; x++){
        for(let y = b.minY; y <= b.maxY; y++){
            for(let z = b.minZ + 1; z <= b.maxZ - 1; z++){
                placeAquariumWaterBlock(x, y, z);
            }
        }
    }

    const plants = [
        [b.minX + 4, b.minZ + 4, BLOCK.LEAVES],
        [b.minX + 7, b.minZ + 11, BLOCK.LEAVES],
        [b.minX + 13, b.minZ + 5, BLOCK.BRICK],
        [b.minX + 16, b.minZ + 12, BLOCK.LEAVES]
    ];

    for(const p of plants){
        const px = p[0];
        const pz = p[1];
        const block = p[2];

        for(let h = 0; h < 2 + Math.floor(Math.random() * 2); h++){
            setBlock(px, b.minY + h, pz, block);
        }
    }

    if(typeof forceRebuildAllDirtyChunks === 'function'){
        forceRebuildAllDirtyChunks();
    }
}

function setupShowcaseAquariumAnimals(){
    for(let i = aquaticAnimals.length - 1; i >= 0; i--){
        if(aquaticAnimals[i].isShowcaseAquarium){
            removeAquaticAnimal(aquaticAnimals[i]);
        }
    }

    fillShowcaseAquariumWater();

    const b = SHOWCASE_AQUARIUM;

    const types = [
        'fish_blue',
        'fish_orange',
        'fish_yellow',
        'fish_blue',
        'fish_orange',
        'fish_yellow',
        'turtle',
        'squid',
        'fish_blue',
        'fish_orange',
        'squid',
        'turtle'
    ];

    for(let i = 0; i < Math.min(types.length, MAX_SHOWCASE_AQUATIC); i++){
        const x = randRange(b.minX + 1.5, b.maxX - 1.5);
        const y = randRange(b.minY + 0.6, b.maxY - 0.7);
        const z = randRange(b.minZ + 1.5, b.maxZ - 1.5);

        spawnAquaticAnimal(types[i], x, y, z, {
            isShowcaseAquarium: true,
            bounds: b,
            scale: types[i] === 'turtle' ? 0.95 : undefined
        });
    }

    showcaseAquariumReady = true;
}

// ================================================================
// MOVEMENT
// ================================================================
function pickNewAquaticDirection(animal){
    if(!animal) return;

    animal.turnTimer = randRange(1.0, 3.2);

    let newYaw = animal.yaw + randRange(-1.6, 1.6);

    if(animal.isShowcaseAquarium && animal.bounds){
        const b = animal.bounds;
        const margin = 2.2;

        const nearLeft = animal.pos.x < b.minX + margin;
        const nearRight = animal.pos.x > b.maxX - margin;
        const nearFront = animal.pos.z < b.minZ + margin;
        const nearBack = animal.pos.z > b.maxZ - margin;

        if(nearLeft) newYaw = Math.PI / 2 + randRange(-0.7, 0.7);
        if(nearRight) newYaw = -Math.PI / 2 + randRange(-0.7, 0.7);
        if(nearFront) newYaw = 0 + randRange(-0.7, 0.7);
        if(nearBack) newYaw = Math.PI + randRange(-0.7, 0.7);
    }

    animal.targetYaw = newYaw;
}

function pickNewAquaticY(animal){
    if(!animal) return;

    animal.verticalTimer = randRange(1.2, 3.5);

    if(animal.isShowcaseAquarium && animal.bounds){
        animal.desiredY = randRange(
            animal.bounds.minY + 0.4,
            animal.bounds.maxY - 0.5
        );
        return;
    }

    const currentY = animal.pos.y;
    const candidates = [
        currentY,
        currentY + randRange(-1.0, 1.0),
        currentY + randRange(-0.5, 0.5)
    ];

    for(const y of candidates){
        if(isWaterBlockAt(animal.pos.x, y, animal.pos.z)){
            animal.desiredY = clampAquatic(y, 1.5, WORLD_HEIGHT - 2);
            return;
        }
    }

    animal.desiredY = currentY;
}

function updateAquaticAnimation(animal){
    if(!animal || !animal.mesh) return;

    const mesh = animal.mesh;
    const phase = gameTime * 6 + animal.swimPhase;

    if(animal.type.startsWith('fish')){
        const tail = mesh.userData.tail;
        const tail2 = mesh.userData.tail2;
        const finL = mesh.userData.finL;
        const finR = mesh.userData.finR;

        if(tail) tail.rotation.y = Math.PI / 4 + Math.sin(phase * 1.8) * 0.35;
        if(tail2) tail2.rotation.y = -Math.PI / 4 + Math.sin(phase * 1.8) * 0.35;

        if(finL) finL.rotation.z = Math.sin(phase * 2.1) * 0.25;
        if(finR) finR.rotation.z = -Math.sin(phase * 2.1) * 0.25;

        mesh.rotation.z = Math.sin(phase * 0.55) * 0.06;
    }

    if(animal.type === 'turtle'){
        const flippers = mesh.userData.flippers || [];

        for(let i = 0; i < flippers.length; i++){
            flippers[i].rotation.z = Math.sin(phase * 1.4 + i) * 0.35;
        }

        mesh.rotation.z = Math.sin(phase * 0.45) * 0.04;
    }

    if(animal.type === 'squid'){
        const tentacles = mesh.userData.tentacles || [];

        for(let i = 0; i < tentacles.length; i++){
            tentacles[i].rotation.x = Math.sin(phase * 1.8 + i * 0.5) * 0.18;
            tentacles[i].rotation.z = Math.cos(phase * 1.2 + i * 0.4) * 0.12;
        }

        mesh.rotation.z = Math.sin(phase * 0.5) * 0.07;
    }
}

function updateSingleAquaticAnimal(animal, dt){
    if(!animal || !animal.mesh) return;

    animal.lifetime += dt;

    if(animal.hurtTimer > 0){
        animal.hurtTimer -= dt;
        const flashScale = 1 + Math.max(0, animal.hurtTimer) * 0.55;
        animal.mesh.scale.setScalar((animal.baseScale || animal.mesh.scale.x) * flashScale);
    }else{
        animal.mesh.scale.setScalar(animal.baseScale || animal.mesh.scale.x);
    }

    if(animal.knockbackVel && animal.knockbackVel.lengthSq() > 0.001){
        const nextKb = animal.pos.clone().addScaledVector(animal.knockbackVel, dt);

        if(isPositionValidForAquatic(nextKb, animal)){
            animal.pos.copy(nextKb);
        }

        animal.knockbackVel.multiplyScalar(0.86);
    }

    animal.turnTimer -= dt;
    animal.verticalTimer -= dt;

    if(animal.turnTimer <= 0){
        pickNewAquaticDirection(animal);
    }

    if(animal.verticalTimer <= 0){
        pickNewAquaticY(animal);
    }

    let diff = animal.targetYaw - animal.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    animal.yaw += diff * AQUATIC_TURN_SMOOTHING;

    const forward = getForwardVectorFromYaw(animal.yaw);

    const bob = Math.sin(gameTime * 1.8 + animal.swimPhase) * 0.08;
    const targetY = animal.desiredY + bob;

    animal.vel.x = forward.x * animal.speed;
    animal.vel.z = forward.z * animal.speed;
    animal.vel.y = (targetY - animal.pos.y) * 0.8;

    const next = animal.pos.clone().addScaledVector(animal.vel, dt);

    if(!isPositionValidForAquatic(next, animal)){
        animal.targetYaw = animal.yaw + Math.PI + randRange(-0.8, 0.8);
        animal.turnTimer = randRange(0.4, 1.2);

        if(animal.isShowcaseAquarium && animal.bounds){
            next.x = clampAquatic(next.x, animal.bounds.minX + 0.5, animal.bounds.maxX - 0.5);
            next.y = clampAquatic(next.y, animal.bounds.minY + 0.4, animal.bounds.maxY - 0.4);
            next.z = clampAquatic(next.z, animal.bounds.minZ + 0.5, animal.bounds.maxZ - 0.5);
            animal.pos.copy(next);
        }

        pickNewAquaticY(animal);
    }else{
        animal.pos.copy(next);
    }

    animal.mesh.position.copy(animal.pos);
    animal.mesh.rotation.y = animal.yaw - Math.PI / 2;

    updateAquaticAnimation(animal);
}

function despawnFarNaturalAquatic(){
    if(typeof playerPos === 'undefined') return;

    for(let i = aquaticAnimals.length - 1; i >= 0; i--){
        const a = aquaticAnimals[i];

        if(a.isShowcaseAquarium) continue;

        const d = a.pos.distanceTo(playerPos);

        if(d > NATURAL_AQUATIC_DESPAWN_DISTANCE){
            removeAquaticAnimal(a);
            continue;
        }

        if(!isWaterBlockAt(a.pos.x, a.pos.y, a.pos.z)){
            removeAquaticAnimal(a);
        }
    }
}

// ================================================================
// MAIN UPDATE
// ================================================================
function updateAquaticAnimals(dt){
    if(typeof scene === 'undefined') return;

    const mode = typeof gameMode !== 'undefined' ? gameMode : 'survival';

    aquaticSpawnTimer += dt;

    if(mode === 'showcase'){
        if(!showcaseAquariumReady || countShowcaseAquaticAnimals() === 0){
            setupShowcaseAquariumAnimals();
        }
    }else{
        for(let i = aquaticAnimals.length - 1; i >= 0; i--){
            if(aquaticAnimals[i].isShowcaseAquarium){
                removeAquaticAnimal(aquaticAnimals[i]);
            }
        }

        showcaseAquariumReady = false;

        if(aquaticSpawnTimer >= NATURAL_AQUATIC_SPAWN_INTERVAL){
            aquaticSpawnTimer = 0;
            spawnNaturalAquaticNearPlayer();
        }

        despawnFarNaturalAquatic();
    }

    for(const animal of aquaticAnimals){
        updateSingleAquaticAnimal(animal, dt);
    }
}

// ================================================================
// MANUAL TEST
// ================================================================
function spawnTestFishInFrontOfPlayer(){
    if(typeof playerPos === 'undefined') return;

    const p = playerPos.clone();
    const yawValue = typeof yaw !== 'undefined' ? yaw : 0;

    p.x += -Math.sin(yawValue) * 3;
    p.z += -Math.cos(yawValue) * 3;
    p.y += 0.5;

    spawnAquaticAnimal('fish_orange', p.x, p.y, p.z, {
        isShowcaseAquarium: false
    });
}

window.aquaticAnimals = aquaticAnimals;
window.updateAquaticAnimals = updateAquaticAnimals;
window.setupShowcaseAquariumAnimals = setupShowcaseAquariumAnimals;
window.clearAquaticAnimals = clearAquaticAnimals;
window.spawnAquaticAnimal = spawnAquaticAnimal;
window.spawnTestFishInFrontOfPlayer = spawnTestFishInFrontOfPlayer;

window.damageAquaticAnimal = damageAquaticAnimal;
