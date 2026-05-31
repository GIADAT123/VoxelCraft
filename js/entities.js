// ================================================================
// ZOMBIE SYSTEM
// ================================================================
const ZOMBIE_TYPES = {
    normal: { name: 'Zombie', health: 60, speed: 2.2, damage: 8, color: 0x448833, eyeColor: 0xff0000, scale: 1.0 },
    fast:   { name: 'Zombie Nhanh', health: 35, speed: 4.0, damage: 6, color: 0x559944, eyeColor: 0xff4400, scale: 0.85 },
    tank:   { name: 'Zombie To', health: 150, speed: 1.4, damage: 15, color: 0x336622, eyeColor: 0x880000, scale: 1.3 },
    creeper:{ name: 'Creeper', health: 40, speed: 1.8, damage: 30, color: 0x44aa33, eyeColor: 0x000000, scale: 1.0 },
};

let zombies=[];
let totalKills=0;
let zombieWave=0;
let zombieSpawnTimer=0;
let zombiesPerWave=3;
let waveActive=false;

function createZombieMesh(type) {
    const zt = ZOMBIE_TYPES[type] || ZOMBIE_TYPES.normal;
    const group = new THREE.Group();
    const s = zt.scale;

    // Body (torso)
    const bodyGeo = new THREE.BoxGeometry(0.5*s, 0.7*s, 0.3*s);
    const bodyMat = new THREE.MeshLambertMaterial({ color: zt.color });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.85 * s;
    group.add(body);

    // Head
    const headGeo = new THREE.BoxGeometry(0.45*s, 0.45*s, 0.45*s);
    const headMat = new THREE.MeshLambertMaterial({ color: zt.color });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.4 * s;
    group.add(head);

    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.1*s, 0.06*s, 0.05*s);
    const eyeMat = new THREE.MeshBasicMaterial({ color: zt.eyeColor });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.1*s, 1.43*s, 0.23*s);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.1*s, 1.43*s, 0.23*s);
    group.add(rightEye);

    // Arms (pivot at shoulder, reaching forward)
    const armGeo = new THREE.BoxGeometry(0.18*s, 0.6*s, 0.18*s);
    const armMat = new THREE.MeshLambertMaterial({ color: zt.color });
    // Left arm
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.35*s, 1.15*s, 0); // shoulder position
    leftArmPivot.rotation.x = -1.4; // reach forward
    leftArmPivot.name = 'leftArm';
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.y = -0.3*s; // offset down from pivot
    leftArmPivot.add(leftArm);
    group.add(leftArmPivot);
    // Right arm
    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.35*s, 1.15*s, 0);
    rightArmPivot.rotation.x = -1.4;
    rightArmPivot.name = 'rightArm';
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.y = -0.3*s;
    rightArmPivot.add(rightArm);
    group.add(rightArmPivot);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.22*s, 0.5*s, 0.22*s);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x334422 });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.12*s, 0.25*s, 0);
    leftLeg.name = 'leftLeg';
    group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.12*s, 0.25*s, 0);
    rightLeg.name = 'rightLeg';
    group.add(rightLeg);

    group.castShadow = true;
    return group;
}

function spawnZombie(type) {
    if(typeof gameMode !== 'undefined' && gameMode !== 'survival') return;
    if (zombies.length >= 15) return; // Max zombies reduced for performance

    const zt = ZOMBIE_TYPES[type] || ZOMBIE_TYPES.normal;
    const mesh = createZombieMesh(type);

    // Spawn position: 8-18 blocks away from player, random angle
    const angle = Math.random() * Math.PI * 2;
    const dist = 8 + Math.random() * 10;
    let sx = playerPos.x + Math.cos(angle) * dist;
    let sz = playerPos.z + Math.sin(angle) * dist;
    let sy = getTerrainHeight(Math.floor(sx), Math.floor(sz)) + 1;

    mesh.position.set(sx, sy, sz);
    scene.add(mesh);

    const zombie = {
        mesh: mesh,
        type: type,
        health: zt.health,
        maxHealth: zt.health,
        speed: zt.speed,
        damage: zt.damage,
        attackCooldown: 0,
        hurtTimer: 0,
        walkPhase: Math.random() * Math.PI * 2,
        targetY: sy,
        knockbackVel: new THREE.Vector3(0, 0, 0),
        staggerAngle: 0,
        prevY: sy,
        aiState: 'idle',
        aiTimer: Math.random() * 2,
        wanderDir: new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).normalize(),
    };

    zombies.push(zombie);
}

// Check line of sight between zombie and player (block raycast)
function checkZombieLineOfSight(z) {
    const from = z.mesh.position.clone().add(new THREE.Vector3(0, 1, 0));
    const to = playerPos.clone().add(new THREE.Vector3(0, 0.8, 0));
    const dir = to.clone().sub(from);
    const dist = dir.length();
    if (dist < 0.1) return true;
    dir.normalize();
    
    // Step along the line checking for solid blocks
    const steps = Math.ceil(dist / 0.5);
    for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const checkX = Math.floor(from.x + dir.x * dist * t);
        const checkY = Math.floor(from.y + dir.y * dist * t);
        const checkZ = Math.floor(from.z + dir.z * dist * t);
        if (isSolid(getBlock(checkX, checkY, checkZ))) return false;
    }
    return true;
}

