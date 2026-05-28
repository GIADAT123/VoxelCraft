// ================================================================
// WORLD CONFIG
// ================================================================
const CHUNK_SIZE=16, WORLD_HEIGHT=48, RENDER_DIST=3, WATER_LEVEL=18;

// ================================================================
// WORLD GLOBALS
// ================================================================
let chunks={},chunkMeshes={};
let waterMeshes=[];
let chunkGenQueue=[];

// ================================================================
// TERRAIN
// ================================================================
function fbm(x,z,octaves,lac,pers){let v=0,a=1,f=1,m=0;for(let i=0;i<octaves;i++){v+=noise.noise2D(x*f,z*f)*a;m+=a;a*=pers;f*=lac;}return v/m;}
function getTerrainHeight(wx,wz){
    let h=fbm(wx*0.002,wz*0.002,4,2.0,0.5)*30;
    h+=noise2.noise2D(wx*0.01,wz*0.01)*8;
    h+=noise2.noise2D(wx*0.05,wz*0.05)*3;
    const ridge=1-Math.abs(noise3.noise2D(wx*0.006,wz*0.006));const rv=ridge*ridge;
    if(rv>0.35)h+=(rv-0.35)*40;
    return Math.floor(h+24);
}
function shouldPlaceTree(wx,wz,h){if(h<=WATER_LEVEL+1||h>36)return false;return noise3.noise2D(wx*0.5,wz*0.5)>0.75;}

function generateChunk(cx,cz){
    const key=cx+','+cz;if(chunks[key])return;
    const data=new Uint8Array(CHUNK_SIZE*WORLD_HEIGHT*CHUNK_SIZE);
    for(let x=0;x<CHUNK_SIZE;x++){for(let z=0;z<CHUNK_SIZE;z++){
        const wx=cx*CHUNK_SIZE+x,wz=cz*CHUNK_SIZE+z,h=getTerrainHeight(wx,wz);
        for(let y=0;y<WORLD_HEIGHT;y++){let block=BLOCK.AIR;
            if(y===0)block=BLOCK.BEDROCK;
            else if(y<h-4){
                block=BLOCK.STONE;
                // Optimized cave generation: reduce noise calls by only checking certain layers
                // and using a coarser grid for the cave density check.
                if(y>5 && y<h-8 && (y%2===0)){ 
                    const c1=noise.noise3D(wx*0.05,y*0.05,wz*0.05);
                    if(c1>0.5)block=BLOCK.AIR;
                }
            }
            else if(y<h-1)block=h<=WATER_LEVEL+2?BLOCK.SAND:BLOCK.DIRT;
            else if(y===h-1||y===h){if(h<=WATER_LEVEL+1)block=BLOCK.SAND;else if(h>36)block=BLOCK.SNOW;else block=BLOCK.GRASS;}
            else if(y<=WATER_LEVEL&&y>h)block=BLOCK.WATER;
            data[x*WORLD_HEIGHT*CHUNK_SIZE+y*CHUNK_SIZE+z]=block;}
        if(shouldPlaceTree(wx,wz,h)){const tH=4+Math.floor(noise.noise2D(wx*1.3,wz*1.3)*2+2);
            for(let ty=1;ty<=tH;ty++){const yy=h+ty;if(yy>=WORLD_HEIGHT)break;data[x*WORLD_HEIGHT*CHUNK_SIZE+yy*CHUNK_SIZE+z]=BLOCK.WOOD;}
            for(let lx=-2;lx<=2;lx++)for(let lz=-2;lz<=2;lz++)for(let ly=tH-2;ly<=tH+1;ly++){
                if(Math.abs(lx)===2&&Math.abs(lz)===2&&Math.random()>0.5)continue;if(ly===tH+1&&(Math.abs(lx)>1||Math.abs(lz)>1))continue;
                const tx=x+lx,tz=z+lz,ty=h+ly;if(tx<0||tx>=CHUNK_SIZE||tz<0||tz>=CHUNK_SIZE||ty>=WORLD_HEIGHT)continue;
                const idx=tx*WORLD_HEIGHT*CHUNK_SIZE+ty*CHUNK_SIZE+tz;if(data[idx]===BLOCK.AIR)data[idx]=BLOCK.LEAVES;}}
    }}
    chunks[key]=data;buildChunkMesh(cx,cz);
}

