// ================================================================
// CORE GLOBALS
// ================================================================
let scene,camera,renderer,clock;
let isLocked=false,gameStarted=false,showDebug=false;
let gamePaused=false;
let dayTime=0.3;
let lastDayTime=0.3;
let gameTime=0;
let keys={},mouseButtons={},pendingClicks={};
let highlightMesh,sunLight,ambientLight;
let sunTarget;
let playerShadowMesh;
let shadowSetupTimer=0;
let fpsFrames=0,fpsTime=0,fpsValue=60;
let noise,noise2,noise3;

// ================================================================
// GAME MODES
// ================================================================
let gameMode = 'survival'; // survival | creative | showcase
let godMode = false;
let showcaseBaseY = 32;

// ================================================================
// SHOWCASE DECOR GLOBALS
// ================================================================
let showcaseHintVisible = true;
let showcaseLabels = [];
let showcaseTorches = [];
let showcaseDecorGroup = null;

// ================================================================
// DAY/NIGHT CONSTANTS
// ================================================================
const DAY_NIGHT_SPEED = 0.00125;       // 1 vòng ngày/đêm khoảng 13 phút
const DAY_NIGHT_FAST_MULTIPLIER = 80;  // giữ T để tua nhanh nhưng không quá gắt

// ================================================================
// TORCH CONSTANTS
// ================================================================
const TORCH_LIGHT_INTENSITY = 2.45;
const TORCH_LIGHT_DISTANCE = 30;
const TORCH_LIGHT_DECAY = 1.25;

const TORCH_FILL_INTENSITY = 0.85;
const TORCH_FILL_DISTANCE = 22;
const TORCH_FILL_DECAY = 1.05;

const TORCH_NIGHT_DISTANCE_BOOST = 16;
const TORCH_NIGHT_FILL_DISTANCE_BOOST = 18;
const TORCH_NIGHT_FILL_INTENSITY_BOOST = 0.85;

const TORCH_FLICKER_AMOUNT = 0.06;

// ================================================================
// INPUT / IME SHIELD
// ================================================================
let gameInputShieldEnabled = false;

function isEditableElement(el){
    if(!el) return false;

    const tag = (el.tagName || '').toLowerCase();

    return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        el.isContentEditable
    );
}

function blurEditableElements(){
    const active = document.activeElement;

    if(isEditableElement(active)){
        active.blur();
    }
}

function preventGameTextInput(e){
    if(!gameInputShieldEnabled) return;
    if(isEditableElement(e.target)) return;

    if(gameStarted && !gamePaused){
        e.preventDefault();
        e.stopPropagation();
    }
}

function enableGameInputShield(){
    if(gameInputShieldEnabled) return;

    gameInputShieldEnabled = true;

    document.documentElement.setAttribute('lang','en');
    document.body.setAttribute('spellcheck','false');
    document.body.style.imeMode = 'disabled';

    blurEditableElements();

    document.addEventListener('compositionstart', preventGameTextInput, true);
    document.addEventListener('compositionupdate', preventGameTextInput, true);
    document.addEventListener('compositionend', preventGameTextInput, true);
    document.addEventListener('beforeinput', preventGameTextInput, true);
    document.addEventListener('input', preventGameTextInput, true);
}

function disableGameInputShield(){
    gameInputShieldEnabled = false;

    document.removeEventListener('compositionstart', preventGameTextInput, true);
    document.removeEventListener('compositionupdate', preventGameTextInput, true);
    document.removeEventListener('compositionend', preventGameTextInput, true);
    document.removeEventListener('beforeinput', preventGameTextInput, true);
    document.removeEventListener('input', preventGameTextInput, true);
}

// ================================================================
// AUDIO
// ================================================================
let audioCtx;
function initAudio(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();}

function playSound(freq,type,dur,vol){
    if(!audioCtx)return;
    try{
        const o=audioCtx.createOscillator(),g=audioCtx.createGain();
        o.connect(g);
        g.connect(audioCtx.destination);
        const t=audioCtx.currentTime;
        o.type=type||'square';
        o.frequency.setValueAtTime(freq||200,t);
        o.frequency.exponentialRampToValueAtTime(40,t+(dur||0.2));
        g.gain.setValueAtTime(vol||0.08,t);
        g.gain.exponentialRampToValueAtTime(0.001,t+(dur||0.2));
        o.start(t);
        o.stop(t+(dur||0.2));
    }catch(e){}
}

// ================================================================
// SHADOW SYSTEM
// ================================================================
function setupRendererShadows(){
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = true;
}

function setupSunShadow(){
    sunLight.castShadow = true;

    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;

    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 420;

    sunLight.shadow.camera.left = -90;
    sunLight.shadow.camera.right = 90;
    sunLight.shadow.camera.top = 90;
    sunLight.shadow.camera.bottom = -90;

    sunLight.shadow.bias = -0.00035;
    sunLight.shadow.normalBias = 0.025;

    sunTarget = new THREE.Object3D();
    sunTarget.position.set(0,0,0);
    scene.add(sunTarget);

    sunLight.target = sunTarget;
    scene.add(sunLight.target);
}

function createPlayerShadow(){
    const geom = new THREE.CircleGeometry(1, 32);
    const mat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.20,
        depthWrite: false
    });

    playerShadowMesh = new THREE.Mesh(geom, mat);
    playerShadowMesh.rotation.x = -Math.PI / 2;
    playerShadowMesh.renderOrder = 30;
    playerShadowMesh.visible = false;
    playerShadowMesh.userData.isPlayerFakeShadow = true;

    scene.add(playerShadowMesh);
}

function getGroundYBelowPlayer(){
    const x = Math.floor(playerPos.x);
    const z = Math.floor(playerPos.z);
    const startY = Math.min(WORLD_HEIGHT - 1, Math.floor(playerPos.y));

    for(let y=startY;y>=1;y--){
        const b = getBlock(x,y,z);

        if(b !== BLOCK.AIR && b !== BLOCK.WATER){
            return y + 1;
        }
    }

    return 1;
}

function updatePlayerShadow(){
    if(!playerShadowMesh || !gameStarted || playerDead){
        if(playerShadowMesh) playerShadowMesh.visible = false;
        return;
    }

    const sunAngle = dayTime * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle);
    const sunZ = 0.4;

    if(sunY <= 0.04){
        playerShadowMesh.visible = false;
        return;
    }

    const groundY = getGroundYBelowPlayer();

    if(playerPos.y - groundY > 6){
        playerShadowMesh.visible = false;
        return;
    }

    const sunHorizontal = new THREE.Vector2(sunX, sunZ).normalize();
    const shadowDir = sunHorizontal.clone().multiplyScalar(-1);

    const length = Math.max(0.45, Math.min(3.8, 1.05 / (sunY + 0.16)));
    const width = 0.36 + Math.max(0, 0.25 - sunY * 0.12);

    const offsetX = shadowDir.x * length * 0.32;
    const offsetZ = shadowDir.y * length * 0.32;

    playerShadowMesh.position.set(
        playerPos.x + offsetX,
        groundY + 0.018,
        playerPos.z + offsetZ
    );

    const angle = Math.atan2(shadowDir.y, shadowDir.x);
    playerShadowMesh.rotation.set(-Math.PI / 2, 0, angle);

    playerShadowMesh.scale.set(length, width, 1);

    playerShadowMesh.material.opacity = Math.max(0.05, Math.min(0.20, sunY * 0.20));
    playerShadowMesh.visible = true;
}