// Get ground level by scanning blocks DOWNWARD from item position (never upward)
function getGroundLevel(x, y, z) {
    const bx = Math.floor(x), bz = Math.floor(z);
    const startY = Math.max(0, Math.floor(y));
    for (let by = startY; by >= 0; by--) {
        if (isSolid(getBlock(bx, by, bz))) return by + 1;
    }
    return 1;
}

function isWaterAtOrNearLandAnimal(x, y, z) {
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);

    // Check feet/head and the block just below. This prevents cows/pigs/chickens/sheep
    // from walking down beaches into lakes/ocean.
    return (
        getBlock(bx, by, bz) === BLOCK.WATER ||
        getBlock(bx, by + 1, bz) === BLOCK.WATER ||
        getBlock(bx, by - 1, bz) === BLOCK.WATER
    );
}

function isSafeLandAnimalPosition(x, y, z) {
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);

    if (isWaterAtOrNearLandAnimal(x, y, z)) return false;

    // The animal needs solid ground below and free space around body/head.
    if (!isSolid(getBlock(bx, by - 1, bz))) return false;
    if (isSolid(getBlock(bx, by, bz))) return false;
    if (isSolid(getBlock(bx, by + 1, bz))) return false;

    return true;
}

function faceLandAnimalAlongVelocity(animal, vx, vz) {
    if (!animal || !animal.mesh) return;
    if (Math.abs(vx) + Math.abs(vz) < 0.0001) return;

    // Land animal models face local +Z.
    // This makes head point to movement direction.
    animal.mesh.rotation.y = Math.atan2(vx, vz);
}

function turnLandAnimalAwayFromWater(animal) {
    if (!animal) return;

    animal.wanderDir.set(Math.random() - 0.5, 0, Math.random() - 0.5);

    // Bias away from nearby water.
    const checks = [
        [ 1, 0],
        [-1, 0],
        [ 0, 1],
        [ 0,-1],
        [ 1, 1],
        [ 1,-1],
        [-1, 1],
        [-1,-1],
    ];

    for (const c of checks) {
        const nx = animal.mesh.position.x + c[0];
        const nz = animal.mesh.position.z + c[1];
        if (isWaterAtOrNearLandAnimal(nx, animal.mesh.position.y, nz)) {
            animal.wanderDir.x -= c[0] * 0.9;
            animal.wanderDir.z -= c[1] * 0.9;
        }
    }

    if (animal.wanderDir.lengthSq() < 0.001) {
        animal.wanderDir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    }

    animal.wanderDir.normalize();
    faceLandAnimalAlongVelocity(animal, animal.wanderDir.x, animal.wanderDir.z);
}

