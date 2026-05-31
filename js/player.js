// ================================================================
// PLAYER GLOBALS
// ================================================================
let playerPos=new THREE.Vector3(0,40,0);
let playerVel=new THREE.Vector3(0,0,0);
let yaw=0,pitch=0;
let onGround=false,playerDead=false;
let inWater=false;
let fallStartY=0,wasOnGround=false;
let selectedSlot=0;
let hotbarItems=[BLOCK.SWORD,BLOCK.AIR,BLOCK.AIR,BLOCK.AIR,BLOCK.AIR,BLOCK.AIR,BLOCK.AIR,BLOCK.AIR,BLOCK.AIR];
let playerInventory={};
let playerHealth=100;
let playerMaxHealth=100;
let playerAttackCooldown=0;
let playerAttackRange=6;
let playerDamage=25;
let invulnTimer=0;
let deathCause='';

// Sword
let swordMesh,swordSwingTime=0,swordPivot;
// Inventory
let inventoryOpen=false;

// ================================================================
// PLAYER PHYSICS
// ================================================================
function updatePlayer(dt){
    if(!isLocked||playerDead)return;
    // dt is now consistently PHYSICS_STEP (0.02) from the main loop
    const gravity=-20,jumpForce=8,pw=0.25,ph=1.7;
    
    // === WATER DETECTION ===
    const feetBlock=getBlock(Math.floor(playerPos.x),Math.floor(playerPos.y),Math.floor(playerPos.z));
    const headBlock=getBlock(Math.floor(playerPos.x),Math.floor(playerPos.y+1),Math.floor(playerPos.z));
    const wasInWater=inWater;
    inWater=(feetBlock===BLOCK.WATER||headBlock===BLOCK.WATER);
    
    
    // === CREATIVE FLIGHT ===
    // Creative mode is a true free-fly mode:
    // - no gravity
    // - no damage / fall damage
    // - hold Space to fly up
    // - hold Shift to descend gently
    if(typeof gameMode !== 'undefined' && gameMode === 'creative'){
        const creativeSpeed = (keys['ControlLeft'] || keys['ControlRight']) ? 14 : 9;
        const creativeVerticalSpeed = 5.2;

        const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        let moveDir = new THREE.Vector3(0, 0, 0);

        if(keys['KeyW']) moveDir.add(forward);
        if(keys['KeyS']) moveDir.sub(forward);
        if(keys['KeyA']) moveDir.sub(right);
        if(keys['KeyD']) moveDir.add(right);

        if(moveDir.lengthSq() > 0) moveDir.normalize();

        playerVel.x = moveDir.x * creativeSpeed;
        playerVel.z = moveDir.z * creativeSpeed;
        playerVel.y = 0;

        if(keys['Space']){
            playerVel.y = creativeVerticalSpeed;
        }else if(keys['ShiftLeft'] || keys['ShiftRight']){
            playerVel.y = -creativeVerticalSpeed * 0.72;
        }

        playerPos.x += playerVel.x * dt;
        playerPos.y += playerVel.y * dt;
        playerPos.z += playerVel.z * dt;

        if(playerPos.y < 2){
            playerPos.y = 2;
            playerVel.y = 0;
        }

        onGround = false;
        wasOnGround = false;
        fallStartY = playerPos.y;

        camera.position.copy(playerPos);
        camera.position.y += ph - 0.2;

        const lookDir = new THREE.Vector3(
            -Math.sin(yaw) * Math.cos(pitch),
            Math.sin(pitch),
            -Math.cos(yaw) * Math.cos(pitch)
        );

        camera.lookAt(camera.position.clone().add(lookDir));

        if(invulnTimer > 0) invulnTimer -= dt;
        if(playerAttackCooldown > 0) playerAttackCooldown -= dt;

        return;
    }

// Reset fall tracking when entering water (water breaks falls)
    // Khi đã chạm nước thì rơi xuống đáy hồ không được tính fall damage nữa.
    if(inWater){
        fallStartY=playerPos.y;
        wasOnGround=false;
    }

    if(inWater&&!wasInWater){
        playerVel.y=Math.max(playerVel.y * 0.25, -1.2); // kill downward momentum safely
    }
    
    // === SWIMMING PHYSICS ===
    let speed=keys['ShiftLeft']?8:5;
    let swimGravity=gravity;
    if(inWater){
        speed*=0.5; // slow in water
        swimGravity=-4; // reduced gravity in water
        // Buoyancy: push up when below water surface
        const waterSurfaceY=Math.floor(playerPos.y)+1;
        const feetBlockAbove=getBlock(Math.floor(playerPos.x),waterSurfaceY,Math.floor(playerPos.z));
        if(feetBlockAbove!==BLOCK.WATER&&playerPos.y<waterSurfaceY){
            // At water surface - float up gently
            swimGravity=-2;
            // Apply upward velocity to float at water level
            if(playerVel.y<-1){
                playerVel.y*=0.85; // dampen downward velocity
            }
            if(keys['Space']){
                playerVel.y=3; // swim up
            }
        } else {
            // Fully underwater
            if(keys['Space']){
                playerVel.y=3.5; // swim up faster
            } else if(playerVel.y<-2){
                playerVel.y=-2; // limit sinking speed
            }
        }
        // Dampen horizontal velocity in water
        playerVel.x*=0.9;
        playerVel.z*=0.9;
    }
    
    const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
    const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    let moveDir=new THREE.Vector3(0,0,0);
    if(keys['KeyW'])moveDir.add(forward);if(keys['KeyS'])moveDir.sub(forward);
    if(keys['KeyA'])moveDir.sub(right);if(keys['KeyD'])moveDir.add(right);
    if(moveDir.lengthSq()>0)moveDir.normalize();
    playerVel.x=moveDir.x*speed;playerVel.z=moveDir.z*speed;
    
    if(!inWater){
        // Normal gravity when not in water
        playerVel.y+=gravity*dt;
        if(keys['Space']&&onGround){playerVel.y=jumpForce;onGround=false;}
    } else {
        // Water gravity
        playerVel.y+=swimGravity*dt;
    }
    
    // === FALL DAMAGE TRACKING ===
    if(onGround&&!wasOnGround){
        // Just landed.
        // Nếu đang ở trong nước hoặc vừa đáp xuống đáy hồ bên dưới mặt nước,
        // không tính fall damage. Nước phải triệt tiêu cú rơi như Minecraft.
        const feetWater = getBlock(Math.floor(playerPos.x), Math.floor(playerPos.y), Math.floor(playerPos.z)) === BLOCK.WATER;
        const headWater = getBlock(Math.floor(playerPos.x), Math.floor(playerPos.y + 1), Math.floor(playerPos.z)) === BLOCK.WATER;
        const justLandedInWaterColumn = inWater || feetWater || headWater;

        if(!justLandedInWaterColumn){
            const fallDist=fallStartY-playerPos.y;
            if(fallDist>3){
                const fallDamage=Math.round((fallDist-3)*5);
                if(fallDamage>0){
                    damagePlayer(fallDamage,'Rơi từ trên cao');
                    playSound(80,'square',0.2,0.1); // landing thud
                    createExplosionParticles(playerPos.clone(),0x888888,5); // dust
                }
            }
        }else{
            fallStartY=playerPos.y;
        }
    }

    // Track when player starts falling.
    // Khi đang ở trong nước cũng reset liên tục để không tích fall distance dưới đáy hồ.
    if(onGround || inWater){
        fallStartY=playerPos.y;
    }

    wasOnGround=onGround && !inWater;
    
    // === SUB-STEP COLLISION (prevents wall clipping) ===
    const steps=Math.max(1,Math.ceil((Math.abs(playerVel.x)+Math.abs(playerVel.y)+Math.abs(playerVel.z))*dt/0.35));
    const subDt=dt/steps;
    for(let s=0;s<steps;s++){
        // Move X
        playerPos.x+=playerVel.x*subDt;
        if(collidesSolid(playerPos,pw,ph)){
            const st=playerPos.clone();st.y+=0.5;
            if(!collidesSolid(st,pw,ph)&&onGround){playerPos.y+=0.5;onGround=false;}
            else{playerPos.x-=playerVel.x*subDt;playerVel.x=0;}
        }
        // Move Z
        playerPos.z+=playerVel.z*subDt;
        if(collidesSolid(playerPos,pw,ph)){
            const st=playerPos.clone();st.y+=0.5;
            if(!collidesSolid(st,pw,ph)&&onGround){playerPos.y+=0.5;onGround=false;}
            else{playerPos.z-=playerVel.z*subDt;playerVel.z=0;}
        }
        // Move Y
        playerPos.y+=playerVel.y*subDt;
        if(collidesSolid(playerPos,pw,ph)){
            if(playerVel.y<0)onGround=true;
            playerPos.y-=playerVel.y*subDt;
            playerVel.y=0;
        }else{onGround=false;}
    }
    
    // Water floor: don't fall below y=1
    if(playerPos.y<1){playerPos.y=1;playerVel.y=0;onGround=true;}
    
    camera.position.copy(playerPos);camera.position.y+=ph-0.2;
    const lookDir=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
    camera.lookAt(camera.position.clone().add(lookDir));

    // Invulnerability timer
    if(invulnTimer>0)invulnTimer-=dt;
    // Attack cooldown
    if(playerAttackCooldown>0)playerAttackCooldown-=dt;

    // Health regen (slow, only when not in water)
    if(playerHealth<playerMaxHealth&&invulnTimer<=0&&!inWater){
        playerHealth=Math.min(playerMaxHealth,playerHealth+dt*0.5);
        updateHealthUI();
    }
}