function applyShadowFlagsToScene(){
    scene.traverse(obj=>{
        if(!obj.isMesh) return;
        if(obj.userData && obj.userData.isPlayerFakeShadow) return;
        if(obj.userData && obj.userData.isShowcaseLabel) return;

        const mat = obj.material;
        const isWater = typeof waterMaterial !== 'undefined' && mat === waterMaterial;
        const isGlass =
            (typeof glassMaterial !== 'undefined' && mat === glassMaterial) ||
            (obj.userData && obj.userData.isGlassMesh);
        const isTransparent = typeof transparentMaterial !== 'undefined' && mat === transparentMaterial;

        if(isWater){
            obj.castShadow = false;
            obj.receiveShadow = false;
        }else if(isGlass){
            obj.castShadow = false;
            obj.receiveShadow = false;
        }else if(isTransparent){
            obj.castShadow = false;
            obj.receiveShadow = false;
        }else{
            obj.castShadow = true;
            obj.receiveShadow = true;
        }
    });
}

function updateShadowSystem(dt){
    if(!sunLight || !sunTarget) return;

    sunTarget.position.set(playerPos.x, playerPos.y, playerPos.z);
    sunLight.target.updateMatrixWorld();

    updatePlayerShadow();

    shadowSetupTimer += dt;
    if(shadowSetupTimer > 1.2){
        shadowSetupTimer = 0;
        applyShadowFlagsToScene();
    }
}

// ================================================================
// DAY/NIGHT
// ================================================================
function updateDayNight(dt){
    dayTime += dt * DAY_NIGHT_SPEED;
    if(dayTime > 1) dayTime -= 1;

    const sunAngle = dayTime * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle);

    sunLight.position.set(sunX * 150, sunY * 200, 80);

    const dayB = Math.max(0, sunY);
    const nightB = Math.max(0, -sunY) * 0.3;

    sunLight.intensity = dayB * 1.12;
    ambientLight.intensity = 0.42 + dayB * 0.42 + nightB;

    const r = 0.09 + dayB * 0.46;
    const g = 0.12 + dayB * 0.66;
    const b = 0.18 + dayB * 0.72;

    const sky = new THREE.Color(r, g, b);
    scene.background = sky;
    scene.fog.color = sky;

    scene.fog.near = 55;
    scene.fog.far = RENDER_DIST * CHUNK_SIZE * 1.65;

    if(dayB > 0.7){
        sunLight.color.setHex(0xfff5e0);
    }else if(dayB > 0.25){
        sunLight.color.setHex(0xffcc88);
    }else{
        sunLight.color.setHex(0x6688cc);
    }
}

