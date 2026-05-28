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
        opacity: 0.22,
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

    const length = Math.max(0.55, Math.min(4.2, 1.15 / (sunY + 0.16)));
    const width = 0.38 + Math.max(0, 0.25 - sunY * 0.12);

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

    playerShadowMesh.material.opacity = Math.max(0.06, Math.min(0.24, sunY * 0.22));
    playerShadowMesh.visible = true;
}

function applyShadowFlagsToScene(){
    scene.traverse(obj=>{
        if(!obj.isMesh) return;
        if(obj.userData && obj.userData.isPlayerFakeShadow) return;
        if(obj.userData && obj.userData.isShowcaseLabel) return;

        const mat = obj.material;
        const isWater = typeof waterMaterial !== 'undefined' && mat === waterMaterial;
        const isTransparent = typeof transparentMaterial !== 'undefined' && mat === transparentMaterial;

        if(isWater){
            obj.castShadow = false;
            obj.receiveShadow = false;
        }else if(isTransparent){
            obj.castShadow = false;
            obj.receiveShadow = true;
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
    dayTime+=dt*0.005;
    if(dayTime>1)dayTime-=1;

    const sunAngle=dayTime*Math.PI*2;
    const sunY=Math.sin(sunAngle);
    const sunX=Math.cos(sunAngle);

    sunLight.position.set(sunX*150,sunY*200,80);

    const dayB=Math.max(0,sunY);
    const nightB=Math.max(0,-sunY)*0.3;

    sunLight.intensity=dayB*1.0;
    ambientLight.intensity=0.4+dayB*0.4+nightB;

    const r=0.08+dayB*0.45;
    const g=0.08+dayB*0.72;
    const b=0.12+dayB*0.73;

    const sky=new THREE.Color(r,g,b);
    scene.background=sky;
    scene.fog.color=sky;

    sunLight.color.setHex(dayB<0.3&&dayB>0?0xff8844:0xfff5e0);
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

            attackNearestEntity();

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
            attackNearestEntity();
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

    renderer.domElement.requestPointerLock();
}

// ================================================================
// MODE HELPERS
// ================================================================
function startGame(mode){
    initAudio();

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

    if(gameMode!=='survival')clearZombies();

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
        dayTime=0.3;
        playerPos.set(0,getTerrainHeight(0,0)+3,0);
        disposeShowcaseDecor();
    }

    if(gameMode==='creative'){
        setupCreativeInventory();
        dayTime=0.30;
        playerPos.set(0,getTerrainHeight(0,0)+3,0);
        disposeShowcaseDecor();
    }

    if(gameMode==='showcase'){
        setupCreativeInventory();
        dayTime=0.22;
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
    addShowcaseLabel('ENTITY PEN','Cow mesh + animation + shadows',21,showcaseBaseY+5.7,6);
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

    const fireGeo=new THREE.BoxGeometry(0.35,0.35,0.35);
    const fireMat=new THREE.MeshBasicMaterial({
        color:0xffaa33,
        transparent:true,
        opacity:0.95
    });
    const fire=new THREE.Mesh(fireGeo,fireMat);
    fire.position.y=1.25;
    torchGroup.add(fire);

    const haloGeo=new THREE.SphereGeometry(0.38,12,12);
    const haloMat=new THREE.MeshBasicMaterial({
        color:0xffaa33,
        transparent:true,
        opacity:0.18,
        depthWrite:false
    });
    const halo=new THREE.Mesh(haloGeo,haloMat);
    halo.position.y=1.25;
    torchGroup.add(halo);

    const light=new THREE.PointLight(0xffaa55,1.45,18,2.1);
    light.position.set(x,y+1.25,z);
    light.castShadow=true;
    light.shadow.mapSize.width=512;
    light.shadow.mapSize.height=512;
    light.shadow.bias=-0.002;
    scene.add(light);

    torchGroup.userData.light=light;
    torchGroup.userData.fire=fire;
    torchGroup.userData.halo=halo;
    torchGroup.userData.baseIntensity=1.45;
    torchGroup.userData.phase=Math.random()*Math.PI*2;

    group.add(torchGroup);

    showcaseTorches.push({
        group:torchGroup,
        light,
        fire,
        halo,
        baseIntensity:1.45,
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

    for(const t of showcaseTorches){
        const flicker = 0.85 + Math.sin(gameTime*8 + t.phase)*0.08 + Math.random()*0.08;
        const intensity = t.baseIntensity * flicker;

        if(t.light){
            t.light.intensity=intensity;
        }

        if(t.fire){
            const s=0.9+Math.random()*0.22;
            t.fire.scale.set(s,1.0+Math.random()*0.18,s);
        }

        if(t.halo){
            const hs=0.9+Math.random()*0.25;
            t.halo.scale.set(hs,hs,hs);
            t.halo.material.opacity=0.12+Math.random()*0.08;
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

function clearShowcaseArea(){
    for(let x=-36;x<=40;x++){
        for(let z=-36;z<=40;z++){
            for(let y=1;y<WORLD_HEIGHT;y++){
                setBlock(x,y,z,BLOCK.AIR);
            }
        }
    }
}

function setupShowcaseStage(){
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

    // ============================================================
    // Zone 1: Block Gallery
    // ============================================================
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

    // ============================================================
    // Zone 2: Transparency Demo
    // ============================================================
    setBlockFrame(6,baseY,-27,34,-8,BLOCK.COBBLESTONE);

    setBlockBox(10,baseY,-24,18,baseY,-16,BLOCK.STONE);
    setBlockBox(10,baseY+1,-24,18,baseY+1,-16,BLOCK.GLASS);
    setBlockBox(10,baseY+2,-24,18,baseY+4,-24,BLOCK.GLASS);
    setBlockBox(10,baseY+2,-16,18,baseY+4,-16,BLOCK.GLASS);
    setBlockBox(10,baseY+2,-23,10,baseY+4,-17,BLOCK.GLASS);
    setBlockBox(18,baseY+2,-23,18,baseY+4,-17,BLOCK.GLASS);
    setBlockBox(11,baseY+5,-23,17,baseY+5,-17,BLOCK.GLASS);

    setBlockBox(23,baseY+1,-22,25,baseY+5,-20,BLOCK.LEAVES);

    setBlockBox(29,baseY+1,-23,30,baseY+5,-22,BLOCK.WATER);
    setBlockBox(31,baseY+1,-23,32,baseY+5,-22,BLOCK.GLASS);

    // ============================================================
    // Zone 3: Water Pool Demo
    // Glass aquarium-style natural water pool:
    // - glass wall makes the pool easier to understand visually
    // - water still uses natural lake/ocean rendering
    // - player-placed water elsewhere still renders as cube/block
    // ============================================================
    setBlockFrame(6,baseY,7,34,31,BLOCK.COBBLESTONE);

    // Outer foundation
    setBlockBox(9,baseY,10,31,baseY,28,BLOCK.STONE);

    // Sand floor under water
    setBlockBox(11,baseY,12,29,baseY,26,BLOCK.SAND);

    // Glass wall around pool
    setBlockBox(10,baseY+1,11,30,baseY+2,11,BLOCK.GLASS);
    setBlockBox(10,baseY+1,27,30,baseY+2,27,BLOCK.GLASS);
    setBlockBox(10,baseY+1,12,10,baseY+2,26,BLOCK.GLASS);
    setBlockBox(30,baseY+1,12,30,baseY+2,26,BLOCK.GLASS);

    // Natural water inside glass wall
    setNaturalWaterBox(11,baseY+1,12,29,baseY+1,26);

    // Small stair / entry outside the aquarium
    setBlockBox(7,baseY+1,17,9,baseY+1,22,BLOCK.SAND);
    setBlockBox(8,baseY+2,19,9,baseY+2,20,BLOCK.SAND);

    // Small bridge over the pool
    setBlockBox(18,baseY+2,11,22,baseY+2,27,BLOCK.PLANKS);
    setBlockBox(18,baseY+3,11,18,baseY+3,27,BLOCK.WOOD);
    setBlockBox(22,baseY+3,11,22,baseY+3,27,BLOCK.WOOD);

    // ============================================================
    // Zone 4: Raycast / Building Wall
    // ============================================================
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

    // ============================================================
    // Zone 5: Particle Demo
    // ============================================================
    setBlockFrame(-31,baseY,-5,-5,5,BLOCK.COBBLESTONE);

    for(let x=-27;x<=-9;x+=3){
        setBlock(x,baseY+1,0,BLOCK.STONE);
        setBlock(x,baseY+2,0,BLOCK.COBBLESTONE);
        setBlock(x,baseY+3,0,BLOCK.BRICK);
    }

    // ============================================================
    // Zone 6: Entity Demo
    // ============================================================
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

    // ============================================================
    // Zone 7: Point Light / Torch Demo
    // ============================================================
    setupTorchDemo();

    setupShowcaseCows();
    setupShowcaseLabels();

    if(typeof forceRebuildAllDirtyChunks === 'function'){
        forceRebuildAllDirtyChunks();
    }

    applyShadowFlagsToScene();

    dayTime=0.22;
    updateDayNight(0);
}

function setupShowcaseCows(){
    if(typeof cows==='undefined')return;

    for(const c of cows){
        if(c.mesh)scene.remove(c.mesh);
    }

    cows.length=0;

    for(let i=0;i<4;i++){
        spawnCow();
    }

    const positions=[
        [15,showcaseBaseY+1,0],
        [19,showcaseBaseY+1,1],
        [23,showcaseBaseY+1,-1],
        [27,showcaseBaseY+1,0]
    ];

    for(let i=0;i<cows.length&&i<positions.length;i++){
        const p=positions[i];
        cows[i].mesh.position.set(p[0],p[1],p[2]);
        cows[i].targetY=p[1];
        cows[i].prevY=p[1];
        cows[i].aiState='wander';
        cows[i].aiTimer=2+Math.random()*2;

        if(cows[i].mesh){
            cows[i].mesh.traverse(obj=>{
                if(obj.isMesh){
                    obj.castShadow=true;
                    obj.receiveShadow=true;
                }
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
        <div><b>Entity Pen:</b> cow mesh + animation + shadow</div>
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
    scene.fog=new THREE.Fog(0x87ceeb,40,RENDER_DIST*CHUNK_SIZE);

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

    ambientLight=new THREE.AmbientLight(0x606080,0.6);
    scene.add(ambientLight);

    sunLight=new THREE.DirectionalLight(0xfff5e0,0.9);
    sunLight.position.set(100,200,80);
    scene.add(sunLight);
    setupSunShadow();

    scene.add(new THREE.HemisphereLight(0x87ceeb,0x362907,0.4));

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

        e.preventDefault();
        mouseButtons[e.button]=true;
        pendingClicks[e.button]=true;
    });

    document.addEventListener('mouseup',(e)=>{
        mouseButtons[e.button]=false;
    });

    document.addEventListener('contextmenu',(e)=>e.preventDefault());

    document.addEventListener('keydown',(e)=>{
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

        selectedSlot=(selectedSlot+(e.deltaY>0?1:8))%9;
        updateHotbarSelection();
    });

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
            updateDayNight(dt*25);
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
            if(inWater){
                wOverlay.classList.add('active');
            }else{
                wOverlay.classList.remove('active');
            }
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