function updateZombies(dt) {
    if(typeof gameMode !== 'undefined' && gameMode !== 'survival'){
        if(typeof clearZombies === 'function') clearZombies();
        return;
    }

    // Spawn logic - spawn at night
    const sunAngle = dayTime * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const isNight = sunY < -0.1;

    // Detect night transition
    if (isNight && lastDayTime >= -0.1) {
        // Night just started
        zombieWave++;
        zombiesPerWave = 3 + zombieWave * 2;
        zombieSpawnTimer = 0;
        waveActive = true;
        showWaveAlert(zombieWave);
    }
    if (!isNight) {
        waveActive = false;
    }
    lastDayTime = sunY;

    // Spawn zombies at night
    if (waveActive && !playerDead) {
        zombieSpawnTimer += dt;
        const spawnInterval = Math.max(4.0, 8 - zombieWave * 0.5);
        if (zombieSpawnTimer >= spawnInterval && zombies.length < 15 + zombieWave * 2) {
            zombieSpawnTimer = 0;
            // Pick type based on wave
            let type = 'normal';
            const r = Math.random();
            if (zombieWave >= 3 && r < 0.2) type = 'fast';
            if (zombieWave >= 5 && r < 0.15) type = 'tank';
            if (zombieWave >= 2 && r < 0.1) type = 'creeper';
            spawnZombie(type);
        }
    }

    // Update each zombie
    for (let i = zombies.length - 1; i >= 0; i--) {
        const z = zombies[i];
        const dx = playerPos.x - z.mesh.position.x;
        const dz = playerPos.z - z.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Despawn far zombies or at day
        if (dist > 60 || (!isNight && dist > 30)) {
            scene.remove(z.mesh);
            zombies.splice(i, 1);
            continue;
        }

        // AI: move toward player (skip during knockback)
        const isKnockback = z.knockbackVel.lengthSq() > 0.01;
        const hasLineOfSight = checkZombieLineOfSight(z);
        
        if (!playerDead && !isKnockback) {
            z.aiTimer -= dt;

            // State transitions
            if (dist <= 10 && hasLineOfSight) {
                z.aiState = 'chase';
            } else if (z.aiState === 'chase') {
                z.aiState = 'idle';
                z.aiTimer = 1;
            }

            if (z.aiState !== 'chase' && z.aiTimer <= 0) {
                if (z.aiState === 'idle') {
                    z.aiState = 'wander';
                    z.aiTimer = 1.5 + Math.random() * 2;
                    z.wanderDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                } else {
                    z.aiState = 'idle';
                    z.aiTimer = 1 + Math.random() * 2;
                }
            }

            let moveDir = new THREE.Vector3();
            let moveSpeed = 0;
            if (z.aiState === 'chase' && dist > 1.5) {
                moveDir.set(dx, 0, dz).normalize();
                moveSpeed = z.speed * dt;
                z.mesh.rotation.y = Math.atan2(dx, dz);
            } else if (z.aiState === 'wander') {
                moveDir.copy(z.wanderDir);
                moveSpeed = z.speed * 0.4 * dt;
                z.mesh.rotation.y = Math.atan2(moveDir.x, moveDir.z);
            }

            if (moveSpeed > 0) {
                let newX = z.mesh.position.x + moveDir.x * moveSpeed;
                let newZ = z.mesh.position.z + moveDir.z * moveSpeed;
                const zy = z.mesh.position.y;
                let steppedUp = false;

                // Check collision at feet and head level
                const blockAtNewX_feet = getBlock(Math.floor(newX), Math.floor(zy), Math.floor(z.mesh.position.z));
                const blockAtNewX_head = getBlock(Math.floor(newX), Math.floor(zy + 1), Math.floor(z.mesh.position.z));
                const blockAtNewZ_feet = getBlock(Math.floor(z.mesh.position.x), Math.floor(zy), Math.floor(newZ));
                const blockAtNewZ_head = getBlock(Math.floor(z.mesh.position.x), Math.floor(zy + 1), Math.floor(newZ));

                // Move X: if blocked at feet, try to jump up 1 block
                if (!isSolid(blockAtNewX_feet) && !isSolid(blockAtNewX_head)) {
                    z.mesh.position.x = newX;
                } else if (!steppedUp) {
                    // Try jumping: check if we can step up 1 block
                    const blockAbove_feet = getBlock(Math.floor(newX), Math.floor(zy + 1), Math.floor(z.mesh.position.z));
                    const blockAbove_head = getBlock(Math.floor(newX), Math.floor(zy + 2), Math.floor(z.mesh.position.z));
                    if (!isSolid(blockAbove_feet) && !isSolid(blockAbove_head)) {
                        z.mesh.position.x = newX;
                        z.mesh.position.y = zy + 1;
                        steppedUp = true;
                    } else if (z.aiState === 'wander') {
                        z.wanderDir.x *= -1;
                    }
                }

                // Move Z: same jump logic (only if not already stepped up this frame)
                if (!steppedUp && !isSolid(blockAtNewZ_feet) && !isSolid(blockAtNewZ_head)) {
                    z.mesh.position.z = newZ;
                } else if (!steppedUp) {
                    const blockAbove_feet = getBlock(Math.floor(z.mesh.position.x), Math.floor(z.mesh.position.y + 1), Math.floor(newZ));
                    const blockAbove_head = getBlock(Math.floor(z.mesh.position.x), Math.floor(z.mesh.position.y + 2), Math.floor(newZ));
                    if (!isSolid(blockAbove_feet) && !isSolid(blockAbove_head)) {
                        z.mesh.position.z = newZ;
                        z.mesh.position.y = z.mesh.position.y + 1;
                        steppedUp = true;
                    } else if (z.aiState === 'wander') {
                        z.wanderDir.z *= -1;
                    }
                }

                // Walking animation (arms stay mostly forward, slight bob)
                z.walkPhase += moveSpeed * 30; // Scale walk phase correctly based on speed
                const legSwing = Math.sin(z.walkPhase) * 0.5;
                const armBob = Math.sin(z.walkPhase) * 0.08; // slight bob, not full swing

                z.mesh.children.forEach(child => {
                    if (child.name === 'leftLeg') child.rotation.x = legSwing;
                    if (child.name === 'rightLeg') child.rotation.x = -legSwing;
                    if (child.name === 'leftArm') child.rotation.x = -1.4 + armBob;
                    if (child.name === 'rightArm') child.rotation.x = -1.4 - armBob;
                });
            } else {
                // Return legs to idle
                z.mesh.children.forEach(child => {
                    if (child.name === 'leftLeg' || child.name === 'rightLeg') child.rotation.x = 0;
                });
            }
        }

        // Attack player (check horizontal AND vertical distance, AND line of sight)
        const dy = Math.abs(playerPos.y - z.mesh.position.y);
        if (dist < 2.0 && dy < 2.5 && hasLineOfSight && !playerDead) {
            z.attackCooldown -= dt;
            if (z.attackCooldown <= 0) {
                z.attackCooldown = 1.5;
                
                // Creeper explodes on attack (deals damage + self-destruct)
                if (z.type === 'creeper') {
                    damagePlayer(z.damage, 'Bị Creeper nổ tung');
                    createExplosionParticles(z.mesh.position.clone(), 0x44aa33, 30);
                    playSound(80, 'sawtooth', 0.4, 0.15);
                    scene.remove(z.mesh);
                    zombies.splice(i, 1);
                    continue;
                }
                
                damagePlayer(z.damage, 'Bị ' + ZOMBIE_TYPES[z.type].name + ' đánh chết');
            }
        }

        // Apply knockback velocity with block collision
        if (z.knockbackVel.lengthSq() > 0.001) {
            // Apply Y knockback (vertical launch)
            z.mesh.position.y += z.knockbackVel.y * dt;
            const kbY = z.mesh.position.y;
            const blockBelow = getBlock(Math.floor(z.mesh.position.x), Math.floor(kbY - 0.1), Math.floor(z.mesh.position.z));
            if (isSolid(blockBelow) && z.knockbackVel.y < 0) {
                z.knockbackVel.y = 0; // landed
            }

            let kbX = z.mesh.position.x + z.knockbackVel.x * dt;
            let kbZ = z.mesh.position.z + z.knockbackVel.z * dt;
            const zy = z.mesh.position.y;

            // Check X knockback collision
            const kbBlockX = getBlock(Math.floor(kbX), Math.floor(zy), Math.floor(z.mesh.position.z));
            const kbBlockX_head = getBlock(Math.floor(kbX), Math.floor(zy + 1), Math.floor(z.mesh.position.z));
            if (!isSolid(kbBlockX) && !isSolid(kbBlockX_head)) {
                z.mesh.position.x = kbX;
            } else {
                z.knockbackVel.x *= -0.3; // bounce off wall
            }

            // Check Z knockback collision
            const kbBlockZ = getBlock(Math.floor(z.mesh.position.x), Math.floor(zy), Math.floor(kbZ));
            const kbBlockZ_head = getBlock(Math.floor(z.mesh.position.x), Math.floor(zy + 1), Math.floor(kbZ));
            if (!isSolid(kbBlockZ) && !isSolid(kbBlockZ_head)) {
                z.mesh.position.z = kbZ;
            } else {
                z.knockbackVel.z *= -0.3; // bounce off wall
            }

            z.knockbackVel.y -= 25 * dt; // gravity on knockback
            // Faster decay when horizontal speed is low (prevent infinite slide)
            const hSpeed = Math.sqrt(z.knockbackVel.x*z.knockbackVel.x + z.knockbackVel.z*z.knockbackVel.z);
            const decay = hSpeed < 1 ? 0.7 : 0.88;
            z.knockbackVel.multiplyScalar(decay);
            // Hard stop when slow enough
            if (z.knockbackVel.lengthSq() < 0.05) z.knockbackVel.set(0,0,0);
            z.staggerAngle = Math.min(0.4, z.knockbackVel.length() * 0.08);
        } else {
            z.staggerAngle *= 0.85;
        }
        z.mesh.rotation.z = z.staggerAngle;

        // Gravity & terrain following (skip while airborne from knockback)
        if (!isKnockback || z.knockbackVel.y <= 0) {
            const groundY = getGroundLevel(z.mesh.position.x, z.mesh.position.y, z.mesh.position.z);
            if (z.mesh.position.y > groundY) {
                z.mesh.position.y += (groundY - z.mesh.position.y) * 0.3;
            }
        }

        // Hurt flash - red overlay (safe, doesn't corrupt shared materials)
        if (z.hurtTimer > 0) {
            z.hurtTimer -= dt;
            const t = z.hurtTimer / 0.35; // 1 → 0
            const flashScale = 1 + t * 0.1;
            z.mesh.scale.set(flashScale, flashScale, flashScale);
            if (!z.hurtOverlay) {
                z.hurtOverlay = new THREE.Mesh(
                    new THREE.BoxGeometry(0.6, 1.8, 0.5),
                    new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.35, depthTest: true })
                );
                z.hurtOverlay.renderOrder = 1;
                z.hurtOverlay.position.y = 0.9;
                z.mesh.add(z.hurtOverlay);
            }
            z.hurtOverlay.material.opacity = t * 0.4;
            z.hurtOverlay.visible = true;
        } else {
            z.mesh.scale.set(1, 1, 1);
            if (z.hurtOverlay) { z.hurtOverlay.visible = false; }
        }

        // Dead?
        if (z.health <= 0) {
            createExplosionParticles(z.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 0x44aa22, 15);
            playSound(120, 'sawtooth', 0.3, 0.1);
            scene.remove(z.mesh);
            zombies.splice(i, 1);
            totalKills++;
            updateKillUI();
        }
    }

    // Update alive count
    const zAlive = document.getElementById('zombieAlive');
    if (zAlive) zAlive.textContent = zombies.length;
}