function smoothstep(edge0, edge1, x){
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

function getNightFactor(){
    const t = ((dayTime % 1) + 1) % 1;

    const eveningFadeIn = smoothstep(0.46, 0.56, t);
    const dawnFadeOut = 1.0 - smoothstep(0.96, 1.00, t);

    return Math.max(0, Math.min(1, eveningFadeIn * dawnFadeOut));
}

function isCameraActuallyUnderwater(){
    if(!camera) return false;

    const bx = Math.floor(camera.position.x);
    const by = Math.floor(camera.position.y);
    const bz = Math.floor(camera.position.z);

    return getBlock(bx, by, bz) === BLOCK.WATER;
}

// ================================================================
// BLOCK INTERACTION
// ================================================================
function updateBlockInteraction(dt){
    if(!isLocked||playerDead||gamePaused)return;

    const hit=raycast();

    if(pendingClicks[2]){
        pendingClicks[2]=false;

        const pb=hotbarItems[selectedSlot];

        if(isFoodItem(pb)){
            const invCount=playerInventory[pb]||0;

            if(invCount>0&&playerHealth<playerMaxHealth){
                const heal=ITEM_DATA[pb].healAmount;
                playerHealth=Math.min(playerMaxHealth,playerHealth+heal);

                if(gameMode==='survival'){
                    playerInventory[pb]--;
                    if(playerInventory[pb]<=0){
                        delete playerInventory[pb];
                        hotbarItems[selectedSlot]=BLOCK.AIR;
                    }
                }

                updateHealthUI();
                buildHotbarUI();

                playSound(500,'sine',0.08,0.05);
                playSound(300,'sine',0.1,0.04);
                showHealToast(heal);
            }
        }else if(hit&&pb!==BLOCK.SWORD&&pb!==BLOCK.AIR){
            const invCount=playerInventory[pb]||0;

            if(invCount>0){
                const pMx=Math.floor(playerPos.x-0.3);
                const pXx=Math.floor(playerPos.x+0.3);
                const pMy=Math.floor(playerPos.y);
                const pXy=Math.floor(playerPos.y+1.7);
                const pMz=Math.floor(playerPos.z-0.3);
                const pXz=Math.floor(playerPos.z+0.3);

                const isPlayerBlock=
                    hit.placeX>=pMx&&hit.placeX<=pXx&&
                    hit.placeY>=pMy&&hit.placeY<=pXy&&
                    hit.placeZ>=pMz&&hit.placeZ<=pXz;

                if(!isPlayerBlock){
                    const existing=getBlock(hit.placeX,hit.placeY,hit.placeZ);

                    if(existing===BLOCK.AIR||existing===BLOCK.WATER){
                        setBlock(hit.placeX,hit.placeY,hit.placeZ,pb);

                        if(gameMode==='survival'){
                            playerInventory[pb]--;
                            if(playerInventory[pb]<=0){
                                delete playerInventory[pb];
                                hotbarItems[selectedSlot]=BLOCK.AIR;
                            }
                        }

                        buildHotbarUI();
                        playSound(400,'sine',0.08,0.05);
                    }
                }
            }
        }
    }

    if(hit){
        highlightMesh.visible=true;
        highlightMesh.position.set(hit.x+0.5,hit.y+0.5,hit.z+0.5);

        const selInfo=document.getElementById('selectionInfo');
        if(selInfo){
            selInfo.style.display='block';
            selInfo.innerHTML=`<span class="label">Khối:</span> ${BLOCK_DATA[hit.block]?.name||'?'}<br><span class="label">Vị trí:</span> ${hit.x}, ${hit.y}, ${hit.z}`;
        }

        if(pendingClicks[0]){
            pendingClicks[0]=false;

            if(gameMode === 'survival'){


                attackNearestEntity();


            }

            const bd=BLOCK_DATA[hit.block];
            if(bd&&bd.solid&&!bd.unbreakable){
                const brokenType=hit.block;

                setBlock(hit.x,hit.y,hit.z,BLOCK.AIR);

                if(gameMode==='survival'){
                    spawnDropItem(brokenType,hit.x,hit.y,hit.z);
                }

                playSound(200,'square',0.1,0.05);
                playSound(150,'sawtooth',0.08,0.04);

                if(hotbarItems[selectedSlot]===BLOCK.SWORD){
                    swordSwingTime=0.3;
                }
            }
        }
    }else{
        highlightMesh.visible=false;

        const selInfo=document.getElementById('selectionInfo');
        if(selInfo)selInfo.style.display='none';

        if(pendingClicks[0]){
            pendingClicks[0]=false;
            if(gameMode === 'survival'){

                attackNearestEntity();

            }
        }
    }
}

// ================================================================
// HUD HELPERS
// ================================================================
function showGameHUD(){
    const ids=[
        'crosshair',
        'hotbar',
        'blockTooltip',
        'healthBar',
        'killCounter',
        'modeBadge'
    ];

    for(const id of ids){
        const el=document.getElementById(id);
        if(!el)continue;

        if(id==='hotbar'){
            el.style.display='flex';
        }else{
            el.style.display='block';
        }
    }

    updateShowcaseHintVisibility();
}

function hideGameHUD(){
    const ids=[
        'crosshair',
        'hotbar',
        'debug',
        'blockTooltip',
        'selectionInfo',
        'healthBar',
        'killCounter',
        'modeBadge',
        'showcaseHint'
    ];

    for(const id of ids){
        const el=document.getElementById(id);
        if(el)el.style.display='none';
    }

    setShowcaseWorldLabelsVisible(false);
}

function clearInputState(){
    keys={};
    mouseButtons={};
    pendingClicks={};
}

// ================================================================
// PAUSE / RESUME
// ================================================================
function pauseGame(){
    if(!gameStarted||playerDead)return;

    gamePaused=true;
    clearInputState();

    if(highlightMesh)highlightMesh.visible=false;

    const blocker=document.getElementById('blocker');
    if(blocker)blocker.classList.remove('hidden');

    hideGameHUD();
}

function resumeGame(){
    if(!gameStarted||playerDead)return;

    gamePaused=false;
    clearInputState();

    const blocker=document.getElementById('blocker');
    if(blocker)blocker.classList.add('hidden');

    showGameHUD();
    updateModeBadge();
    enableGameInputShield();

    renderer.domElement.requestPointerLock();
}

// ================================================================
// MODE HELPERS
// ================================================================
function startGame(mode){
    initAudio();
    enableGameInputShield();

    applyGameMode(mode||'survival');
    gameStarted=true;
    gamePaused=false;
    clearInputState();

    document.getElementById('blocker').classList.add('hidden');

    showGameHUD();
    updateModeBadge();
    applyShadowFlagsToScene();

    renderer.domElement.requestPointerLock();
}

function applyGameMode(mode){
    gameMode=mode;
    godMode=mode!=='survival';

    playerDead=false;
    playerHealth=playerMaxHealth;
    invulnTimer=1;
    selectedSlot=0;
    playerVel.set(0,0,0);

    if(gameMode!=='survival'){
        clearZombies();
        if(typeof waveActive !== 'undefined') waveActive = false;
        if(typeof zombieSpawnTimer !== 'undefined') zombieSpawnTimer = 0;
    }

    if(gameMode==='survival'){
        hotbarItems=[
            BLOCK.SWORD,
            BLOCK.AIR,
            BLOCK.AIR,
            BLOCK.AIR,
            BLOCK.AIR,
            BLOCK.AIR,
            BLOCK.AIR,
            BLOCK.AIR,
            BLOCK.AIR
        ];

        playerInventory={};
        dayTime=0.30;
        updateDayNight(0);
        playerPos.set(0,getTerrainHeight(0,0)+3,0);
        disposeShowcaseDecor();
    }

    if(gameMode==='creative'){
        setupCreativeInventory();
        dayTime=0.30;
        updateDayNight(0);
        playerPos.set(0,getTerrainHeight(0,0)+3,0);
        disposeShowcaseDecor();
    }

    if(gameMode==='showcase'){
        setupCreativeInventory();

        dayTime=0.30;
        updateDayNight(0);

        setupShowcaseStage();
        resetShowcasePlayer();
    }

    const deathScreen=document.getElementById('deathScreen');
    if(deathScreen)deathScreen.classList.remove('show');

    updateHealthUI();
    updateKillUI();
    buildHotbarUI();
    updateModeBadge();
    updateShowcaseHintVisibility();
}

function setupCreativeInventory(){
    hotbarItems=[
        BLOCK.GRASS,
        BLOCK.DIRT,
        BLOCK.STONE,
        BLOCK.WOOD,
        BLOCK.LEAVES,
        BLOCK.GLASS,
        BLOCK.BRICK,
        BLOCK.WATER,
        BLOCK.SAND
    ];

    playerInventory={};

    [
        BLOCK.GRASS,
        BLOCK.DIRT,
        BLOCK.STONE,
        BLOCK.WOOD,
        BLOCK.LEAVES,
        BLOCK.GLASS,
        BLOCK.BRICK,
        BLOCK.WATER,
        BLOCK.SAND,
        BLOCK.COBBLESTONE,
        BLOCK.PLANKS,
        BLOCK.SNOW
    ].forEach(type=>{
        playerInventory[type]=999;
    });
}

function clearZombies(){
    if(typeof zombies==='undefined')return;

    for(const z of zombies){
        if(z.mesh)scene.remove(z.mesh);
    }

    zombies.length=0;
}

function showModeMessage(message){
    const toast=document.getElementById('pickupToast');
    const text=document.getElementById('pickupText');

    if(!toast||!text)return;

    text.textContent=message;
    text.style.color='#fff';

    toast.style.opacity='1';
    toast.style.transform='translateX(-50%) translateY(0)';

    setTimeout(()=>{
        toast.style.opacity='0';
        toast.style.transform='translateX(-50%) translateY(-20px)';
        text.style.color='';
    },1000);
}

function updateModeBadge(){
    const badge=document.getElementById('modeBadge');

    if(!badge)return;

    badge.textContent=`${gameMode} mode${godMode?' | GOD':''}`;
}

// ================================================================
// SHOWCASE DECOR: LABELS + TORCHES
// ================================================================
function ensureShowcaseDecorGroup(){
    if(showcaseDecorGroup)return showcaseDecorGroup;

    showcaseDecorGroup = new THREE.Group();
    showcaseDecorGroup.name = 'ShowcaseDecorGroup';
    scene.add(showcaseDecorGroup);

    return showcaseDecorGroup;
}

function disposeShowcaseDecor(){
    if(showcaseDecorGroup){
        scene.remove(showcaseDecorGroup);

        showcaseDecorGroup.traverse(obj=>{
            if(obj.geometry)obj.geometry.dispose();
            if(obj.material){
                if(obj.material.map)obj.material.map.dispose();
                obj.material.dispose();
            }
        });
    }

    for(const t of showcaseTorches){
        if(t.light)scene.remove(t.light);
        if(t.fillLight)scene.remove(t.fillLight);

        if(Array.isArray(t.lights)){
            for(const l of t.lights){
                scene.remove(l);
            }
        }
    }

    showcaseDecorGroup=null;
    showcaseLabels=[];
    showcaseTorches=[];
}

function createTextSprite(title, subtitle){
    const canvas=document.createElement('canvas');
    canvas.width=512;
    canvas.height=160;

    const ctx=canvas.getContext('2d');

    ctx.clearRect(0,0,canvas.width,canvas.height);

    ctx.fillStyle='rgba(0,0,0,0.62)';
    roundRect(ctx,12,18,488,122,18);
    ctx.fill();

    ctx.strokeStyle='rgba(150,255,115,0.45)';
    ctx.lineWidth=3;
    roundRect(ctx,12,18,488,122,18);
    ctx.stroke();

    ctx.fillStyle='#9cff7a';
    ctx.font='bold 30px Segoe UI, Arial';
    ctx.textAlign='center';
    ctx.fillText(title,256,64);

    ctx.fillStyle='rgba(255,255,255,0.86)';
    ctx.font='20px Segoe UI, Arial';
    ctx.fillText(subtitle,256,100);

    const texture=new THREE.CanvasTexture(canvas);
    texture.minFilter=THREE.LinearFilter;
    texture.magFilter=THREE.LinearFilter;

    const mat=new THREE.SpriteMaterial({
        map:texture,
        transparent:true,
        depthWrite:false,
        depthTest:true
    });

    const sprite=new THREE.Sprite(mat);
    sprite.scale.set(6.4,2.0,1);
    sprite.userData.isShowcaseLabel=true;

    return sprite;
}

function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
}