function collides(pos,w,h){
    const mnx=Math.floor(pos.x-w),mxx=Math.floor(pos.x+w),mny=Math.floor(pos.y),mxy=Math.floor(pos.y+h),mnz=Math.floor(pos.z-w),mxz=Math.floor(pos.z+w);
    for(let x=mnx;x<=mxx;x++)for(let y=mny;y<=mxy;y++)for(let z=mnz;z<=mxz;z++){if(isSolid(getBlock(x,y,z)))return true;}return false;
}
// Better collision: uses continuous overlap test with slight inset
function collidesSolid(pos,w,h){
    const eps=0.001;
    const mnx=Math.floor(pos.x-w+eps),mxx=Math.floor(pos.x+w-eps),mny=Math.floor(pos.y+eps),mxy=Math.floor(pos.y+h-eps),mnz=Math.floor(pos.z-w+eps),mxz=Math.floor(pos.z+w-eps);
    for(let x=mnx;x<=mxx;x++)for(let y=mny;y<=mxy;y++)for(let z=mnz;z<=mxz;z++){if(isSolid(getBlock(x,y,z)))return true;}return false;
}

function damagePlayer(amount, cause) {
    if (playerDead) return;

    // Creative/showcase/god mode must not take damage.
    if ((typeof gameMode !== 'undefined' && gameMode !== 'survival') || (typeof godMode !== 'undefined' && godMode)) {
        return;
    }

    if (invulnTimer > 0) return;
    playerHealth -= amount;
    invulnTimer = 0.5;
    deathCause = cause || 'Zombie đã tiêu diệt bạn';
    playSound(150, 'sawtooth', 0.15, 0.12);

    // Damage flash
    const overlay = document.getElementById('damageOverlay');
    if (overlay) {
        overlay.classList.add('hit');
        setTimeout(() => overlay.classList.remove('hit'), 200);
    }

    if (playerHealth <= 0) {
        playerHealth = 0;
        playerDied();
    }
    updateHealthUI();
}