function getBlock(wx,wy,wz){if(wy<0||wy>=WORLD_HEIGHT)return BLOCK.AIR;const cx=Math.floor(wx/CHUNK_SIZE),cz=Math.floor(wz/CHUNK_SIZE);const c=chunks[cx+','+cz];if(!c)return BLOCK.AIR;return c[((wx%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE*WORLD_HEIGHT*CHUNK_SIZE+wy*CHUNK_SIZE+((wz%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE];}
function setBlock(wx,wy,wz,type){if(wy<0||wy>=WORLD_HEIGHT)return;const cx=Math.floor(wx/CHUNK_SIZE),cz=Math.floor(wz/CHUNK_SIZE);const key=cx+','+cz;let c=chunks[key];if(!c)return;const lx=((wx%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE,lz=((wz%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;c[lx*WORLD_HEIGHT*CHUNK_SIZE+wy*CHUNK_SIZE+lz]=type;buildChunkMesh(cx,cz);if(lx===0&&chunks[(cx-1)+','+cz])buildChunkMesh(cx-1,cz);if(lx===CHUNK_SIZE-1&&chunks[(cx+1)+','+cz])buildChunkMesh(cx+1,cz);if(lz===0&&chunks[cx+','+(cz-1)])buildChunkMesh(cx,cz-1);if(lz===CHUNK_SIZE-1&&chunks[cx+','+(cz+1)])buildChunkMesh(cx,cz+1);}

// ================================================================
// CHUNK MESH
// ================================================================
const FACE_DIRS=[
    {dir:[0,1,0],face:'top',verts:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]]},
    {dir:[0,-1,0],face:'bottom',verts:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]},
    {dir:[1,0,0],face:'right',verts:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]]},
    {dir:[-1,0,0],face:'left',verts:[[0,0,1],[0,1,1],[0,1,0],[0,0,0]]},
    {dir:[0,0,1],face:'front',verts:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]},
    {dir:[0,0,-1],face:'back',verts:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]]},
];
function isSolid(bt){const d=BLOCK_DATA[bt];return d?d.solid:false;}
function isTransparent(bt){const d=BLOCK_DATA[bt];return d?!!d.transparent:true;}