function addShowcaseLabel(title,subtitle,x,y,z){
    const group=ensureShowcaseDecorGroup();
    const sprite=createTextSprite(title,subtitle);
    sprite.position.set(x,y,z);
    group.add(sprite);
    showcaseLabels.push(sprite);
}

function setShowcaseWorldLabelsVisible(visible){
    const shouldShow = visible && showcaseHintVisible && gameStarted && !gamePaused && gameMode==='showcase';

    for(const label of showcaseLabels){
        label.visible=shouldShow;
    }
}

function setupShowcaseLabels(){
    addShowcaseLabel('BLOCK GALLERY','Texture atlas + voxel materials',-18,showcaseBaseY+6.8,-7);
    addShowcaseLabel('TRANSPARENCY','Glass, leaves, water materials',21,showcaseBaseY+6.8,-7);
    addShowcaseLabel('PARTICLE DEMO','Press P or break blocks',-18,showcaseBaseY+5.7,6);
    addShowcaseLabel('ENTITY PEN','Land animals + animation + shadows',21,showcaseBaseY+5.7,6);
    addShowcaseLabel('RAYCAST WALL','Block picking, breaking, placing',-18,showcaseBaseY+6.6,31);
    addShowcaseLabel('WATER POOL','Glass pool + natural water surface',21,showcaseBaseY+6.6,31);
    addShowcaseLabel('POINT LIGHT DEMO','Local torch lighting + flicker',0,showcaseBaseY+6.8,-31);
}

function createTorch(x,y,z){
    const group=ensureShowcaseDecorGroup();

    const torchGroup=new THREE.Group();
    torchGroup.position.set(x,y,z);

    const poleGeo=new THREE.BoxGeometry(0.18,1.1,0.18);
    const poleMat=new THREE.MeshLambertMaterial({color:0x5a3418});
    const pole=new THREE.Mesh(poleGeo,poleMat);
    pole.position.y=0.55;
    pole.castShadow=true;
    pole.receiveShadow=true;
    torchGroup.add(pole);

    const fireGeo=new THREE.BoxGeometry(0.36,0.36,0.36);

    const fireMat=new THREE.MeshBasicMaterial({
        color:0xffc15a,
        transparent:true,
        opacity:0.95
    });

    const fire=new THREE.Mesh(fireGeo,fireMat);
    fire.position.y=1.25;
    fire.castShadow=false;
    fire.receiveShadow=false;
    torchGroup.add(fire);

    const haloGeo=new THREE.SphereGeometry(0.9,18,18);
    const haloMat=new THREE.MeshBasicMaterial({
        color:0xffaa44,
        transparent:true,
        opacity:0.11,
        depthWrite:false,
        blending:THREE.AdditiveBlending
    });

    const halo=new THREE.Mesh(haloGeo,haloMat);
    halo.position.y=1.25;
    halo.castShadow=false;
    halo.receiveShadow=false;
    torchGroup.add(halo);

    const light=new THREE.PointLight(
        0xffaa55,
        TORCH_LIGHT_INTENSITY,
        TORCH_LIGHT_DISTANCE,
        TORCH_LIGHT_DECAY
    );

    light.position.set(x,y+1.25,z);
    light.castShadow=false;
    scene.add(light);

    const fillLight=new THREE.PointLight(
        0xffbb66,
        TORCH_FILL_INTENSITY,
        TORCH_FILL_DISTANCE,
        TORCH_FILL_DECAY
    );

    fillLight.position.set(x,y+0.65,z);
    fillLight.castShadow=false;
    scene.add(fillLight);

    torchGroup.userData.light=light;
    torchGroup.userData.fillLight=fillLight;
    torchGroup.userData.fire=fire;
    torchGroup.userData.halo=halo;
    torchGroup.userData.baseIntensity=TORCH_LIGHT_INTENSITY;
    torchGroup.userData.baseFillIntensity=TORCH_FILL_INTENSITY;
    torchGroup.userData.phase=Math.random()*Math.PI*2;

    group.add(torchGroup);

    showcaseTorches.push({
        group:torchGroup,
        light,
        fillLight,
        lights:[light,fillLight],
        fire,
        halo,
        baseIntensity:TORCH_LIGHT_INTENSITY,
        baseFillIntensity:TORCH_FILL_INTENSITY,
        phase:torchGroup.userData.phase
    });
}

function setupTorchDemo(){
    const baseY=showcaseBaseY;

    setBlockFrame(-8,baseY,-34,8,-27,BLOCK.COBBLESTONE);
    setBlockBox(-7,baseY,-33,7,baseY,-28,BLOCK.STONE);

    setBlockBox(-7,baseY+1,-33,-7,baseY+3,-28,BLOCK.BRICK);
    setBlockBox(7,baseY+1,-33,7,baseY+3,-28,BLOCK.BRICK);
    setBlockBox(-7,baseY+1,-33,7,baseY+3,-33,BLOCK.BRICK);

    setBlockBox(-4,baseY+1,-30,-3,baseY+2,-30,BLOCK.GLASS);
    setBlockBox(3,baseY+1,-30,4,baseY+2,-30,BLOCK.GLASS);

    createTorch(-5,baseY+1,-29);
    createTorch(0,baseY+1,-30);
    createTorch(5,baseY+1,-29);
}

function updateTorchLights(dt){
    if(gameMode!=='showcase')return;

    const nightFactor = getNightFactor();

    for(const t of showcaseTorches){
        const flicker =
            1.0 +
            Math.sin(gameTime*8.0 + t.phase) * TORCH_FLICKER_AMOUNT +
            Math.sin(gameTime*17.0 + t.phase*0.7) * (TORCH_FLICKER_AMOUNT * 0.35);

        const mainIntensity = t.baseIntensity * flicker;

        const fillIntensity =
            t.baseFillIntensity *
            (0.96 + Math.sin(gameTime*5.5 + t.phase)*0.025) *
            (1.0 + nightFactor * TORCH_NIGHT_FILL_INTENSITY_BOOST);

        if(t.light){
            t.light.intensity = mainIntensity;
            t.light.distance = TORCH_LIGHT_DISTANCE + nightFactor * TORCH_NIGHT_DISTANCE_BOOST;
        }

        if(t.fillLight){
            t.fillLight.intensity = fillIntensity;
            t.fillLight.distance = TORCH_FILL_DISTANCE + nightFactor * TORCH_NIGHT_FILL_DISTANCE_BOOST;
        }

        if(t.fire){
            const s =
                1.0 +
                Math.sin(gameTime*12.0 + t.phase) * 0.04 +
                Math.random() * 0.025;

            t.fire.scale.set(s,1.0 + Math.random()*0.08,s);
        }

        if(t.halo){
            const hs =
                1.0 +
                Math.sin(gameTime*7.0 + t.phase) * 0.06 +
                Math.random() * 0.03;

            t.halo.scale.set(hs,hs,hs);
            t.halo.material.opacity = 0.10 + Math.random()*0.035 + nightFactor * 0.045;
        }
    }
}

