// ================================================================
// CORE GLOBALS
// ================================================================
let scene,camera,renderer,clock;
let isLocked=false,gameStarted=false,showDebug=false;
let dayTime=0.3;
let lastDayTime=0.3;
let gameTime=0;
let keys={},mouseButtons={},pendingClicks={};
let highlightMesh,sunLight,ambientLight;
let fpsFrames=0,fpsTime=0,fpsValue=60;
let noise,noise2,noise3;

// ================================================================
// AUDIO
// ================================================================
let audioCtx;
function initAudio(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();}
function playSound(freq,type,dur,vol){
    if(!audioCtx)return;
    try{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);const t=audioCtx.currentTime;o.type=type||'square';o.frequency.setValueAtTime(freq||200,t);o.frequency.exponentialRampToValueAtTime(40,t+(dur||0.2));g.gain.setValueAtTime(vol||0.08,t);g.gain.exponentialRampToValueAtTime(0.001,t+(dur||0.2));o.start(t);o.stop(t+(dur||0.2));}catch(e){}
}

// ================================================================
// DAY/NIGHT
// ================================================================
function updateDayNight(dt){
    dayTime+=dt*0.005;if(dayTime>1)dayTime-=1;
    const sunAngle=dayTime*Math.PI*2;const sunY=Math.sin(sunAngle);const sunX=Math.cos(sunAngle);
    sunLight.position.set(sunX*150,sunY*200,80);
    const dayB=Math.max(0,sunY);const nightB=Math.max(0,-sunY)*0.3;
    sunLight.intensity=dayB*1.0;ambientLight.intensity=0.4+dayB*0.4+nightB;
    const r=0.08+dayB*0.45,g=0.08+dayB*0.72,b=0.12+dayB*0.73;
    const sky=new THREE.Color(r,g,b);scene.background=sky;scene.fog.color=sky;
    sunLight.color.setHex(dayB<0.3&&dayB>0?0xff8844:0xfff5e0);
}