// ================================================================
// COW SYSTEM
// ================================================================
let cows=[];
const MAX_COWS=8;
let cowSpawnTimer=0;


function randomLandAnimalType(){
    const types = ['cow', 'pig', 'sheep', 'chicken'];
    return types[Math.floor(Math.random() * types.length)];
}

function getLandAnimalHealth(type){
    if(type === 'chicken') return 5;
    if(type === 'pig') return 8;
    if(type === 'sheep') return 9;
    return 10;
}

function getLandAnimalSpeed(type){
    if(type === 'chicken') return 1.15;
    if(type === 'pig') return 0.85;
    if(type === 'sheep') return 0.78;
    return 0.8 + Math.random() * 0.4;
}

function createAnimalMesh(type) {
    const group = new THREE.Group();
    group.userData.animalType = type || 'cow';

    let bodyColor = 0xf5f0e0;
    let headColor = 0xf5f0e0;
    let spotColor = 0x4a3520;
    let noseColor = 0xd4a574;
    let legColor = 0xe8e0d0;
    let bodySize = [0.9, 0.65, 1.3];
    let headSize = [0.5, 0.5, 0.5];
    let legSize = [0.18, 0.45, 0.18];
    let headZ = 0.85;
    let headY = 0.95;

    if (type === 'pig') {
        bodyColor = 0xff9fb3;
        headColor = 0xffaabb;
        spotColor = 0xe88598;
        noseColor = 0xff7890;
        legColor = 0xee8ea0;
        bodySize = [0.85, 0.55, 1.05];
        headSize = [0.48, 0.42, 0.45];
        headZ = 0.68;
        headY = 0.78;
    } else if (type === 'sheep') {
        bodyColor = 0xf2f2df;
        headColor = 0x4a4038;
        spotColor = 0xffffff;
        noseColor = 0x3b332c;
        legColor = 0x3b332c;
        bodySize = [0.95, 0.72, 1.12];
        headSize = [0.43, 0.42, 0.42];
        headZ = 0.75;
        headY = 0.92;
    } else if (type === 'chicken') {
        bodyColor = 0xffffff;
        headColor = 0xffffff;
        spotColor = 0xf4d35e;
        noseColor = 0xffaa22;
        legColor = 0xffcc55;
        bodySize = [0.45, 0.5, 0.55];
        headSize = [0.28, 0.28, 0.28];
        legSize = [0.07, 0.28, 0.07];
        headZ = 0.42;
        headY = 0.88;
    }

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(bodySize[0], bodySize[1], bodySize[2]),
        new THREE.MeshLambertMaterial({ color: bodyColor })
    );
    body.position.y = type === 'chicken' ? 0.52 : 0.85;
    group.add(body);

    const spotMat = new THREE.MeshLambertMaterial({ color: spotColor });
    if (type === 'cow') {
        const spot1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.66, 0.4), spotMat);
        spot1.position.set(0.2, 0.85, 0.15);
        group.add(spot1);
        const spot2 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.66, 0.3), spotMat);
        spot2.position.set(-0.22, 0.85, -0.3);
        group.add(spot2);
    } else if (type === 'sheep') {
        const wool = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.82, 1.22), new THREE.MeshLambertMaterial({color:0xffffff}));
        wool.position.y = 0.86;
        wool.scale.set(1, 1, 1);
        group.add(wool);
    }

    const head = new THREE.Mesh(
        new THREE.BoxGeometry(headSize[0], headSize[1], headSize[2]),
        new THREE.MeshLambertMaterial({ color: headColor })
    );
    head.position.set(0, headY, headZ);
    head.name = 'head';
    group.add(head);

    const nose = new THREE.Mesh(
        new THREE.BoxGeometry(type === 'chicken' ? 0.16 : 0.3, type === 'chicken' ? 0.09 : 0.22, type === 'chicken' ? 0.12 : 0.12),
        new THREE.MeshLambertMaterial({ color: noseColor })
    );
    nose.position.set(0, headY - 0.10, headZ + headSize[2] * 0.55);
    group.add(nose);

    const eyeGeo = new THREE.BoxGeometry(0.055, 0.055, 0.035);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-headSize[0]*0.24, headY + headSize[1]*0.12, headZ + headSize[2]*0.52);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(headSize[0]*0.24, headY + headSize[1]*0.12, headZ + headSize[2]*0.52);
    group.add(rightEye);

    if (type === 'cow' || type === 'sheep') {
        const hornGeo = new THREE.BoxGeometry(0.07, 0.16, 0.07);
        const hornMat = new THREE.MeshLambertMaterial({ color: 0xd4c5a0 });
        const lHorn = new THREE.Mesh(hornGeo, hornMat);
        lHorn.position.set(-0.18, headY + 0.33, headZ);
        lHorn.rotation.z = 0.3;
        group.add(lHorn);
        const rHorn = new THREE.Mesh(hornGeo, hornMat);
        rHorn.position.set(0.18, headY + 0.33, headZ);
        rHorn.rotation.z = -0.3;
        group.add(rHorn);
    }

    const legGeo = new THREE.BoxGeometry(legSize[0], legSize[1], legSize[2]);
    const legMat = new THREE.MeshLambertMaterial({ color: legColor });
    const legY = type === 'chicken' ? 0.15 : 0.22;
    const legSpreadX = type === 'chicken' ? 0.13 : 0.3;
    const legFrontZ = type === 'chicken' ? 0.18 : 0.45;
    const legBackZ = type === 'chicken' ? -0.18 : -0.45;
    const legPos = [[-legSpreadX,legY,legFrontZ],[legSpreadX,legY,legFrontZ],[-legSpreadX,legY,legBackZ],[legSpreadX,legY,legBackZ]];
    const legNames = ['leftFrontLeg','rightFrontLeg','leftBackLeg','rightBackLeg'];

    for(let i=0;i<4;i++){
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(...legPos[i]);
        leg.name = legNames[i];
        group.add(leg);
    }

    if (type !== 'chicken') {
        const tail = new THREE.Mesh(
            new THREE.BoxGeometry(0.08,0.08,0.35),
            new THREE.MeshLambertMaterial({color:type==='pig'?0xff8fa0:0x3a2a18})
        );
        tail.position.set(0,0.95,-bodySize[2]*0.58);
        tail.rotation.x = 0.5;
        tail.name = 'tail';
        group.add(tail);
    } else {
        const comb = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.14,0.05), new THREE.MeshLambertMaterial({color:0xff3333}));
        comb.position.set(0, headY + 0.19, headZ);
        group.add(comb);
    }

    group.traverse(obj => {
        if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
        }
    });

    return group;
}