function playerDied() {
    playerDead = true;
    const deathKills = document.getElementById('deathKills');
    if (deathKills) deathKills.textContent = totalKills;
    const deathWave = document.getElementById('deathWave');
    if (deathWave) deathWave.textContent = zombieWave;
    const deathCauseEl = document.getElementById('deathCause');
    if (deathCauseEl) deathCauseEl.textContent = deathCause;
    const deathScreen = document.getElementById('deathScreen');
    if (deathScreen) deathScreen.classList.add('show');
    document.exitPointerLock();
}

function respawnPlayer() {
    playerHealth = playerMaxHealth;
    playerDead = false;
    invulnTimer = 3;
    playerPos.set(0, getTerrainHeight(0, 0) + 3, 0);
    const deathScreen = document.getElementById('deathScreen');
    if (deathScreen) deathScreen.classList.remove('show');
    updateHealthUI();
    renderer.domElement.requestPointerLock();
}

function attackNearestEntity() {
    if (playerAttackCooldown > 0 || playerDead) return;
    playerAttackCooldown = 0.4;

    const dir = new THREE.Vector3(
        -Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch)
    ).normalize();

    let closestDist = playerAttackRange;
    let closestTarget = null; // { type: 'cow'|'zombie'|'aquatic', index: number }

    // Check cows
    if (typeof cows !== 'undefined') {
        for (let i = 0; i < cows.length; i++) {
            const cow = cows[i];
            const toCow = cow.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0)).sub(camera.position);
            const dist = toCow.length();
            if (dist > playerAttackRange) continue;

            toCow.normalize();
            const dot = dir.dot(toCow);

            if (dot > 0.7 && dist < closestDist) {
                closestDist = dist;
                closestTarget = { type: 'cow', index: i };
            }
        }
    }

    // Check zombies
    if (typeof zombies !== 'undefined') {
        for (let i = 0; i < zombies.length; i++) {
            const z = zombies[i];
            const toZ = z.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0)).sub(camera.position);
            const dist = toZ.length();
            if (dist > playerAttackRange) continue;

            toZ.normalize();
            const dot = dir.dot(toZ);

            if (dot > 0.7 && dist < closestDist) {
                closestDist = dist;
                closestTarget = { type: 'zombie', index: i };
            }
        }
    }

    // Check aquatic animals.
    // Quan trọng: dưới nước raycast thường không bắt được block/entity như trên cạn,
    // nên phải check trực tiếp hướng nhìn camera -> aquatic mesh.
    if (typeof aquaticAnimals !== 'undefined') {
        for (let i = 0; i < aquaticAnimals.length; i++) {
            const a = aquaticAnimals[i];
            if (!a || !a.mesh) continue;

            const hitOffsetY = a.type === 'squid' ? 0.35 : 0.15;
            const toAquatic = a.mesh.position.clone().add(new THREE.Vector3(0, hitOffsetY, 0)).sub(camera.position);
            const dist = toAquatic.length();

            // Cho dưới nước dễ chém hơn một chút.
            const aquaticRange = playerAttackRange + 0.9;
            if (dist > aquaticRange) continue;

            toAquatic.normalize();
            const dot = dir.dot(toAquatic);

            // Cá/rùa/mực nhỏ và di chuyển liên tục, threshold rộng hơn cow/zombie.
            if (dot > 0.55 && dist < closestDist + 0.9) {
                closestDist = dist;
                closestTarget = { type: 'aquatic', index: i };
            }
        }
    }

    if (closestTarget) {
        if (closestTarget.type === 'cow') {
            const cow = cows[closestTarget.index];
            const kbDir = cow.mesh.position.clone().sub(camera.position).normalize();

            cow.health -= playerDamage;
            cow.hurtTimer = 0.35;
            cow.aiState = 'flee';
            cow.aiTimer = 3;

            playSound(200 + Math.random() * 60, 'sawtooth', 0.2, 0.1);
            playSound(300, 'square', 0.05, 0.05);

            cow.knockbackVel.set(kbDir.x * 12, 3, kbDir.z * 12);
        } else if (closestTarget.type === 'zombie') {
            const z = zombies[closestTarget.index];
            const kbDir = z.mesh.position.clone().sub(camera.position).normalize();

            z.health -= playerDamage;
            z.hurtTimer = 0.35;

            playSound(180 + Math.random() * 80, 'sawtooth', 0.15, 0.1);
            playSound(400, 'square', 0.05, 0.06);

            z.knockbackVel.set(kbDir.x * 18, 4, kbDir.z * 18);
        } else if (closestTarget.type === 'aquatic') {
            const a = aquaticAnimals[closestTarget.index];

            if (typeof damageAquaticAnimal === 'function') {
                damageAquaticAnimal(a, playerDamage, camera.position);
            }
        }
    }

    // Trigger sword swing animation
    if(hotbarItems[selectedSlot]===BLOCK.SWORD){swordSwingTime=0.3;}
}