// ================================================================
// BLOCK INTERACTION (High Level)
// ================================================================
function updateBlockInteraction(dt){
    if(!isLocked||playerDead)return;
    const hit=raycast();

    // === RIGHT CLICK: eat food or place block ===
    if(pendingClicks[2]){
        pendingClicks[2]=false;
        const pb=hotbarItems[selectedSlot];
        if(isFoodItem(pb)){
            // Eat food
            const invCount=playerInventory[pb]||0;
            if(invCount>0&&playerHealth<playerMaxHealth){
                const heal=ITEM_DATA[pb].healAmount;
                playerHealth=Math.min(playerMaxHealth,playerHealth+heal);
                playerInventory[pb]--;
                if(playerInventory[pb]<=0){delete playerInventory[pb];hotbarItems[selectedSlot]=BLOCK.AIR;}
                updateHealthUI();buildHotbarUI();
                playSound(500,'sine',0.08,0.05);playSound(300,'sine',0.1,0.04);
                showHealToast(heal);
            }
        }else if(hit&&pb!==BLOCK.SWORD&&pb!==BLOCK.AIR){
            const invCount=playerInventory[pb]||0;
            if(invCount>0){
                const pMx=Math.floor(playerPos.x-0.3),pXx=Math.floor(playerPos.x+0.3),pMy=Math.floor(playerPos.y),pXy=Math.floor(playerPos.y+1.7),pMz=Math.floor(playerPos.z-0.3),pXz=Math.floor(playerPos.z+0.3);
                const isPlayerBlock=hit.placeX>=pMx&&hit.placeX<=pXx&&hit.placeY>=pMy&&hit.placeY<=pXy&&hit.placeZ>=pMz&&hit.placeZ<=pXz;
                if(!isPlayerBlock){
                    const existing=getBlock(hit.placeX,hit.placeY,hit.placeZ);
                    if(existing===BLOCK.AIR||existing===BLOCK.WATER){
                        setBlock(hit.placeX,hit.placeY,hit.placeZ,pb);
                        playerInventory[pb]--;
                        if(playerInventory[pb]<=0){delete playerInventory[pb];hotbarItems[selectedSlot]=BLOCK.AIR;}
                        buildHotbarUI();
                        playSound(400,'sine',0.08,0.05);
                    }
                }
            }
        }
    }

    // === LEFT CLICK: attack entity or break block ===
    if(hit){
        highlightMesh.visible=true;highlightMesh.position.set(hit.x+0.5,hit.y+0.5,hit.z+0.5);
        const selInfo = document.getElementById('selectionInfo');
        if (selInfo) {
            selInfo.style.display='block';
            selInfo.innerHTML=`<span class="label">Khối:</span> ${BLOCK_DATA[hit.block]?.name||'?'}<br><span class="label">Vị trí:</span> ${hit.x}, ${hit.y}, ${hit.z}`;
        }

        if(pendingClicks[0]){
            pendingClicks[0]=false;
            // Try attacking entity first
            attackNearestEntity();
            // Then try breaking block
            const bd=BLOCK_DATA[hit.block];
            if(bd&&bd.solid&&!bd.unbreakable){
                const brokenType=hit.block;
                setBlock(hit.x,hit.y,hit.z,BLOCK.AIR);
                spawnDropItem(brokenType,hit.x,hit.y,hit.z);
                playSound(200,'square',0.1,0.05);
                playSound(150,'sawtooth',0.08,0.04);
                if(hotbarItems[selectedSlot]===BLOCK.SWORD){swordSwingTime=0.3;}
            }
        }
    }else{
        highlightMesh.visible=false;
        const selInfo = document.getElementById('selectionInfo');
        if (selInfo) selInfo.style.display='none';
        if(pendingClicks[0]){pendingClicks[0]=false;attackNearestEntity();}
    }
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
    document.body.insertBefore(renderer.domElement,document.body.firstChild);
    clock=new THREE.Clock();
    generateAtlas();
    noise=new SimplexNoise(12345);noise2=new SimplexNoise(67890);noise3=new SimplexNoise(11111);
    ambientLight=new THREE.AmbientLight(0x606080,0.6);scene.add(ambientLight);
    sunLight=new THREE.DirectionalLight(0xfff5e0,0.9);sunLight.position.set(100,200,80);scene.add(sunLight);
    scene.add(new THREE.HemisphereLight(0x87ceeb,0x362907,0.4));
    const hlGeom=new THREE.BoxGeometry(1.005,1.005,1.005);
    highlightMesh=new THREE.Mesh(hlGeom,new THREE.MeshBasicMaterial({color:0x000000,wireframe:true,transparent:true,opacity:0.4}));
    highlightMesh.visible=false;scene.add(highlightMesh);
    scene.add(camera);
    createSwordMesh();
    buildHotbarUI();setupEvents();generateInitialWorld();
    playerPos.set(0,getTerrainHeight(0,0)+3,0);
    // Spawn initial cows
    for(let i=0;i<4;i++)spawnCow();
    animate();
}