function createCowMesh(type){
    return createAnimalMesh(type || 'cow');
}



function spawnCow(type, options) {
    if (cows.length >= MAX_COWS) return null;

    options = options || {};
    const animalType = type || randomLandAnimalType();

    let sx, sy, sz;

    if (options.x !== undefined && options.y !== undefined && options.z !== undefined) {
        sx = options.x;
        sy = options.y;
        sz = options.z;
    } else {
        let found = false;

        for (let attempt = 0; attempt < 14; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 10 + Math.random() * 15;
            sx = playerPos.x + Math.cos(angle) * dist;
            sz = playerPos.z + Math.sin(angle) * dist;
            sy = getTerrainHeight(Math.floor(sx), Math.floor(sz)) + 1;

            if (!isSafeLandAnimalPosition(sx, sy, sz)) {
                continue;
            }

            found = true;
            break;
        }

        if (!found) return null;
    }

    if (!options.force && !isSafeLandAnimalPosition(sx, sy, sz)) {
        return null;
    }

    const mesh = createAnimalMesh(animalType);
    mesh.position.set(sx, sy, sz);

    if (options.yaw !== undefined) {
        mesh.rotation.y = options.yaw;
    }

    scene.add(mesh);

    const initialDir = new THREE.Vector3(
        Math.sin(mesh.rotation.y),
        0,
        Math.cos(mesh.rotation.y)
    );

    if (initialDir.lengthSq() < 0.001) {
        initialDir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    }
    initialDir.normalize();

    const hp = getLandAnimalHealth(animalType);

    const animal = {
        mesh,
        type: animalType,
        showcaseAnimal: !!options.showcaseAnimal,
        health: options.health || hp,
        maxHealth: options.health || hp,
        hurtTimer: 0,
        walkPhase: Math.random() * Math.PI * 2,
        targetY: sy,
        prevY: sy,
        knockbackVel: new THREE.Vector3(0,0,0),
        aiState: options.aiState || 'idle',
        aiTimer: options.aiTimer !== undefined ? options.aiTimer : 2 + Math.random() * 3,
        wanderDir: options.wanderDir ? options.wanderDir.clone().normalize() : initialDir,
        walkSpeed: options.walkSpeed || getLandAnimalSpeed(animalType),
    };

    cows.push(animal);
    faceLandAnimalAlongVelocity(animal, animal.wanderDir.x, animal.wanderDir.z);

    return animal;
}