// ================================================================
// SWORD SYSTEM
// ================================================================
function createSwordMesh(){
    swordPivot=new THREE.Group();
    swordMesh=new THREE.Group();
    // Blade
    const bladeGeo=new THREE.BoxGeometry(0.08,0.7,0.02);
    const bladeMat=new THREE.MeshLambertMaterial({color:0xccccdd});
    const blade=new THREE.Mesh(bladeGeo,bladeMat);
    blade.position.y=0.35;
    swordMesh.add(blade);
    // Blade tip
    const tipGeo=new THREE.BoxGeometry(0.06,0.15,0.02);
    const tipMat=new THREE.MeshLambertMaterial({color:0xaaaacc});
    const tip=new THREE.Mesh(tipGeo,tipMat);
    tip.position.y=0.78;
    swordMesh.add(tip);
    // Guard
    const guardGeo=new THREE.BoxGeometry(0.3,0.06,0.06);
    const guardMat=new THREE.MeshLambertMaterial({color:0x8B6914});
    const guard=new THREE.Mesh(guardGeo,guardMat);
    guard.position.y=0.0;
    swordMesh.add(guard);
    // Handle
    const handleGeo=new THREE.BoxGeometry(0.08,0.3,0.06);
    const handleMat=new THREE.MeshLambertMaterial({color:0x5C3A1E});
    const handle=new THREE.Mesh(handleGeo,handleMat);
    handle.position.y=-0.18;
    swordMesh.add(handle);
    // Pommel
    const pommelGeo=new THREE.BoxGeometry(0.12,0.06,0.06);
    const pommelMat=new THREE.MeshLambertMaterial({color:0x8B6914});
    const pommel=new THREE.Mesh(pommelGeo,pommelMat);
    pommel.position.y=-0.35;
    swordMesh.add(pommel);
    // Position: bottom-right, tilted
    swordPivot.position.set(0.4,-0.35,-0.5);
    swordPivot.rotation.set(0,0,-0.3);
    swordMesh.rotation.x=0.1;
    swordPivot.add(swordMesh);
    camera.add(swordPivot);
}

