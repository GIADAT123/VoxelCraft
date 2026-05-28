// ================================================================
// BLOCK TYPES
// ================================================================
const BLOCK = { AIR:0, GRASS:1, DIRT:2, STONE:3, SAND:4, WOOD:5, LEAVES:6, WATER:7, COBBLESTONE:8, PLANKS:9, SNOW:10, BEDROCK:11, GLASS:12, BRICK:13, SWORD:-1 };
const BLOCK_DATA = {
    [BLOCK.GRASS]:{name:'Cỏ',color:[0.30,0.68,0.18],topColor:[0.36,0.75,0.22],bottomColor:[0.45,0.30,0.16],solid:true},
    [BLOCK.DIRT]:{name:'Đất',color:[0.45,0.30,0.16],solid:true},
    [BLOCK.STONE]:{name:'Đá',color:[0.50,0.50,0.50],solid:true},
    [BLOCK.SAND]:{name:'Cát',color:[0.82,0.75,0.47],solid:true},
    [BLOCK.WOOD]:{name:'Gỗ',color:[0.55,0.36,0.17],topColor:[0.45,0.55,0.22],solid:true},
    [BLOCK.LEAVES]:{name:'Lá',color:[0.20,0.50,0.12],solid:true,transparent:true},
    [BLOCK.WATER]:{name:'Nước',color:[0.15,0.35,0.80],solid:false,transparent:true,liquid:true},
    [BLOCK.COBBLESTONE]:{name:'Đá cuội',color:[0.40,0.40,0.40],solid:true},
    [BLOCK.PLANKS]:{name:'Ván gỗ',color:[0.65,0.50,0.28],solid:true},
    [BLOCK.SNOW]:{name:'Tuyết',color:[0.92,0.93,0.96],solid:true},
    [BLOCK.BEDROCK]:{name:'Bedrock',color:[0.20,0.20,0.20],solid:true,unbreakable:true},
    [BLOCK.GLASS]:{name:'Kính',color:[0.70,0.85,0.90],solid:true,transparent:true},
    [BLOCK.BRICK]:{name:'Gạch',color:[0.65,0.30,0.25],solid:true},
};
// Food item types
const ITEM = { BEEF: -2 };
const ITEM_DATA = {
    [ITEM.BEEF]: { name: 'Thịt bò', color: [0.70, 0.15, 0.15], healAmount: 30 },
};
function isFoodItem(type) { return ITEM_DATA[type] !== undefined; }
function getItemData(type) { return BLOCK_DATA[type] || ITEM_DATA[type]; }

function getBlockColor(type,face){const d=BLOCK_DATA[type];if(!d)return[1,0,1];if(face==='top'&&d.topColor)return d.topColor;if(face==='bottom'&&d.bottomColor)return d.bottomColor;const c=d.color.slice();if(face==='left'){c[0]*=0.9;c[1]*=0.9;}if(face==='right'){c[0]*=0.9;c[2]*=0.9;}if(face==='back'){c[1]*=0.85;c[2]*=0.85;}return c;}