function updateCows(dt) {
    const sunAngle = dayTime * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const isDay = sunY > 0;

    // Spawn cows during day
    if (isDay && !playerDead) {
        cowSpawnTimer += dt;
        if (cowSpawnTimer >= 8 && cows.length < MAX_COWS) {
            cowSpawnTimer = 0;
            spawnCow();
        }
    }

    for (let i = cows.length - 1; i >= 0; i--) {
        const cow = cows[i];
        const dx = playerPos.x - cow.mesh.position.x;
        const dz = playerPos.z - cow.mesh.position.z;
        const dist = Math.sqrt(dx*dx + dz*dz);

        // Despawn far cows or at night
        if (dist > 60 || (!isDay && dist > 30)) {
            scene.remove(cow.mesh); cows.splice(i, 1); continue;
        }

        const isKnockback = cow.knockbackVel.lengthSq() > 0.01;

        // AI state machine (skip during knockback)
        if (!isKnockback) {
            cow.aiTimer -= dt;
            switch (cow.aiState) {
                case 'idle':
                    if (cow.aiTimer <= 0) {
                        cow.aiState = 'wander';
                        cow.aiTimer = 2 + Math.random() * 4;
                        cow.wanderDir.set(Math.random()-0.5, 0, Math.random()-0.5).normalize();
                        faceLandAnimalAlongVelocity(cow, cow.wanderDir.x, cow.wanderDir.z);
                    }
                    break;
                case 'wander':
                    if (cow.aiTimer <= 0) {
                        cow.aiState = 'idle'; cow.aiTimer = 2 + Math.random() * 4;
                    } else {
                        const ms = cow.walkSpeed * dt;
                        let nx = cow.mesh.position.x + cow.wanderDir.x * ms;
                        let nz = cow.mesh.position.z + cow.wanderDir.z * ms;
                        const zy = cow.mesh.position.y;
                        if (isSafeLandAnimalPosition(nx, zy, cow.mesh.position.z)) {
                            cow.mesh.position.x = nx;
                        } else {
                            turnLandAnimalAwayFromWater(cow);
                        }

                        if (isSafeLandAnimalPosition(cow.mesh.position.x, zy, nz)) {
                            cow.mesh.position.z = nz;
                        } else {
                            turnLandAnimalAwayFromWater(cow);
                        }
                        faceLandAnimalAlongVelocity(cow, cow.wanderDir.x, cow.wanderDir.z);
                    }
                    break;
                case 'flee':
                    if (cow.aiTimer <= 0) {
                        cow.aiState = 'idle'; cow.aiTimer = 2 + Math.random() * 3;
                    } else {
                        const fd = new THREE.Vector3(-dx, 0, -dz).normalize();
                        const ms = cow.walkSpeed * 3 * dt;
                        let nx = cow.mesh.position.x + fd.x * ms;
                        let nz = cow.mesh.position.z + fd.z * ms;
                        const zy = cow.mesh.position.y;
                        if (isSafeLandAnimalPosition(nx, zy, cow.mesh.position.z)) {
                            cow.mesh.position.x = nx;
                        } else {
                            turnLandAnimalAwayFromWater(cow);
                        }

                        if (isSafeLandAnimalPosition(cow.mesh.position.x, zy, nz)) {
                            cow.mesh.position.z = nz;
                        } else {
                            turnLandAnimalAwayFromWater(cow);
                        }
                        cow.mesh.rotation.y = Math.atan2(fd.x, fd.z);
                    }
                    break;
            }

            // Walking animation
            const isWalking = cow.aiState === 'wander' || cow.aiState === 'flee';
            const animSpd = isWalking ? (cow.aiState === 'flee' ? 8 : 4) : 1;
            cow.walkPhase += dt * animSpd;
            const ls = isWalking ? Math.sin(cow.walkPhase) * 0.6 : 0;
            const bb = isWalking ? Math.abs(Math.sin(cow.walkPhase)) * 0.03 : 0;
            const ts = Math.sin(cow.walkPhase * 0.5) * 0.3;
            cow.mesh.children.forEach(c => {
                if (c.name === 'leftFrontLeg') c.rotation.x = ls;
                if (c.name === 'rightFrontLeg') c.rotation.x = -ls;
                if (c.name === 'leftBackLeg') c.rotation.x = -ls;
                if (c.name === 'rightBackLeg') c.rotation.x = ls;
                if (c.name === 'tail') c.rotation.x = ts;
                if (c.name === 'head') c.rotation.x = isWalking ? Math.sin(cow.walkPhase*0.5)*0.05 : Math.sin(gameTime+i)*0.03;
            });
            cow.mesh.position.y = cow.targetY + bb;
        }

        // Knockback
        if (cow.knockbackVel.lengthSq() > 0.001) {
            cow.mesh.position.y += cow.knockbackVel.y * dt;
            if (isSolid(getBlock(Math.floor(cow.mesh.position.x),Math.floor(cow.mesh.position.y-0.1),Math.floor(cow.mesh.position.z))) && cow.knockbackVel.y < 0) cow.knockbackVel.y = 0;
            let kx = cow.mesh.position.x + cow.knockbackVel.x * dt;
            let kz = cow.mesh.position.z + cow.knockbackVel.z * dt;
            const zy = cow.mesh.position.y;
            if (!isSolid(getBlock(Math.floor(kx),Math.floor(zy),Math.floor(cow.mesh.position.z)))) cow.mesh.position.x = kx;
            else cow.knockbackVel.x *= -0.3;
            if (!isSolid(getBlock(Math.floor(cow.mesh.position.x),Math.floor(zy),Math.floor(kz)))) cow.mesh.position.z = kz;
            else cow.knockbackVel.z *= -0.3;
            cow.knockbackVel.y -= 25 * dt;
            const hs = Math.sqrt(cow.knockbackVel.x*cow.knockbackVel.x + cow.knockbackVel.z*cow.knockbackVel.z);
            cow.knockbackVel.multiplyScalar(hs < 1 ? 0.7 : 0.88);
            if (cow.knockbackVel.lengthSq() < 0.05) cow.knockbackVel.set(0,0,0);
        }

        // Gravity & terrain
        if (!isKnockback || cow.knockbackVel.y <= 0) {
            const gy = getGroundLevel(cow.mesh.position.x, cow.mesh.position.y, cow.mesh.position.z);
            if (cow.mesh.position.y > gy) cow.mesh.position.y += (gy - cow.mesh.position.y) * 0.3;
            cow.targetY = cow.mesh.position.y;
        }

        // Absolute safety: land animal must not stay inside water.
        if (isWaterAtOrNearLandAnimal(cow.mesh.position.x, cow.mesh.position.y, cow.mesh.position.z)) {
            let rescued = false;

            for (let r = 1; r <= 6 && !rescued; r++) {
                for (let a = 0; a < 12 && !rescued; a++) {
                    const ang = (Math.PI * 2 * a) / 12;
                    const tx = cow.mesh.position.x + Math.cos(ang) * r;
                    const tz = cow.mesh.position.z + Math.sin(ang) * r;
                    const ty = getGroundLevel(tx, cow.mesh.position.y + 3, tz);

                    if (isSafeLandAnimalPosition(tx, ty, tz)) {
                        cow.mesh.position.set(tx, ty, tz);
                        cow.targetY = ty;
                        turnLandAnimalAwayFromWater(cow);
                        rescued = true;
                    }
                }
            }

            if (!rescued) {
                scene.remove(cow.mesh);
                cows.splice(i, 1);
                continue;
            }
        }

        // Hurt flash
        if (cow.hurtTimer > 0) {
            cow.hurtTimer -= dt;
            const t = cow.hurtTimer / 0.35;
            const fs = 1 + t * 0.1;
            cow.mesh.scale.set(fs, fs, fs);
            if (!cow.hurtOverlay) {
                cow.hurtOverlay = new THREE.Mesh(new THREE.BoxGeometry(1,1.5,1.4),
                    new THREE.MeshBasicMaterial({color:0xff0000,transparent:true,opacity:0.35,depthTest:true}));
                cow.hurtOverlay.renderOrder = 1; cow.hurtOverlay.position.y = 0.7;
                cow.mesh.add(cow.hurtOverlay);
            }
            cow.hurtOverlay.material.opacity = t * 0.4; cow.hurtOverlay.visible = true;
        } else {
            cow.mesh.scale.set(1,1,1);
            if (cow.hurtOverlay) cow.hurtOverlay.visible = false;
        }

        // Dead? Drop beef
        if (cow.health <= 0) {
            const dc = 1 + Math.floor(Math.random() * 3);
            for (let d = 0; d < dc; d++) {
                spawnAnimalMeatDrop(cow.type || 'cow', cow.mesh.position.x + (Math.random()-0.5)*0.5, cow.mesh.position.y+0.5, cow.mesh.position.z + (Math.random()-0.5)*0.5);
            }
            createExplosionParticles(cow.mesh.position.clone().add(new THREE.Vector3(0,0.5,0)), 0xf5f0e0, 8);
            playSound(300,'sawtooth',0.2,0.08);
            playSound(400+Math.random()*100,'sine',0.15,0.06);
            scene.remove(cow.mesh); cows.splice(i, 1);
        }
    }
}