// ================================================================
// SHOWCASE MODE
// ================================================================
function setNaturalWaterBox(x1,y1,z1,x2,y2,z2){
    const minX=Math.min(x1,x2),maxX=Math.max(x1,x2);
    const minY=Math.min(y1,y2),maxY=Math.max(y1,y2);
    const minZ=Math.min(z1,z2),maxZ=Math.max(z1,z2);

    for(let x=minX;x<=maxX;x++){
        for(let y=minY;y<=maxY;y++){
            for(let z=minZ;z<=maxZ;z++){
                if(typeof setNaturalWaterBlock === 'function'){
                    setNaturalWaterBlock(x,y,z);
                }else{
                    setBlock(x,y,z,BLOCK.WATER);
                }
            }
        }
    }
}

function setBlockBox(x1,y1,z1,x2,y2,z2,type){
    const minX=Math.min(x1,x2),maxX=Math.max(x1,x2);
    const minY=Math.min(y1,y2),maxY=Math.max(y1,y2);
    const minZ=Math.min(z1,z2),maxZ=Math.max(z1,z2);

    for(let x=minX;x<=maxX;x++){
        for(let y=minY;y<=maxY;y++){
            for(let z=minZ;z<=maxZ;z++){
                setBlock(x,y,z,type);
            }
        }
    }
}

function setBlockFrame(x1,y,z1,x2,z2,type){
    const minX=Math.min(x1,x2),maxX=Math.max(x1,x2);
    const minZ=Math.min(z1,z2),maxZ=Math.max(z1,z2);

    for(let x=minX;x<=maxX;x++){
        setBlock(x,y,minZ,type);
        setBlock(x,y,maxZ,type);
    }

    for(let z=minZ;z<=maxZ;z++){
        setBlock(minX,y,z,type);
        setBlock(maxX,y,z,type);
    }
}

function prepareShowcaseChunks(){
    const chunkRadius = 5;

    for(let cx=-chunkRadius; cx<=chunkRadius; cx++){
        for(let cz=-chunkRadius; cz<=chunkRadius; cz++){
            generateChunk(cx, cz);
        }
    }
}

function clearShowcaseArea(){
    prepareShowcaseChunks();

    for(let x=-80;x<=80;x++){
        for(let z=-80;z<=80;z++){
            for(let y=1;y<WORLD_HEIGHT;y++){
                setBlock(x,y,z,BLOCK.AIR);
            }
        }
    }
}

function setBlockIfAir(x,y,z,type){
    if(getBlock(x,y,z) === BLOCK.AIR){
        setBlock(x,y,z,type);
    }
}

function addShowcaseTree(x, baseY, z, height){
    height = height || 5;

    for(let y=1; y<=height; y++){
        setBlock(x, baseY+y, z, BLOCK.WOOD);
    }

    const top = baseY + height;

    for(let lx=-2; lx<=2; lx++){
        for(let lz=-2; lz<=2; lz++){
            const d = Math.abs(lx) + Math.abs(lz);
            if(d <= 3){
                setBlockIfAir(x+lx, top-1, z+lz, BLOCK.LEAVES);
            }
        }
    }

    for(let lx=-2; lx<=2; lx++){
        for(let lz=-2; lz<=2; lz++){
            const corner = Math.abs(lx) === 2 && Math.abs(lz) === 2;
            if(!corner){
                setBlockIfAir(x+lx, top, z+lz, BLOCK.LEAVES);
            }
        }
    }

    for(let lx=-1; lx<=1; lx++){
        for(let lz=-1; lz<=1; lz++){
            setBlockIfAir(x+lx, top+1, z+lz, BLOCK.LEAVES);
        }
    }

    setBlockIfAir(x, top+2, z, BLOCK.LEAVES);
    setBlockIfAir(x+1, top+1, z, BLOCK.LEAVES);
    setBlockIfAir(x-1, top+1, z, BLOCK.LEAVES);
    setBlockIfAir(x, top+1, z+1, BLOCK.LEAVES);
    setBlockIfAir(x, top+1, z-1, BLOCK.LEAVES);
}


function buildSimpleShowcasePool(baseY){
    // Demo aquarium riêng cho Graphics Showcase.
    // Chỉ dùng vài lớp block cần thiết để tránh đứng máy khi vào mode.
    // Hồ thiên nhiên trong survival/creative vẫn giữ nguyên logic hiện tại.
    const minX = 10;
    const maxX = 30;
    const minZ = 11;
    const maxZ = 27;
    const floorY = baseY;
    const waterMinY = baseY + 1;
    const waterMaxY = baseY + 3;
    const wallMaxY = baseY + 4;
    window.SHOWCASE_DEMO_POOL_BOUNDS = {
        minX,
        maxX,
        minY: waterMinY,
        maxY: waterMaxY,
        minZ,
        maxZ
    };


    // Nền hồ và viền đá.
    setBlockBox(9, floorY, 10, 31, floorY, 28, BLOCK.STONE);
    setBlockBox(minX + 1, floorY, minZ + 1, maxX - 1, floorY, maxZ - 1, BLOCK.SAND);

    // Địa hình đáy nhiều tầng, nhưng rất nhẹ.
    setBlockBox(12, floorY + 1, 13, 15, floorY + 1, 16, BLOCK.SAND);
    setBlockBox(25, floorY + 1, 22, 28, floorY + 1, 25, BLOCK.SAND);
    setBlockBox(18, floorY + 1, 17, 22, floorY + 1, 21, BLOCK.SAND);
    setBlockBox(20, floorY + 2, 18, 21, floorY + 2, 20, BLOCK.SAND);

    // Cụm đá trang trí dưới nước.
    setBlockBox(13, floorY + 1, 21, 14, floorY + 1, 22, BLOCK.COBBLESTONE);
    setBlock(14, floorY + 2, 22, BLOCK.STONE);
    setBlockBox(26, floorY + 1, 15, 27, floorY + 1, 16, BLOCK.COBBLESTONE);
    setBlock(26, floorY + 2, 15, BLOCK.STONE);

    // Khúc gỗ chìm nhỏ, không làm cầu ngang che hồ.
    setBlockBox(23, floorY + 1, 20, 26, floorY + 1, 20, BLOCK.WOOD);

    // Cây thủy sinh đơn giản bằng leaves.
    const plants = [
        [13, 14, 2],
        [16, 24, 2],
        [19, 23, 3],
        [24, 15, 2],
        [27, 24, 3]
    ];

    for(const p of plants){
        const px = p[0];
        const pz = p[1];
        const h = p[2];
        for(let i = 0; i < h; i++){
            setBlock(px, floorY + 1 + i, pz, BLOCK.LEAVES);
        }
    }

    // Tường kính cao vừa đủ để nhìn như aquarium nhưng không quá nặng.
    for(let y = waterMinY; y <= wallMaxY; y++){
        setBlockBox(minX, y, minZ, maxX, y, minZ, BLOCK.GLASS);
        setBlockBox(minX, y, maxZ, maxX, y, maxZ, BLOCK.GLASS);
        setBlockBox(minX, y, minZ + 1, minX, y, maxZ - 1, BLOCK.GLASS);
        setBlockBox(maxX, y, minZ + 1, maxX, y, maxZ - 1, BLOCK.GLASS);
    }

    // Fill nước trong lòng hồ, bỏ qua những block trang trí đã đặt.
    for(let x = minX + 1; x <= maxX - 1; x++){
        for(let y = waterMinY; y <= waterMaxY; y++){
            for(let z = minZ + 1; z <= maxZ - 1; z++){
                if(getBlock(x, y, z) === BLOCK.AIR){
                    if(typeof setNaturalWaterBlock === 'function'){
                        setNaturalWaterBlock(x, y, z);
                    }else{
                        setBlock(x, y, z, BLOCK.WATER);
                    }
                }
            }
        }
    }
}


