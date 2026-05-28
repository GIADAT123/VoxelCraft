// ================================================================
// UI UPDATES
// ================================================================
function updateHealthUI() {
    const pct = Math.max(0, Math.round(playerHealth / playerMaxHealth * 100));
    const healthFill = document.getElementById('healthFill');
    if (healthFill) healthFill.style.width = pct + '%';

    const healthText = document.getElementById('healthText');
    if (healthText) healthText.textContent = Math.round(playerHealth);

    const healthPct = document.getElementById('healthPct');
    if (healthPct) healthPct.textContent = pct + '%';

    const fill = document.getElementById('healthFill');
    if (fill) {
        if (pct > 50) {
            fill.style.background = 'linear-gradient(180deg, #e44 0%, #b22 100%)';
        } else if (pct > 25) {
            fill.style.background = 'linear-gradient(180deg, #e84 0%, #c42 100%)';
        } else {
            fill.style.background = 'linear-gradient(180deg, #f44 0%, #a00 100%)';
        }
    }
}

function updateKillUI() {
    const killValue = document.getElementById('killValue');
    if (killValue) killValue.textContent = totalKills;
}

function showWaveAlert(wave) {
    const el = document.getElementById('waveAlert');
    if (!el) return;

    const waveNum = document.getElementById('waveNum');
    if (waveNum) waveNum.textContent = 'Đợt ' + wave;

    const texts = [
        'Chúng đang đến...',
        'Lũ zombies tấn công!',
        'Sức mạnh tăng lên!',
        'Đây là điềm báo...',
        'Cơn ác mộng bắt đầu!'
    ];

    const waveText = document.getElementById('waveText');
    if (waveText) waveText.textContent = texts[Math.min(wave - 1, texts.length - 1)];

    el.classList.add('show');
    playSound(80, 'sawtooth', 0.5, 0.1);

    setTimeout(() => {
        el.classList.remove('show');
    }, 3500);
}

// ================================================================
// ICON HELPERS
// ================================================================
function createWaterBucketIcon() {
    const wrap = document.createElement('div');

    wrap.style.cssText = `
        position: relative;
        width: 32px;
        height: 32px;
        line-height: 32px;
        text-align: center;
        font-size: 24px;
        filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.8));
    `;

    wrap.textContent = '🪣';

    const drop = document.createElement('span');
    drop.textContent = '💧';
    drop.style.cssText = `
        position: absolute;
        right: -3px;
        bottom: -5px;
        font-size: 13px;
        line-height: 13px;
    `;

    wrap.appendChild(drop);

    return wrap;
}

function appendItemCount(slot, item) {
    const cnt = playerInventory[item] || 0;

    if (cnt > 0) {
        const cs = document.createElement('span');
        cs.style.cssText = `
            position: absolute;
            bottom: 2px;
            right: 3px;
            font-size: 10px;
            color: #fff;
            font-weight: 700;
            text-shadow: 1px 1px 2px #000;
        `;
        cs.textContent = cnt;
        slot.appendChild(cs);
    }
}