// ================================================================
// DROP ITEM SYSTEM
// ================================================================
let dropItems=[];
let dropItemGeo,dropItemMaxInst=200;
function ensureDropItemMesh(){
    if(dropItemGeo)return;
    dropItemGeo=new THREE.InstancedMesh(new THREE.BoxGeometry(0.25,0.25,0.25),new THREE.MeshLambertMaterial({color:0xffffff}),dropItemMaxInst);
    dropItemGeo.count=0;dropItemGeo.castShadow=false;
    scene.add(dropItemGeo);
}

function spawnDropItem(blockType,x,y,z){
    const bd=getItemData(blockType);if(!bd)return;
    ensureDropItemMesh();
    if(dropItems.length>=dropItemMaxInst)return;
    const cl=bd.color;
    dropItems.push({
        blockType:blockType,
        pos:new THREE.Vector3(x+0.5,y+0.5,z+0.5),
        vel:new THREE.Vector3((Math.random()-0.5)*2,3+Math.random()*2,(Math.random()-0.5)*2),
        life:60,spinPhase:Math.random()*Math.PI*2,
        color:new THREE.Color(cl[0],cl[1],cl[2])
    });
}

function spawnAnimalMeatDrop(animalType,x,y,z){
    const meatItem = typeof getMeatItemForAnimal === 'function'
        ? getMeatItemForAnimal(animalType)
        : ITEM.BEEF;

    spawnDropItem(meatItem,x,y,z);
}