// ================================================================
// EVENTS
// ================================================================
function setupEvents(){
    const canvas=renderer.domElement;
    canvas.addEventListener('click',()=>{if(gameStarted&&!isLocked&&!playerDead){if(inventoryOpen){toggleInventory();}canvas.requestPointerLock();}});
    document.addEventListener('pointerlockchange',()=>{
        isLocked=document.pointerLockElement===canvas;
        if(!isLocked&&gameStarted){
            if(inventoryOpen)return;
            document.getElementById('blocker').classList.remove('hidden');
            document.getElementById('crosshair').style.display='none';
            document.getElementById('hotbar').style.display='none';
            document.getElementById('debug').style.display='none';
            document.getElementById('blockTooltip').style.display='none';
            document.getElementById('selectionInfo').style.display='none';
        }
    });
    document.addEventListener('mousemove',(e)=>{
        if(!isLocked)return;
        yaw -= e.movementX * 0.002;
        pitch -= e.movementY * 0.002;
        pitch = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, pitch));
    });
    document.addEventListener('mousedown',(e)=>{if(!isLocked)return;e.preventDefault();mouseButtons[e.button]=true;pendingClicks[e.button]=true;});
    document.addEventListener('mouseup',(e)=>{mouseButtons[e.button]=false;});
    document.addEventListener('contextmenu',(e)=>e.preventDefault());
    document.addEventListener('keydown',(e)=>{
        keys[e.code]=true;
        if(e.code>='Digit1'&&e.code<='Digit9'){selectedSlot=parseInt(e.code.replace('Digit',''))-1;updateHotbarSelection();}
        if(e.code==='F3'){e.preventDefault();showDebug=!showDebug;document.getElementById('debug').style.display=showDebug?'block':'none';}
        if(e.code==='KeyE'&&gameStarted&&!playerDead){e.preventDefault();toggleInventory();}
        if(e.code==='Escape'&&inventoryOpen){toggleInventory();}
    });
    document.addEventListener('keyup',(e)=>{keys[e.code]=false;});
    document.addEventListener('wheel',(e)=>{if(!isLocked)return;selectedSlot=(selectedSlot+(e.deltaY>0?1:8))%9;updateHotbarSelection();});
    
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        playBtn.addEventListener('click',()=>{
            initAudio();gameStarted=true;
            document.getElementById('blocker').classList.add('hidden');
            document.getElementById('crosshair').style.display='block';
            document.getElementById('hotbar').style.display='flex';
            document.getElementById('blockTooltip').style.display='block';
            document.getElementById('healthBar').style.display='block';
            document.getElementById('killCounter').style.display='block';
            renderer.domElement.requestPointerLock();
        });
    }
    
    const respawnBtn = document.getElementById('respawnBtn');
    if (respawnBtn) respawnBtn.addEventListener('click',()=>{respawnPlayer();});
    
    window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);});
}

// ================================================================
// MAIN LOOP
// ================================================================
let chunkTimer=0,particleTimer=0,dropTimer=0,dayTimer=0;
let physicsAccumulator = 0;
const PHYSICS_STEP = 0.02; // 50 updates per second

function animate(){
    requestAnimationFrame(animate);
    let dt=clock.getDelta();
    // Less aggressive cap to avoid losing too much physics time, 
    // which caused the "rubber banding" sensation.
    if(dt > 0.5) dt = 0.5; 

    if(gameStarted){
        gameTime+=dt;
        physicsAccumulator += dt;
        
        // Process physics steps. We limit the number of steps per frame
        // to avoid "spiral of death" where one slow frame causes even more work.
        let stepsThisFrame = 0;
        while(physicsAccumulator >= PHYSICS_STEP && stepsThisFrame < 15) {
            updatePlayer(PHYSICS_STEP);
            physicsAccumulator -= PHYSICS_STEP;
            stepsThisFrame++;
        }
        
        // Cap the accumulator so we don't get stuck in a catch-up loop forever
        if(physicsAccumulator > 0.2) physicsAccumulator = 0.2;

        updateBlockInteraction(dt);
        dayTimer+=dt;if(dayTimer>0.5){dayTimer=0;updateDayNight(0.5);}
        updateZombies(dt);updateCows(dt);
        particleTimer+=dt;if(particleTimer>0.05){particleTimer=0;updateParticles(0.05);}
        updateSwordAnimation(dt);
        dropTimer+=dt;if(dropTimer>0.033){dropTimer=0;updateDropItems(0.033);}
        
        // Throttle chunk updates more effectively
        chunkTimer+=dt;
        if(chunkTimer>0.3){
            chunkTimer=0;
            updateChunks();
        }
        // Water overlay
        const wOverlay=document.getElementById('waterOverlay');
        if (wOverlay) {
            if(inWater)wOverlay.classList.add('active');else wOverlay.classList.remove('active');
        }
        if(showDebug){
            fpsFrames++;fpsTime+=dt;if(fpsTime>=0.5){fpsValue=Math.round(fpsFrames/fpsTime);fpsFrames=0;fpsTime=0;}
            updateDebug();
        }
    }
    renderer.render(scene,camera);
}

init();