function updateSwordAnimation(dt){
    if(!swordPivot)return;
    const isSwordSelected=hotbarItems[selectedSlot]===BLOCK.SWORD;
    swordPivot.visible=isSwordSelected;
    if(!isSwordSelected)return;
    if(swordSwingTime>0){
        swordSwingTime-=dt;
        const total=0.3;
        const t=1-Math.max(0,swordSwingTime/total);
        // 3-phase swing: wind-up → thrust forward slash → return
        let px,py,pz,rx,ry,rz,sx;
        if(t<0.15){
            // Phase 1: Wind up - pull back and raise
            const p=t/0.15;
            const ep=p*p*(3-2*p); // smoothstep
            px=0.4+ep*0.15;
            py=-0.35+ep*0.2;
            pz=-0.5+ep*0.2;
            rx=ep*0.3;
            ry=-ep*0.1;
            rz=-0.3+ep*0.2;
            sx=0.1+ep*0.4;
        }else if(t<0.5){
            // Phase 2: Thrust forward and slash down
            const p=(t-0.15)/0.35;
            const ep=p*p*(3-2*p);
            px=0.55-ep*0.45;
            py=-0.15-ep*0.5;
            pz=-0.3-ep*0.4;
            rx=0.3-ep*1.4;
            ry=-0.1+ep*0.5;
            rz=-0.1-ep*0.4;
            sx=0.5-ep*1.3;
        }else{
            // Phase 3: Return to idle
            const p=(t-0.5)/0.5;
            const ep=p*p*(3-2*p);
            px=0.1+ep*0.3;
            py=-0.65+ep*0.3;
            pz=-0.7+ep*0.2;
            rx=-1.1+ep*1.2;
            ry=0.4-ep*0.4;
            rz=-0.5+ep*0.2;
            sx=-0.8+ep*0.9;
        }
        swordPivot.position.set(px,py,pz);
        swordPivot.rotation.set(rx,ry,rz);
        swordMesh.rotation.x=sx;
    }else{
        // Idle bob + slight sway
        const bob=Math.sin(gameTime*2)*0.015;
        const sway=Math.sin(gameTime*1.3)*0.008;
        swordPivot.position.set(0.4+sway,-0.35+bob,-0.5);
        swordPivot.rotation.set(0.08*sway,0,-0.3+sway*0.5);
        swordMesh.rotation.x=0.1;
    }
}

// ================================================================
// INVENTORY SYSTEM
// ================================================================
function toggleInventory(){
    if(!gameStarted||playerDead)return;
    inventoryOpen=!inventoryOpen;
    const overlay=document.getElementById('inventoryOverlay');
    if(inventoryOpen){
        document.exitPointerLock();
        overlay.classList.add('show');
        renderInventory();
    }else{
        overlay.classList.remove('show');
        renderer.domElement.requestPointerLock();
    }
}