function updateDropItems(dt){
    if(!dropItemGeo)return;
    const dummy=new THREE.Object3D();
    const colorArr=new Float32Array(dropItemMaxInst*3);
    let idx=0;
    for(let i=dropItems.length-1;i>=0;i--){
        const item=dropItems[i];
        item.life-=dt;
        if(item.life<=0){dropItems.splice(i,1);continue;}
        item.vel.y-=20*dt;
        item.pos.x+=item.vel.x*dt;item.pos.y+=item.vel.y*dt;item.pos.z+=item.vel.z*dt;
        const gy=getGroundLevel(item.pos.x,item.pos.y,item.pos.z);
        if(item.pos.y<gy){item.pos.y=gy;item.vel.y*=-0.3;item.vel.x*=0.8;item.vel.z*=0.8;if(Math.abs(item.vel.y)<0.5)item.vel.y=0;}
        if(item.vel.y===0)item.pos.y=gy+Math.sin(item.spinPhase+gameTime*3)*0.1;
        const dx=playerPos.x-item.pos.x,dy=playerPos.y+0.8-item.pos.y,dz=playerPos.z-item.pos.z;
        const dist=Math.sqrt(dx*dx+dy*dy+dz*dz);
        if(dist<1.5){
            const bt=item.blockType;if(!playerInventory[bt])playerInventory[bt]=0;playerInventory[bt]++;
            showPickupToast(bt);playSound(600,'sine',0.1,0.06);playSound(800,'sine',0.08,0.04);
            dropItems.splice(i,1);buildHotbarUI();continue;
        }
        if(idx>=dropItemMaxInst){dropItems.splice(i,1);continue;}
        // Rotation via matrix
        dummy.position.copy(item.pos);
        dummy.rotation.set(0,gameTime*1.5+item.spinPhase,0);
        dummy.updateMatrix();
        dropItemGeo.setMatrixAt(idx,dummy.matrix);
        colorArr[idx*3]=item.color.r;colorArr[idx*3+1]=item.color.g;colorArr[idx*3+2]=item.color.b;
        idx++;
    }
    dropItemGeo.count=idx;
    dropItemGeo.instanceMatrix.needsUpdate=true;
    if(dropItemGeo.instanceColor){dropItemGeo.instanceColor.needsUpdate=true;}
    if(!dropItemGeo.instanceColor)dropItemGeo.instanceColor=new THREE.InstancedBufferAttribute(colorArr,3);
    else{for(let i=0;i<colorArr.length;i++)dropItemGeo.instanceColor.array[i]=colorArr[i];dropItemGeo.instanceColor.needsUpdate=true;}
}

// ================================================================
// PARTICLES
// ================================================================
function createExplosionParticles(pos, color, count) {
    for (let i = 0; i < count; i++) {
        const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true });
        const p = new THREE.Mesh(geo, mat);
        p.position.copy(pos);
        p.userData = {
            vel: new THREE.Vector3((Math.random()-0.5)*0.3, Math.random()*0.2, (Math.random()-0.5)*0.3),
            life: 0.5 + Math.random() * 0.5
        };
        scene.add(p);
        if (!window._particles) window._particles = [];
        window._particles.push(p);
    }
}

function updateParticles(dt) {
    if (!window._particles) return;
    for (let i = window._particles.length - 1; i >= 0; i--) {
        const p = window._particles[i];
        p.position.add(p.userData.vel);
        p.userData.vel.y -= 0.01;
        p.userData.life -= dt;
        p.material.opacity = Math.max(0, p.userData.life);
        if (p.userData.life <= 0) {
            scene.remove(p);
            p.geometry.dispose();
            p.material.dispose();
            window._particles.splice(i, 1);
        }
    }
}


// Allow other animal systems to reuse the matching meat drop helper.
window.spawnAnimalMeatDrop = spawnAnimalMeatDrop;