function buildSimpleTransparencyDemo(baseY){
    // Demo riêng cho Transparency: nhẹ, không dựng cột nước/kính lơ lửng.
    // Không đụng block cỏ.
    const x1 = 8, x2 = 20;
    const z1 = -26, z2 = -14;

    setBlockBox(x1, baseY, z1, x2, baseY, z2, BLOCK.STONE);

    // Glass sample: khung kính thấp, nhìn rõ tính trong suốt.
    setBlockBox(10, baseY + 1, -24, 14, baseY + 1, -24, BLOCK.GLASS);
    setBlockBox(10, baseY + 1, -20, 14, baseY + 1, -20, BLOCK.GLASS);
    setBlockBox(10, baseY + 1, -23, 10, baseY + 1, -21, BLOCK.GLASS);
    setBlockBox(14, baseY + 1, -23, 14, baseY + 1, -21, BLOCK.GLASS);

    setBlock(10, baseY + 2, -24, BLOCK.GLASS);
    setBlock(14, baseY + 2, -24, BLOCK.GLASS);
    setBlock(10, baseY + 2, -20, BLOCK.GLASS);
    setBlock(14, baseY + 2, -20, BLOCK.GLASS);

    // Water sample: bể nước thấp, nằm trên nền, không còn khối nước bay.
    setBlockBox(16, baseY + 1, -24, 18, baseY + 1, -22, BLOCK.GLASS);
    setBlock(17, baseY + 1, -23, BLOCK.WATER);
    setBlock(17, baseY + 2, -23, BLOCK.WATER);

    // Lá cây làm vật sau kính để thấy kính trong suốt.
    setBlockBox(11, baseY + 1, -17, 12, baseY + 3, -16, BLOCK.LEAVES);

    // Một cột mẫu nhỏ phía sau nước, giúp nhìn rõ độ trong.
    setBlock(19, baseY + 1, -18, BLOCK.SAND);
    setBlock(19, baseY + 2, -18, BLOCK.GLASS);
}

function setupShowcaseStage(){
    if(typeof beginWorldBatch === 'function') beginWorldBatch();

    try {
    disposeShowcaseDecor();

    showcaseBaseY=32;

    clearShowcaseArea();

    const baseY=showcaseBaseY;

    setBlockBox(-34,baseY-2,-32,38,baseY-2,36,BLOCK.STONE);
    setBlockBox(-34,baseY-1,-32,38,baseY-1,36,BLOCK.PLANKS);

    setBlockFrame(-34,baseY,-32,38,36,BLOCK.COBBLESTONE);
    setBlockFrame(-33,baseY,-31,37,35,BLOCK.STONE);

    setBlockBox(-2,baseY,-28,2,baseY,32,BLOCK.COBBLESTONE);
    setBlockBox(-30,baseY,-2,34,baseY,2,BLOCK.COBBLESTONE);

    setBlockBox(-4,baseY,24,4,baseY,32,BLOCK.SNOW);
    setBlockFrame(-4,baseY+1,24,4,32,BLOCK.GLASS);

    setBlockFrame(-31,baseY,-27,-5,-8,BLOCK.COBBLESTONE);

    const gallery=[
        BLOCK.GRASS,
        BLOCK.DIRT,
        BLOCK.STONE,
        BLOCK.SAND,
        BLOCK.WOOD,
        BLOCK.LEAVES,
        BLOCK.GLASS,
        BLOCK.BRICK,
        BLOCK.SNOW,
        BLOCK.COBBLESTONE,
        BLOCK.PLANKS,
        BLOCK.BEDROCK
    ];

    for(let i=0;i<gallery.length;i++){
        const gx=-28+(i%4)*6;
        const gz=-24+Math.floor(i/4)*5;

        setBlockBox(gx-1,baseY,gz-1,gx+1,baseY,gz+1,BLOCK.STONE);

        for(let h=1;h<=3;h++){
            setBlock(gx,baseY+h,gz,gallery[i]);
        }
    }

    setBlockFrame(6,baseY,-27,34,-8,BLOCK.COBBLESTONE);

    // Display demo riêng cho transparency: không còn khối nước/kính lơ lửng.
    buildSimpleTransparencyDemo(baseY);

    setBlockFrame(6,baseY,7,34,31,BLOCK.COBBLESTONE);

    // Lightweight demo aquarium.
    // Mục tiêu: load nhanh, hợp lý, không ảnh hưởng hồ thiên nhiên.
    // Không đụng config / texture / UV của block cỏ.
    buildSimpleShowcasePool(baseY);

    setBlockFrame(-31,baseY,7,-5,31,BLOCK.COBBLESTONE);

    for(let x=-27;x<=-9;x++){
        for(let y=1;y<=5;y++){
            let blockType=BLOCK.BRICK;
            if((x+y)%3===0)blockType=BLOCK.GLASS;
            if((x+y)%5===0)blockType=BLOCK.WOOD;
            setBlock(x,baseY+y,15,blockType);
        }
    }

    setBlockBox(-28,baseY,23,-8,baseY,28,BLOCK.STONE);

    for(let x=-26;x<=-10;x+=4){
        setBlock(x,baseY+1,26,BLOCK.GRASS);
        setBlock(x,baseY+2,26,BLOCK.DIRT);
        setBlock(x,baseY+3,26,BLOCK.SAND);
    }

    setBlockFrame(-31,baseY,-5,-5,5,BLOCK.COBBLESTONE);

    for(let x=-27;x<=-9;x+=3){
        setBlock(x,baseY+1,0,BLOCK.STONE);
        setBlock(x,baseY+2,0,BLOCK.COBBLESTONE);
        setBlock(x,baseY+3,0,BLOCK.BRICK);
    }

    setBlockFrame(6,baseY,-5,34,5,BLOCK.COBBLESTONE);

    setBlockBox(10,baseY,-2,30,baseY,2,BLOCK.GRASS);

    for(let x=10;x<=30;x++){
        setBlock(x,baseY+1,-2,BLOCK.GLASS);
        setBlock(x,baseY+1,2,BLOCK.GLASS);

        if(x%2===0){
            setBlock(x,baseY+2,-2,BLOCK.GLASS);
            setBlock(x,baseY+2,2,BLOCK.GLASS);
        }
    }

    for(let z=-2;z<=2;z++){
        setBlock(10,baseY+1,z,BLOCK.GLASS);
        setBlock(30,baseY+1,z,BLOCK.GLASS);

        if(z%2===0){
            setBlock(10,baseY+2,z,BLOCK.GLASS);
            setBlock(30,baseY+2,z,BLOCK.GLASS);
        }
    }

    addShowcaseTree(13, baseY, -1, 5);
    addShowcaseTree(28, baseY, -1, 6);
    addShowcaseTree(20, baseY, 2, 5);

    setupTorchDemo();

    setupShowcaseCows();
    setupShowcaseLabels();

    if(typeof forceRebuildAllDirtyChunks === 'function'){
        forceRebuildAllDirtyChunks();
    }

    applyShadowFlagsToScene();

    dayTime=0.30;
    updateDayNight(0);

    } finally {
        if(typeof endWorldBatch === 'function') endWorldBatch();
    }
}