function buildChunkMesh(cx,cz){
    const key=cx+','+cz;const chunk=chunks[key];if(!chunk)return;
    if(chunkMeshes[key]){chunkMeshes[key].forEach(m=>{scene.remove(m);m.geometry.dispose();});waterMeshes=waterMeshes.filter(m=>{if(m.userData.chunkKey===key){scene.remove(m);m.geometry.dispose();return false;}return true;});}
    const positions=[],colors=[],normals=[],indices=[],uvs=[];
    const wp=[],wc=[],wn=[],wi=[],wuvs=[];
    let vc=0,wvc=0;const ox=cx*CHUNK_SIZE,oz=cz*CHUNK_SIZE;
    for(let x=0;x<CHUNK_SIZE;x++)for(let y=0;y<WORLD_HEIGHT;y++)for(let z=0;z<CHUNK_SIZE;z++){
        const block=chunk[x*WORLD_HEIGHT*CHUNK_SIZE+y*CHUNK_SIZE+z];if(block===BLOCK.AIR)continue;
        const isW=block===BLOCK.WATER;
        for(let f=0;f<6;f++){const face=FACE_DIRS[f];
            const lx=x+face.dir[0],ly=y+face.dir[1],lz=z+face.dir[2];
            let nb=BLOCK.AIR;
            if(ly>=0&&ly<WORLD_HEIGHT){
                if(lx>=0&&lx<CHUNK_SIZE&&lz>=0&&lz<CHUNK_SIZE){
                    nb=chunk[lx*WORLD_HEIGHT*CHUNK_SIZE+ly*CHUNK_SIZE+lz];
                }else{
                    nb=getBlock(ox+lx,ly,oz+lz);
                }
            }
            let show=false;if(isW)show=nb===BLOCK.AIR||(nb!==BLOCK.WATER&&isTransparent(nb));else show=nb===BLOCK.AIR||isTransparent(nb);
            if(!show)continue;
            // Color variation using fast hash instead of noise
            const h=((x*7919+y*104729+z*15485863+face.dir[0]*31+face.dir[2]*37)&0xff)/255;
            const cn=(h-0.5)*0.1;
            const r=Math.max(0.88,Math.min(1.12,1+cn));
            const g=Math.max(0.88,Math.min(1.12,1+cn));
            const b=Math.max(0.88,Math.min(1.12,1+cn));
            // UV tile calculation
            const tileIdx=isW?T.WATER:getBlockTileForFace(block,face.face);
            const tCol=tileIdx%ATLAS_COLS,tRow=Math.floor(tileIdx/ATLAS_COLS);
            const tu0=tCol/ATLAS_COLS,tu1=(tCol+1)/ATLAS_COLS;
            const tv0=1-(tRow+1)/ATLAS_ROWS,tv1=1-tRow/ATLAS_ROWS;
            const p=isW?wp:positions,c=isW?wc:colors,n=isW?wn:normals,idx=isW?wi:indices,uv=isW?wuvs:uvs;
            let v=isW?wvc:vc;
            for(let vv=0;vv<4;vv++){p.push(ox+x+face.verts[vv][0],y+face.verts[vv][1],oz+z+face.verts[vv][2]);c.push(r,g,b);n.push(face.dir[0],face.dir[1],face.dir[2]);}
            uv.push(tu0,tv1,tu1,tv1,tu1,tv0,tu0,tv0);
            idx.push(v,v+1,v+2,v,v+2,v+3);if(isW)wvc+=4;else vc+=4;}}
    const meshes=[];
    if(positions.length>0){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);const m=new THREE.Mesh(g,chunkMaterial);scene.add(m);meshes.push(m);}
    if(wp.length>0){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(wp,3));g.setAttribute('color',new THREE.Float32BufferAttribute(wc,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(wn,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(wuvs,2));g.setIndex(wi);const m=new THREE.Mesh(g,waterMaterial);m.userData.chunkKey=key;scene.add(m);waterMeshes.push(m);}
    chunkMeshes[key]=meshes;
}

// ================================================================
// CHUNK MANAGEMENT
// ================================================================
function generateInitialWorld(){for(let x=-RENDER_DIST;x<=RENDER_DIST;x++)for(let z=-RENDER_DIST;z<=RENDER_DIST;z++)generateChunk(x,z);}
function updateChunks(){const pcx=Math.floor(playerPos.x/CHUNK_SIZE),pcz=Math.floor(playerPos.z/CHUNK_SIZE);
    // Build queue of missing chunks (sorted by distance)
    chunkGenQueue=[];
    for(let x=-RENDER_DIST;x<=RENDER_DIST;x++)for(let z=-RENDER_DIST;z<=RENDER_DIST;z++){const cx=pcx+x,cz=pcz+z;if(!chunks[cx+','+cz])chunkGenQueue.push({cx,cz,d:Math.abs(x)+Math.abs(z)});}
    chunkGenQueue.sort((a,b)=>a.d-b.d);
    // Generate at most 1 chunk per call (spread load)
    if(chunkGenQueue.length>0)generateChunk(chunkGenQueue[0].cx,chunkGenQueue[0].cz);
    // Unload far chunks
    for(const key in chunkMeshes){const[cx,cz]=key.split(',').map(Number);if(Math.abs(cx-pcx)>RENDER_DIST+1||Math.abs(cz-pcz)>RENDER_DIST+1){chunkMeshes[key].forEach(m=>{scene.remove(m);m.geometry.dispose();});delete chunkMeshes[key];delete chunks[key];}}
}

// ================================================================
// RAYCASTING
// ================================================================
function raycast(maxDist){
    maxDist=maxDist||6;
    const dir=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)).normalize();
    const pos=camera.position.clone();const step=0.05;let px,py,pz;
    for(let d=0;d<maxDist;d+=step){const x=Math.floor(pos.x+dir.x*d),y=Math.floor(pos.y+dir.y*d),z=Math.floor(pos.z+dir.z*d);
        if(isSolid(getBlock(x,y,z)))return{x,y,z,block:getBlock(x,y,z),placeX:px!==undefined?px:x,placeY:py!==undefined?py:y,placeZ:pz!==undefined?pz:z};
        px=x;py=y;pz=z;}return null;
}