function renderInventory(){
    // Render hotbar in inventory (drop targets)
    const hb=document.getElementById('inventoryHotbar');
    if (!hb) return;
    hb.innerHTML='';
    for(let i=0;i<9;i++){
        const s=document.createElement('div');
        s.className='inv-slot'+(i===selectedSlot?' selected':'');
        s.dataset.slotIndex=i;
        const item=hotbarItems[i];
        if(item===BLOCK.SWORD){
            const icon=document.createElement('div');icon.className='sword-icon';icon.textContent='⚔';s.appendChild(icon);
        }else if(isFoodItem(item)){
            const icon=document.createElement('div');icon.className='sword-icon';icon.textContent='🥩';icon.style.color='#c44';s.appendChild(icon);
            const cnt=playerInventory[item]||0;
            if(cnt>0){const cs=document.createElement('span');cs.className='slot-count';cs.textContent=cnt;s.appendChild(cs);}
        }else if(item!==BLOCK.AIR&&BLOCK_DATA[item]){
            const bd=BLOCK_DATA[item];
            const cl=document.createElement('div');cl.className='slot-color';
            const c=bd.color;cl.style.background=`rgb(${c[0]*255},${c[1]*255},${c[2]*255})`;
            s.appendChild(cl);
            const cnt=playerInventory[item]||0;
            if(cnt>0){const cs=document.createElement('span');cs.className='slot-count';cs.textContent=cnt;s.appendChild(cs);}
        }
        s.title='Slot '+(i+1)+(item===BLOCK.SWORD?' (Kiếm)':isFoodItem(item)?' ('+ITEM_DATA[item].name+')':'');
        // Click to remove item from slot
        s.addEventListener('click',()=>{
            if(item!==BLOCK.SWORD&&item!==BLOCK.AIR){
                hotbarItems[i]=BLOCK.AIR;
                renderInventory();buildHotbarUI();
            }
        });
        // Drag & drop target for hotbar slots
        s.addEventListener('dragover',(e)=>{e.preventDefault();if(i!==0)s.classList.add('drop-target');});
        s.addEventListener('dragleave',()=>{s.classList.remove('drop-target');});
        s.addEventListener('drop',(e)=>{
            e.preventDefault();s.classList.remove('drop-target');
            if(i===0)return; // can't replace sword slot
            const blockType=parseInt(e.dataTransfer.getData('text/plain'));
            if(!isNaN(blockType)&&(BLOCK_DATA[blockType]||ITEM_DATA[blockType])){
                hotbarItems[i]=blockType;
                renderInventory();buildHotbarUI();updateHotbarSelection();
            }
        });
        hb.appendChild(s);
    }
    // Render block grid - only show items that player actually has (count > 0)
    const grid=document.getElementById('inventoryGrid');
    if (!grid) return;
    grid.innerHTML='';
    const ownedBlocks=Object.keys(playerInventory).map(Number).filter(b=>playerInventory[b]>0&&(BLOCK_DATA[b]&&BLOCK_DATA[b].solid||isFoodItem(b)));
    const ownedFood=Object.keys(playerInventory).map(Number).filter(b=>playerInventory[b]>0&&isFoodItem(b));
    const ownedItems=[...ownedBlocks.filter(b=>!isFoodItem(b)),...ownedFood];
    if(ownedItems.length===0){
        const empty=document.createElement('div');empty.className='inv-empty-msg';
        empty.textContent='Kho đồ trống - Phá block để thu thập vật phẩm!';
        grid.appendChild(empty);
    }
    for(const bt of ownedItems){
        const bd=BLOCK_DATA[bt]||ITEM_DATA[bt];
        const count=playerInventory[bt]||0;
        const div=document.createElement('div');div.className='inv-block-item';
        div.draggable=true;
        div.dataset.blockType=bt;
        const cl=document.createElement('div');cl.className='item-color';
        if(isFoodItem(bt)){
            cl.textContent='🥩';cl.style.fontSize='32px';cl.style.lineHeight='36px';cl.style.background='none';
        }else{
            const c=bd.color;cl.style.background=`rgb(${c[0]*255},${c[1]*255},${c[2]*255})`;
        }
        div.appendChild(cl);
        const nm=document.createElement('div');nm.className='item-name';nm.textContent=bd.name;
        div.appendChild(nm);
        const cnt=document.createElement('div');cnt.className='item-count';cnt.textContent='x'+count;
        div.appendChild(cnt);
        // Drag start
        div.addEventListener('dragstart',(e)=>{
            e.dataTransfer.setData('text/plain',String(bt));
            e.dataTransfer.effectAllowed='copy';
            div.style.opacity='0.4';
        });
        div.addEventListener('dragend',()=>{div.style.opacity='1';});
        // Click to assign to selected slot
        div.addEventListener('click',()=>{
            if(selectedSlot===0)return;
            hotbarItems[selectedSlot]=bt;
            renderInventory();buildHotbarUI();updateHotbarSelection();
        });
        grid.appendChild(div);
    }
}