function setupShowcaseCows(){
    if(typeof cows==='undefined')return;

    // Clear existing land animals before building the showcase Entity Pen.
    for(const c of cows){
        if(c.mesh)scene.remove(c.mesh);
    }
    cows.length=0;

    const y = showcaseBaseY + 1;

    const animals=[
        {type:'cow',     x:13, y, z:-1.15, yaw:Math.PI*0.50},
        {type:'pig',     x:16, y, z: 1.05, yaw:Math.PI*1.15},
        {type:'sheep',   x:19, y, z:-1.10, yaw:Math.PI*0.25},
        {type:'chicken', x:22, y, z: 1.10, yaw:Math.PI*1.65},
        {type:'cow',     x:25, y, z:-1.05, yaw:Math.PI*0.85},
        {type:'pig',     x:28, y, z: 1.05, yaw:Math.PI*1.35},
        {type:'sheep',   x:15, y, z:-0.05, yaw:Math.PI*0.05},
        {type:'chicken', x:27, y, z:-0.05, yaw:Math.PI*1.95}
    ];

    for(const a of animals){
        if(typeof spawnCow === 'function'){
            // Dùng lệnh spawn thật của hệ animal, không tự tạo mesh thủ công trong main.
            spawnCow(a.type, {
                x:a.x,
                y:a.y,
                z:a.z,
                yaw:a.yaw,
                force:true,
                showcaseAnimal:true,
                aiState:'wander',
                aiTimer:2+Math.random()*2
            });
        }
    }
}

function resetShowcasePlayer(){
    if(gameMode!=='showcase')return;

    playerVel.set(0,0,0);
    playerPos.set(0,showcaseBaseY+2,29);
    yaw=Math.PI;
    pitch=0;

    showModeMessage('Reset về Showcase Spawn');
}

function triggerShowcaseParticles(){
    if(typeof createExplosionParticles!=='function')return;

    const pos=playerPos.clone();
    pos.y+=0.5;

    createExplosionParticles(pos,0xffcc55,18);
    createExplosionParticles(pos.clone().add(new THREE.Vector3(0,0.5,0)),0xffffff,10);

    playSound(180,'sawtooth',0.15,0.08);
    playSound(420,'square',0.06,0.05);
    showModeMessage('Particle demo!');
}

function ensureShowcaseHint(){
    let el=document.getElementById('showcaseHint');

    if(el)return el;

    el=document.createElement('div');
    el.id='showcaseHint';

    el.style.cssText=`
        position: fixed;
        left: 18px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 12;
        display: none;
        width: 305px;
        padding: 14px 16px;
        color: rgba(255,255,255,0.82);
        background: rgba(0,0,0,0.42);
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 10px;
        font-family: 'Segoe UI', monospace;
        font-size: 12px;
        line-height: 1.55;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
        box-shadow: 0 10px 35px rgba(0,0,0,0.25);
        backdrop-filter: blur(3px);
        -webkit-backdrop-filter: blur(3px);
        pointer-events: none;
    `;

    el.innerHTML=`
        <div style="font-size:15px;font-weight:900;color:#9cff7a;letter-spacing:1px;margin-bottom:8px;">
            GRAPHICS SHOWCASE
        </div>
        <div><b>Block Gallery:</b> texture atlas + voxel materials</div>
        <div><b>Transparency:</b> glass, leaves, water</div>
        <div><b>Water Pool:</b> glass pool + natural water surface</div>
        <div><b>Raycast Wall:</b> chọn, phá, đặt block</div>
        <div><b>Particle Zone:</b> block break / explosion particles</div>
        <div><b>Entity Pen:</b> land animals + animation + shadow</div>
        <div><b>Point Light:</b> torch light + flicker + local shadows</div>
        <hr style="border:0;border-top:1px solid rgba(255,255,255,0.12);margin:8px 0;">
        <div><kbd>T</kbd> tua ngày/đêm &nbsp; <kbd>P</kbd> particle &nbsp; <kbd>H</kbd> hint/labels</div>
        <div><kbd>R</kbd> reset showcase &nbsp; <kbd>ESC</kbd> pause/resume</div>
    `;

    document.body.appendChild(el);
    return el;
}

function updateShowcaseHintVisibility(){
    const el=ensureShowcaseHint();
    if(!el)return;

    const shouldShow = gameStarted && !gamePaused && gameMode==='showcase' && showcaseHintVisible;

    if(shouldShow){
        el.style.display='block';
    }else{
        el.style.display='none';
    }

    setShowcaseWorldLabelsVisible(shouldShow);
}

function toggleShowcaseHints(){
    if(gameMode!=='showcase')return;

    showcaseHintVisible=!showcaseHintVisible;
    updateShowcaseHintVisibility();

    showModeMessage(showcaseHintVisible ? 'Showcase hints: ON' : 'Showcase hints: OFF');
}

