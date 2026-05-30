// ================================================================
// TEXTURE ATLAS (Procedural Pixel Art)
// ================================================================
const ATLAS_COLS=4,ATLAS_ROWS=4,TILE_PX=16;
const T={GRASS_TOP:0,GRASS_SIDE:1,DIRT:2,STONE:3,SAND:4,WOOD_SIDE:5,WOOD_TOP:6,LEAVES:7,WATER:8,COBBLE:9,PLANKS:10,SNOW:11,BEDROCK:12,GLASS:13,BRICK:14};
let atlasTexture,chunkMaterial,waterMaterial,glassMaterial;

function getBlockTileForFace(blockType,face){
    if(blockType===BLOCK.GRASS){
        if(face==='top')return T.GRASS_TOP;if(face==='bottom')return T.DIRT;return T.GRASS_SIDE;
    }
    if(blockType===BLOCK.WOOD){
        if(face==='top'||face==='bottom')return T.WOOD_TOP;return T.WOOD_SIDE;
    }
    const map={[BLOCK.DIRT]:T.DIRT,[BLOCK.STONE]:T.STONE,[BLOCK.SAND]:T.SAND,[BLOCK.LEAVES]:T.LEAVES,[BLOCK.WATER]:T.WATER,[BLOCK.COBBLESTONE]:T.COBBLE,[BLOCK.PLANKS]:T.PLANKS,[BLOCK.SNOW]:T.SNOW,[BLOCK.BEDROCK]:T.BEDROCK,[BLOCK.GLASS]:T.GLASS,[BLOCK.BRICK]:T.BRICK};
    return map[blockType]||T.STONE;
}