// ================================================================
// HOTBAR UI
// ================================================================
function buildHotbarUI() {
    const c = document.getElementById('hotbar');
    if (!c) return;

    c.innerHTML = '';

    for (let i = 0; i < 9; i++) {
        const s = document.createElement('div');
        s.className = 'hotbar-slot' + (i === selectedSlot ? ' active' : '');
        s.id = 'slot-' + i;

        const n = document.createElement('span');
        n.className = 'slot-num';
        n.textContent = i + 1;
        s.appendChild(n);

        const item = hotbarItems[i];

        if (item === BLOCK.SWORD) {
            const swordDiv = document.createElement('div');
            swordDiv.style.cssText = `
                font-size: 24px;
                line-height: 32px;
                color: #ccc;
                text-shadow: 1px 1px 2px #000;
            `;
            swordDiv.textContent = '⚔';
            s.appendChild(swordDiv);

        } else if (isFoodItem(item)) {
            const foodDiv = document.createElement('div');
            foodDiv.style.cssText = `
                font-size: 24px;
                line-height: 32px;
                color: #c44;
                text-shadow: 1px 1px 2px #000;
            `;
            foodDiv.textContent = '🥩';
            s.appendChild(foodDiv);

            appendItemCount(s, item);

            const nm = document.createElement('span');
            nm.className = 'block-name';
            nm.textContent = ITEM_DATA[item].name;
            s.appendChild(nm);

        } else if (item === BLOCK.WATER) {
            s.appendChild(createWaterBucketIcon());

            appendItemCount(s, item);

            const nm = document.createElement('span');
            nm.className = 'block-name';
            nm.textContent = 'Xô nước';
            s.appendChild(nm);

        } else if (item !== BLOCK.AIR && BLOCK_DATA[item]) {
            const p = document.createElement('div');
            p.className = 'block-preview';

            const bd = BLOCK_DATA[item];
            const cl = bd.color;

            p.style.background = `rgb(${cl[0] * 255},${cl[1] * 255},${cl[2] * 255})`;

            if (bd.topColor) {
                const tc = bd.topColor;
                p.style.borderTop = `4px solid rgb(${tc[0] * 255},${tc[1] * 255},${tc[2] * 255})`;
            }

            if (bd.transparent) {
                p.style.opacity = '0.7';
                p.style.border = '1px solid rgba(255,255,255,0.3)';
            }

            s.appendChild(p);
            appendItemCount(s, item);

            const nm = document.createElement('span');
            nm.className = 'block-name';
            nm.textContent = bd.name;
            s.appendChild(nm);

        } else {
            const p = document.createElement('div');
            p.className = 'block-preview';
            p.style.cssText = `
                background: rgba(40,40,40,0.6);
                border: 1px dashed rgba(100,100,100,0.3);
            `;
            s.appendChild(p);
        }

        c.appendChild(s);
    }
}

function updateHotbarSelection() {
    for (let i = 0; i < 9; i++) {
        const s = document.getElementById('slot-' + i);
        if (s) s.className = 'hotbar-slot' + (i === selectedSlot ? ' active' : '');
    }

    const sel = hotbarItems[selectedSlot];
    const tooltip = document.getElementById('blockTooltip');

    if (tooltip) {
        tooltip.textContent =
            sel === BLOCK.SWORD ? 'Kiếm' :
            isFoodItem(sel) ? ITEM_DATA[sel].name :
            sel === BLOCK.WATER ? 'Xô nước' :
            BLOCK_DATA[sel]?.name || '';
    }
}

function showPickupToast(blockType) {
    const bd = getItemData(blockType);
    if (!bd) return;

    const toast = document.getElementById('pickupToast');
    if (!toast) return;

    const text = document.getElementById('pickupText');
    if (!text) return;

    text.textContent = '+1 ' + bd.name;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
        text.style.color = '';
    }, 1200);
}

function showHealToast(amount) {
    const toast = document.getElementById('pickupToast');
    if (!toast) return;

    const text = document.getElementById('pickupText');
    if (!text) return;

    text.textContent = '+' + amount + ' HP';
    text.style.color = '#4f4';
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
        text.style.color = '';
    }, 1200);
}

function updateDebug() {
    if (!showDebug) return;

    const debugEl = document.getElementById('debug');

    if (debugEl) {
        debugEl.innerHTML =
            `<span class="label">FPS:</span> ${fpsValue}<br>` +
            `<span class="label">XYZ:</span> ${playerPos.x.toFixed(1)} / ${playerPos.y.toFixed(1)} / ${playerPos.z.toFixed(1)}<br>` +
            `<span class="label">Chunk:</span> ${Math.floor(playerPos.x / CHUNK_SIZE)}, ${Math.floor(playerPos.z / CHUNK_SIZE)}<br>` +
            `<span class="label">Zombies:</span> ${zombies.length}<br>` +
            `<span class="label">Kills:</span> ${totalKills}<br>` +
            `<span class="label">Wave:</span> ${zombieWave}<br>` +
            `<span class="label">Day:</span> ${(dayTime * 100).toFixed(0)}%<br>` +
            `<span class="label">Health:</span> ${Math.round(playerHealth)}/${playerMaxHealth}<br>` +
            `<span class="label">In Water:</span> ${inWater ? 'Yes' : 'No'}<br>` +
            `<span class="label">On Ground:</span> ${onGround ? 'Yes' : 'No'}`;
    }
}