// ================================================================
// INIT
// ================================================================
function init(){
    scene=new THREE.Scene();
    scene.background=new THREE.Color(0x87ceeb);
    scene.fog=new THREE.Fog(0x87ceeb,55,RENDER_DIST*CHUNK_SIZE*1.6);

    camera=new THREE.PerspectiveCamera(75,window.innerWidth/window.innerHeight,0.1,500);

    renderer=new THREE.WebGLRenderer({antialias:false});
    renderer.setSize(window.innerWidth,window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    setupRendererShadows();

    document.body.insertBefore(renderer.domElement,document.body.firstChild);

    clock=new THREE.Clock();

    generateAtlas();

    noise=new SimplexNoise(12345);
    noise2=new SimplexNoise(67890);
    noise3=new SimplexNoise(11111);

    ambientLight=new THREE.AmbientLight(0x606080,0.58);
    scene.add(ambientLight);

    sunLight=new THREE.DirectionalLight(0xfff7df,1.45);
    sunLight.position.set(0,220,80);
    scene.add(sunLight);
    setupSunShadow();

    scene.add(new THREE.HemisphereLight(0x9fdcff,0x4b3824,0.36));

    const hlGeom=new THREE.BoxGeometry(1.005,1.005,1.005);
    highlightMesh=new THREE.Mesh(
        hlGeom,
        new THREE.MeshBasicMaterial({
            color:0x000000,
            wireframe:true,
            transparent:true,
            opacity:0.4
        })
    );

    highlightMesh.visible=false;
    scene.add(highlightMesh);

    scene.add(camera);

    createSwordMesh();
    createPlayerShadow();

    buildHotbarUI();
    setupEvents();
    generateInitialWorld();
    ensureShowcaseHint();

    playerPos.set(0,getTerrainHeight(0,0)+3,0);

    for(let i=0;i<4;i++){
        spawnCow();
    }

    applyShadowFlagsToScene();
    animate();
}

// ================================================================
// EVENTS
// ================================================================
function setupEvents(){
    const canvas=renderer.domElement;
    const blocker=document.getElementById('blocker');

    canvas.addEventListener('click',()=>{
        if(gameStarted&&!isLocked&&!playerDead&&!gamePaused){
            blurEditableElements();

            if(inventoryOpen){
                toggleInventory();
            }

            canvas.requestPointerLock();
        }
    });

    if(blocker){
        blocker.addEventListener('click',(e)=>{
            if(gameStarted&&gamePaused&&e.target===blocker){
                resumeGame();
            }
        });
    }

    document.addEventListener('pointerlockchange',()=>{
        isLocked=document.pointerLockElement===canvas;

        if(!isLocked&&gameStarted&&!playerDead){
            if(inventoryOpen)return;
            pauseGame();
        }

        if(isLocked&&gameStarted&&!playerDead){
            enableGameInputShield();
            blurEditableElements();

            gamePaused=false;
            document.getElementById('blocker').classList.add('hidden');
            showGameHUD();
            updateModeBadge();
            updateShowcaseHintVisibility();
        }
    });

    document.addEventListener('mousemove',(e)=>{
        if(!isLocked||gamePaused)return;

        yaw-=e.movementX*0.002;
        pitch-=e.movementY*0.002;
        pitch=Math.max(-Math.PI/2+0.01,Math.min(Math.PI/2-0.01,pitch));
    });

    document.addEventListener('mousedown',(e)=>{
        if(!isLocked||gamePaused)return;

        blurEditableElements();

        e.preventDefault();
        mouseButtons[e.button]=true;
        pendingClicks[e.button]=true;
    });

    document.addEventListener('mouseup',(e)=>{
        mouseButtons[e.button]=false;
    });

    document.addEventListener('contextmenu',(e)=>e.preventDefault());

    document.addEventListener('keydown',(e)=>{
        if(gameStarted && !inventoryOpen && !isEditableElement(e.target)){
            const gameplayCodes = [
                'KeyW','KeyA','KeyS','KeyD',
                'Space','ShiftLeft','ShiftRight',
                'ControlLeft','ControlRight',
                'KeyT','KeyG','KeyH','KeyR','KeyP','KeyE',
                'F3','Escape',
                'Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9'
            ];

            if(gameplayCodes.includes(e.code)){
                e.preventDefault();
                e.stopPropagation();
            }
        }

        if(e.code==='Escape'&&gameStarted&&gamePaused&&!playerDead&&!inventoryOpen){
            e.preventDefault();
            resumeGame();
            return;
        }

        keys[e.code]=true;

        if(e.code>='Digit1'&&e.code<='Digit9'&&!gamePaused){
            selectedSlot=parseInt(e.code.replace('Digit',''))-1;
            updateHotbarSelection();
        }

        if(e.code==='F3'&&!gamePaused){
            e.preventDefault();
            showDebug=!showDebug;
            document.getElementById('debug').style.display=showDebug?'block':'none';
        }

        if(e.code==='KeyG'&&gameStarted&&!gamePaused){
            e.preventDefault();
            godMode=!godMode;
            updateModeBadge();
            showModeMessage(godMode?'God mode: ON':'God mode: OFF');
        }

        if(e.code==='KeyH'&&gameStarted&&!gamePaused&&gameMode==='showcase'){
            e.preventDefault();
            toggleShowcaseHints();
        }

        if(e.code==='KeyR'&&gameStarted&&!gamePaused&&gameMode==='showcase'){
            e.preventDefault();
            resetShowcasePlayer();
        }

        if(e.code==='KeyP'&&gameStarted&&!gamePaused&&gameMode==='showcase'){
            e.preventDefault();
            triggerShowcaseParticles();
        }

        if(e.code==='KeyE'&&gameStarted&&!playerDead&&!gamePaused){
            e.preventDefault();
            toggleInventory();
        }

        if(e.code==='Escape'&&inventoryOpen){
            toggleInventory();
        }
    });

    document.addEventListener('keyup',(e)=>{
        keys[e.code]=false;
    });

    document.addEventListener('wheel',(e)=>{
        if(!isLocked||gamePaused)return;

        e.preventDefault();

        selectedSlot=(selectedSlot+(e.deltaY>0?1:8))%9;
        updateHotbarSelection();
    },{passive:false});

    document.querySelectorAll('.mode-btn').forEach(btn=>{
        btn.addEventListener('click',(e)=>{
            e.stopPropagation();
            startGame(btn.dataset.mode||'survival');
        });
    });

    const respawnBtn=document.getElementById('respawnBtn');
    if(respawnBtn){
        respawnBtn.addEventListener('click',()=>{
            respawnPlayer();
        });
    }

    window.addEventListener('resize',()=>{
        camera.aspect=window.innerWidth/window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth,window.innerHeight);
    });
}

// ================================================================
// MAIN LOOP
// ================================================================
let chunkTimer=0,particleTimer=0,dropTimer=0,dayTimer=0;
let physicsAccumulator=0;
const PHYSICS_STEP=0.02;

function animate(){
    requestAnimationFrame(animate);

    let dt=clock.getDelta();

    if(dt>0.5)dt=0.5;

    if(gameStarted&&!gamePaused&&isLocked){
        gameTime+=dt;
        physicsAccumulator+=dt;

        let stepsThisFrame=0;

        while(physicsAccumulator>=PHYSICS_STEP&&stepsThisFrame<15){
            updatePlayer(PHYSICS_STEP);
            physicsAccumulator-=PHYSICS_STEP;
            stepsThisFrame++;
        }

        if(physicsAccumulator>0.2){
            physicsAccumulator=0.2;
        }

        updateBlockInteraction(dt);

        if(keys['KeyT']){
            updateDayNight(dt * DAY_NIGHT_FAST_MULTIPLIER);
        }else{
            dayTimer+=dt;

            if(dayTimer>0.5){
                dayTimer=0;
                updateDayNight(0.5);
            }
        }

        if(gameMode==='survival'){
            updateZombies(dt);
        }else{
            clearZombies();
        }

        updateCows(dt);
        if(typeof updateAquaticAnimals === 'function'){
            updateAquaticAnimals(dt);
        }
        updateTorchLights(dt);

        particleTimer+=dt;
        if(particleTimer>0.05){
            particleTimer=0;
            updateParticles(0.05);
        }

        updateSwordAnimation(dt);

        dropTimer+=dt;
        if(dropTimer>0.033){
            dropTimer=0;
            updateDropItems(0.033);
        }

        chunkTimer+=dt;
        if(chunkTimer>0.3){
            chunkTimer=0;
            updateChunks();
        }

        updateShadowSystem(dt);

        const wOverlay=document.getElementById('waterOverlay');
        if(wOverlay){
            const cameraUnderwater = isCameraActuallyUnderwater();

            if(cameraUnderwater){
                wOverlay.classList.add('active');
                wOverlay.classList.add('deep');
            }else{
                wOverlay.classList.remove('active');
                wOverlay.classList.remove('deep');
            }
        }

        if(typeof updateWaterAnimation === 'function'){
            updateWaterAnimation(dt, gameTime);
        }

        if(showDebug){
            fpsFrames++;
            fpsTime+=dt;

            if(fpsTime>=0.5){
                fpsValue=Math.round(fpsFrames/fpsTime);
                fpsFrames=0;
                fpsTime=0;
            }

            updateDebug();
        }
    }else{
        updatePlayerShadow();
    }

    renderer.render(scene,camera);
}

init();