function generateAtlas(){
    const w=ATLAS_COLS*TILE_PX,h=ATLAS_ROWS*TILE_PX;
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;
    const cx=cv.getContext('2d');
    function tile(idx,fn){const col=idx%ATLAS_COLS,row=Math.floor(idx/ATLAS_COLS);cx.save();cx.translate(col*TILE_PX,row*TILE_PX);fn(cx);cx.restore();}
    function px(c,x,y,r,g,b){c.fillStyle=`rgb(${r|0},${g|0},${b|0})`;c.fillRect(x,y,1,1);}
    // 0: Grass Top
    tile(T.GRASS_TOP,(c)=>{for(let x=0;x<TILE_PX;x++)for(let y=0;y<TILE_PX;y++){const n=Math.random()*30-15;px(c,x,y,90+n,168+n,30+n*0.3);}});
    // 1: Grass Side
    tile(T.GRASS_SIDE,(c)=>{for(let x=0;x<TILE_PX;x++)for(let y=0;y<TILE_PX;y++){const n=Math.random()*15-7;if(y<3)px(c,x,y,90+n,168+n,30+n*0.3);else if(y===3){const d=Math.random()>0.4?1:0;px(c,x,y,d?100+n:134+n,d?145+n:96+n,d?40+n:67+n);}else px(c,x,y,134+n,96+n,67+n);}});
    // 2: Dirt
    tile(T.DIRT,(c)=>{for(let x=0;x<TILE_PX;x++)for(let y=0;y<TILE_PX;y++){const n=Math.random()*15-7;px(c,x,y,134+n,96+n,67+n);}});
    // 3: Stone
    tile(T.STONE,(c)=>{for(let x=0;x<TILE_PX;x++)for(let y=0;y<TILE_PX;y++){const n=Math.random()*20-10;const crack=Math.random()>0.92?-25:0;px(c,x,y,128+n+crack,128+n+crack,128+n+crack);}});
    // 4: Sand
    tile(T.SAND,(c)=>{for(let x=0;x<TILE_PX;x++)for(let y=0;y<TILE_PX;y++){const n=Math.random()*12-6;px(c,x,y,219+n,211+n,160+n);}});
    // 5: Wood Side (bark)
    tile(T.WOOD_SIDE,(c)=>{for(let x=0;x<TILE_PX;x++)for(let y=0;y<TILE_PX;y++){const n=Math.random()*10-5;const stripe=(x%4===0)?-20:0;px(c,x,y,120+n+stripe,84+n+stripe,50+n+stripe*0.5);}});
    // 6: Wood Top (rings)
    tile(T.WOOD_TOP,(c)=>{const cn=TILE_PX/2;for(let x=0;x<TILE_PX;x++)for(let y=0;y<TILE_PX;y++){const dx=x-cn,dy=y-cn;const d=Math.sqrt(dx*dx+dy*dy);const ring=Math.sin(d*1.5)*12;const n=Math.random()*8-4;px(c,x,y,116+ring+n,82+ring+n,48+ring+n);}});
    // 7: Leaves
    tile(T.LEAVES,(c)=>{for(let x=0;x<TILE_PX;x++)for(let y=0;y<TILE_PX;y++){const n=Math.random()*35-17;const gap=Math.random()>0.85?-20:0;px(c,x,y,55+n+gap,130+n+gap,35+n+gap);}});
    // 8: Water
    tile(T.WATER,(c)=>{for(let x=0;x<TILE_PX;x++)for(let y=0;y<TILE_PX;y++){const n=Math.random()*8-4;const wave=Math.sin(x*0.9+y*0.3)*10+Math.sin(y*0.6)*6;px(c,x,y,38+n+wave*0.3,85+n+wave*0.5,195+n+wave);}});
    // 9: Cobblestone
    tile(T.COBBLE,(c)=>{for(let x=0;x<TILE_PX;x++)for(let y=0;y<TILE_PX;y++){const n=Math.random()*20-10;const brick=Math.floor(x/5)%2===Math.floor(y/5)%2?12:-12;px(c,x,y,115+n+brick,115+n+brick,115+n+brick);}});
    // 10: Planks
    tile(T.PLANKS,(c)=>{for(let x=0;x<TILE_PX;x++)for(let y=0;y<TILE_PX;y++){const n=Math.random()*10-5;const line=(y%4===0)?-22:0;px(c,x,y,180+n+line,140+n+line,80+n+line*0.5);}});
    // 11: Snow
    tile(T.SNOW,(c)=>{for(let x=0;x<TILE_PX;x++)for(let y=0;y<TILE_PX;y++){const n=Math.random()*6-3;px(c,x,y,238+n,240+n,244+n);}});
    // 12: Bedrock
    tile(T.BEDROCK,(c)=>{for(let x=0;x<TILE_PX;x++)for(let y=0;y<TILE_PX;y++){const n=Math.random()*25-12;px(c,x,y,48+n,48+n,48+n);}});
    // 13: Glass
    tile(T.GLASS,(c)=>{for(let x=0;x<TILE_PX;x++)for(let y=0;y<TILE_PX;y++){if(x===0||y===0||x===TILE_PX-1||y===TILE_PX-1)px(c,x,y,180,210,220);else{const n=Math.random()*5-2;px(c,x,y,200+n,228+n,238+n);}}});
    // 14: Brick
    tile(T.BRICK,(c)=>{for(let x=0;x<TILE_PX;x++)for(let y=0;y<TILE_PX;y++){const n=Math.random()*10-5;const brickRow=Math.floor(y/4);const offset=brickRow%2===0?0:4;const bx=(x+offset)%8;if(y%4===0||bx===0)px(c,x,y,158+n,152+n,138+n);else px(c,x,y,178+n,92+n,68+n);}});
    
    atlasTexture=new THREE.CanvasTexture(cv);
    atlasTexture.magFilter=THREE.NearestFilter;
    atlasTexture.minFilter=THREE.NearestFilter;
    chunkMaterial=new THREE.MeshLambertMaterial({map:atlasTexture,vertexColors:true});

    waterMaterial=new THREE.MeshLambertMaterial({
        map:atlasTexture,
        vertexColors:true,
        transparent:true,
        opacity:0.55,
        side:THREE.DoubleSide,
        depthWrite:false
    });

    // Material riêng cho kính.
    // Không để kính đi chung chunkMaterial vì chunkMaterial là opaque,
    // làm block kính nhìn như khối đặc trong Graphics Showcase.
    glassMaterial=new THREE.MeshLambertMaterial({
        map:atlasTexture,
        vertexColors:true,
        transparent:true,
        opacity:0.34,
        side:THREE.DoubleSide,
        depthWrite:false
    });
}
