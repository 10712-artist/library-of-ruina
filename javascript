// ==========================================
// 1. 카드 데이터베이스 (맨 위에 선언하여 순서 오류 방지)
// ==========================================
const CARD_DATABASE = [
    { 
        id: 1, name: "묵직한 강타", cost: 1, 
        img: "https://placehold.co/160x100/450a0a/fca5a5?text=Heavy+Slash",
        effectText: "[적중 시] 다음 막 취약 2",
        dice: [{ min: 6, max: 14, type: "공격", hitEffect: (target) => { target.vulnerable += 2; addLog(`  💥 적중! 다음 막 취약 2 부여`, 'log-effect'); } }] 
    },
    { 
        id: 2, name: "연속 베기", cost: 1, 
        img: "https://placehold.co/160x100/172554/93c5fd?text=Combo+Strike",
        effectText: "[사용 시] 카드 1장 드로우",
        onUse: (user) => { user.drawCards(1); addLog(`  🎴 [사용 시] 카드 1장 드로우`, 'log-effect'); },
        dice: [{ min: 3, max: 7, type: "공격" }, { min: 2, max: 6, type: "공격" }] 
    },
    { 
        id: 3, name: "기회를 노리다", cost: 1, 
        img: "https://placehold.co/160x100/064e3b/6ee7b7?text=Opportunity",
        effectText: "[사용 시] 빛 1 회복",
        onUse: (user) => { user.currentLight = Math.min(user.maxLight, user.currentLight + 1); addLog(`  💡 [사용 시] 빛 1 회복`, 'log-effect'); },
        dice: [{ min: 4, max: 8, type: "회피" }, { min: 3, max: 7, type: "공격" }] 
    },
    { 
        id: 4, name: "견고한 방어", cost: 1, 
        img: "https://placehold.co/160x100/365314/bef264?text=Solid+Guard",
        effectText: "[합 승리 시] 상대 흐트러짐 +5",
        dice: [
            { min: 4, max: 9, type: "방어", winEffect: (user, target) => { target.takeStaggerDamage(5); addLog(`  🛡️ [합 승리] 상대 흐트러짐 +5 피해`, 'log-effect'); } }, 
            { min: 3, max: 7, type: "방어" }
        ] 
    },
    { 
        id: 5, name: "사념 사격", cost: 3, 
        img: "https://placehold.co/160x100/581c87/e9d5ff?text=Mind+Shot",
        effectText: "4연속 강력 사격",
        dice: [{ min: 3, max: 8, type: "공격" }, { min: 3, max: 7, type: "공격" }, { min: 2, max: 6, type: "공격" }, { min: 4, max: 9, type: "공격" }] 
    }
];

const DEFAULT_ATTACK_CARD = {
    name: "기본 공격",
    cost: 0,
    img: "https://placehold.co/160x100/1e293b/f8fafc?text=Basic+Attack",
    effectText: "기본 몸가짐",
    dice: [{ min: 1, max: 6, type: "공격" }]
};

const EGO_CARDS = [
    { 
        id: 99, name: "E.G.O: 마탄", cost: 3, isEgo: true, 
        img: "https://placehold.co/160x100/701a75/f5d0fe?text=EGO+Magic+Bullet",
        effectText: "광역 고위력 연속 사격", 
        dice: [{ min: 8, max: 16, type: "공격" }, { min: 7, max: 14, type: "공격" }] 
    }
];

const ABNO_CARDS_POOL = [
    { name: "식탐", desc: "합 승리 시 HP를 3 회복합니다.", effect: "heal" },
    { name: "눈물로 벼린 칼", desc: "모든 주사위 위력이 +2 증가합니다.", effect: "power" },
    { name: "혈귀의 포식", desc: "적에게 주는 피해량이 25% 증가합니다.", effect: "dmg_up" }
];

// ==========================================
// 2. 유닛 클래스 정의
// ==========================================
class Unit {
    constructor(name, isPlayer) {
        this.name = name;
        this.isPlayer = isPlayer;
        this.maxHp = 100;
        this.hp = 100;
        this.maxStagger = 70;
        this.stagger = 70;
        this.isStaggered = false;
        
        this.maxLight = 3;
        this.currentLight = 3;
        this.emotionLevel = 0;
        this.emotionCoins = 0;
        this.vulnerable = 0;
        
        this.abnoPages = [];
        this.egoHand = [];

        this.deck = [];
        this.hand = [];
        this.grave = [];

        this.initDeck();
    }

    initDeck() {
        const baseDeck = [
            CARD_DATABASE[0], CARD_DATABASE[0],
            CARD_DATABASE[1], CARD_DATABASE[1],
            CARD_DATABASE[2], CARD_DATABASE[2],
            CARD_DATABASE[3], CARD_DATABASE[3],
            CARD_DATABASE[4]
        ];
        this.deck = [...baseDeck].sort(() => Math.random() - 0.5);
        this.drawCards(4); // 시작 시 카드 4장 드로우
    }

    drawCards(count) {
        for (let i = 0; i < count; i++) {
            if (this.hand.length >= 5) break;
            
            if (this.deck.length === 0) {
                if (this.grave.length === 0) break;
                this.deck = [...this.grave].sort(() => Math.random() - 0.5);
                this.grave = [];
                addLog(`🔄 [${this.name}] 버린 카드 더미를 다시 섞어 덱을 만듭니다.`, 'log-effect');
            }
            
            this.hand.push(this.deck.pop());
        }
    }

    get coinsForNextLevel() {
        return 3 + (this.emotionLevel * 2);
    }

    takeStaggerDamage(amount) {
        if (this.isStaggered) return;
        this.stagger = Math.max(0, this.stagger - amount);
        if (this.stagger === 0) {
            this.isStaggered = true;
            addLog(`💫 [${this.name}] 흐트러짐 상태에 빠졌습니다! (1턴간 무력화)`, 'log-stagger');
        }
    }

    recoverStagger(amount) {
        if (this.isStaggered) return;
        this.stagger = Math.min(this.maxStagger, this.stagger + amount);
    }

    gainEmotionCoin(amount) {
        if (this.emotionLevel >= 5) return;
        this.emotionCoins += amount;
        
        if (this.emotionCoins >= this.coinsForNextLevel) {
            this.emotionCoins -= this.coinsForNextLevel;
            this.emotionLevel++;
            this.maxLight++;
            this.currentLight = this.maxLight;

            addLog(`★ [${this.name}] 감정 단계 상승! ➔ Lv.${this.emotionLevel} (빛 회복 & 최대 빛 +1)`, 'log-level-up');

            if (this.emotionLevel === 3 && this.egoHand.length === 0) {
                this.egoHand.push(EGO_CARDS[0]);
                addLog(`✨ [E.G.O 해금!] <${EGO_CARDS[0].name}> 책장이 슬롯에 추가되었습니다!`, 'log-ego');
            }

            if (this.isPlayer) openAbnoSelectModal();
        }
    }

    startNewScene() {
        if (this.isStaggered) {
            this.isStaggered = false;
            this.stagger = this.maxStagger;
            addLog(`🛡️ [${this.name}] 흐트러짐 상태에서 회복되었습니다.`, 'log-stagger');
        }
        
        this.currentLight = Math.min(this.maxLight, this.currentLight + 1);
        this.drawCards(1);
        this.vulnerable = 0;
    }
}

// Global Variables
let scene = 1;
let player = new Unit("롤랑", true);
let enemy = new Unit("핏빛밤", false);
let selectedCardInfo = null;

// ==========================================
// 3. 이벤트 바인딩 및 초기화
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    const btnClash = document.getElementById('btn-clash');
    const btnTut = document.getElementById('btn-tut');
    const btnCloseTut = document.getElementById('btn-close-tut');
    const btnCloseTutX = document.getElementById('btn-close-tut-x');

    if (btnClash) btnClash.addEventListener('click', startClash);
    if (btnTut) btnTut.addEventListener('click', openTutorial);
    if (btnCloseTut) btnCloseTut.addEventListener('click', closeTutorial);
    if (btnCloseTutX) btnCloseTutX.addEventListener('click', closeTutorial);
    
    // 키보드 단축키 (스페이스바)
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            closeTutorial();
            startClash();
        }
    });

    renderUI();
    openTutorial(); // 시작 시 강제 튜토리얼 오픈
});

function openTutorial() {
    const tutModal = document.getElementById('tutorial-panel');
    if (tutModal) tutModal.classList.remove('hidden');
}

function closeTutorial() {
    const tutModal = document.getElementById('tutorial-panel');
    if (tutModal) tutModal.classList.add('hidden');
}

// 화면 충격 및 이펙트 재생
function triggerClashEffects() {
    const gameContainer = document.getElementById('game-container');
    const fxOverlay = document.getElementById('fx-overlay');

    if (gameContainer && fxOverlay) {
        gameContainer.classList.remove('shake');
        fxOverlay.classList.remove('clash-flash');

        void gameContainer.offsetWidth; // 애니메이션 리셋 리플로우

        gameContainer.classList.add('shake');
        fxOverlay.classList.add('clash-flash');

        setTimeout(() => {
            gameContainer.classList.remove('shake');
            fxOverlay.classList.remove('clash-flash');
        }, 350);
    }
}

// ==========================================
// 4. UI 렌더링 함수
// ==========================================
function renderUI() {
    document.getElementById('p-hp-text').innerText = `${player.hp}/${player.maxHp}`;
    document.getElementById('p-hp-bar').style.width = `${(player.hp / player.maxHp) * 100}%`;
    document.getElementById('p-stagger-text').innerText = `${player.stagger}/${player.maxStagger}`;
    document.getElementById('p-stagger-bar').style.width = `${(player.stagger / player.maxStagger) * 100}%`;
    
    document.getElementById('e-hp-text').innerText = `${enemy.hp}/${enemy.maxHp}`;
    document.getElementById('e-hp-bar').style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
    document.getElementById('e-stagger-text').innerText = `${enemy.stagger}/${enemy.maxStagger}`;
    document.getElementById('e-stagger-bar').style.width = `${(enemy.stagger / enemy.maxStagger) * 100}%`;

    document.getElementById('p-status-effects').innerText = player.vulnerable > 0 ? `취약 ${player.vulnerable}` : '없음';
    document.getElementById('e-status-effects').innerText = enemy.vulnerable > 0 ? `취약 ${enemy.vulnerable}` : '없음';

    document.getElementById('player-card-ui').classList.toggle('staggered', player.isStaggered);
    document.getElementById('p-stagger-status').classList.toggle('hidden', !player.isStaggered);

    document.getElementById('enemy-card-ui').classList.toggle('staggered', enemy.isStaggered);
    document.getElementById('e-stagger-status').classList.toggle('hidden', !enemy.isStaggered);

    renderLight('p-light-bulbs', player);
    renderLight('e-light-bulbs', enemy);

    document.getElementById('p-emo-lv').innerText = player.emotionLevel;
    document.getElementById('p-emo-coins').innerText = `${player.emotionCoins}/${player.coinsForNextLevel}`;
    document.getElementById('p-emo-bar').style.width = `${(player.emotionCoins / player.coinsForNextLevel) * 100}%`;

    document.getElementById('e-emo-lv').innerText = enemy.emotionLevel;
    document.getElementById('e-emo-coins').innerText = `${enemy.emotionCoins}/${enemy.coinsForNextLevel}`;
    document.getElementById('e-emo-bar').style.width = `${(enemy.emotionCoins / enemy.coinsForNextLevel) * 100}%`;

    document.getElementById('p-abno-list').innerText = player.abnoPages.map(a => a.name).join(', ') || '없음';
    document.getElementById('e-abno-list').innerText = enemy.abnoPages.map(a => a.name).join(', ') || '없음';

    document.getElementById('deck-count-num').innerText = player.deck.length;
    document.getElementById('grave-count-num').innerText = player.grave.length;

    // 플레이어 손패 렌더링
    const handContainer = document.getElementById('player-hand');
    handContainer.innerHTML = '';
    
    player.hand.forEach((card, idx) => {
        const isDisabled = card.cost > player.currentLight || player.isStaggered;
        const isSelected = selectedCardInfo && selectedCardInfo.type === 'normal' && selectedCardInfo.index === idx;
        const diceStr = card.dice.map(d => `${d.type === '공격' ? '⚔️' : d.type === '방어' ? '🛡️' : '🏃'}${d.type}(${d.min}~${d.max})`).join('<br>');

        const cardEl = document.createElement('div');
        cardEl.className = `card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`;
        cardEl.onclick = () => {
            if (!isDisabled) {
                if (isSelected) {
                    selectedCardInfo = null;
                } else {
                    selectedCardInfo = { type: 'normal', index: idx };
                }
                renderUI();
            }
        };
        cardEl.innerHTML = `
            <div>
                <div class="card-header"><span class="card-title">${card.name}</span><span class="card-cost">${card.cost}</span></div>
                <img class="card-img" src="${card.img}" alt="${card.name}">
                ${card.effectText ? `<div class="card-effect">${card.effectText}</div>` : ''}
            </div>
            <div class="card-coins">${diceStr}</div>
        `;
        handContainer.appendChild(cardEl);
    });

    // E.G.O 손패 렌더링
    const egoContainer = document.getElementById('ego-hand');
    egoContainer.innerHTML = '';
    if (player.egoHand.length === 0) {
        egoContainer.innerHTML = `<span style="font-size:12px; color:#666;">(감정 Lv.3 달성 시 해금)</span>`;
    } else {
        player.egoHand.forEach((card, idx) => {
            const isDisabled = card.cost > player.currentLight || player.isStaggered;
            const isSelected = selectedCardInfo && selectedCardInfo.type === 'ego' && selectedCardInfo.index === idx;

            const cardEl = document.createElement('div');
            cardEl.className = `card ego-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`;
            cardEl.onclick = () => {
                if (!isDisabled) {
                    if (isSelected) {
                        selectedCardInfo = null;
                    } else {
                        selectedCardInfo = { type: 'ego', index: idx };
                    }
                    renderUI();
                }
            };
            cardEl.innerHTML = `
                <div>
                    <div class="card-header"><span class="card-title">${card.name}</span><span class="card-cost">${card.cost}</span></div>
                    <img class="card-img" src="${card.img}" alt="${card.name}">
                    <div class="card-effect">${card.effectText}</div>
                </div>
                <div class="card-coins">💥 E.G.O 공격 (${card.dice.length}코인)</div>
            `;
            egoContainer.appendChild(cardEl);
        });
    }
}

function renderLight(elementId, unit) {
    const container = document.getElementById(elementId);
    container.innerHTML = '';
    for (let i = 0; i < unit.maxLight; i++) {
        const bulb = document.createElement('div');
        bulb.className = `light-bulb ${i < unit.currentLight ? 'active' : ''}`;
        container.appendChild(bulb);
    }
}

function addLog(msg, cssClass = '') {
    const logBox = document.getElementById('combat-log');
    if (!logBox) return;
    const div = document.createElement('div');
    if (cssClass) div.className = cssClass;
    div.innerText = msg;
    logBox.appendChild(div);
    logBox.scrollTop = logBox.scrollHeight;
}

function openAbnoSelectModal() {
    const modal = document.getElementById('abno-select-modal');
    const choicesBox = document.getElementById('abno-card-choices');
    if (!modal || !choicesBox) return;

    choicesBox.innerHTML = '';

    ABNO_CARDS_POOL.forEach(abno => {
        const card = document.createElement('div');
        card.className = 'abno-card';
        card.innerHTML = `<h4>${abno.name}</h4><p>${abno.desc}</p>`;
        card.onclick = () => {
            player.abnoPages.push(abno);
            addLog(`🔮 [환상체 책장 획득] <${abno.name}> 패시브 장착!`, 'log-level-up');
            modal.classList.add('hidden');
            renderUI();
        };
        choicesBox.appendChild(card);
    });

    modal.classList.remove('hidden');
}

// ==========================================
// 5. 로직 및 전투 로직
// ==========================================
function rollDice(min, max, powerBonus = 0) {
    return Math.floor(Math.random() * (max - min + 1)) + min + powerBonus;
}

function resolveDiceInteraction(attacker, defUnit, aRoll, dRoll, aDice, dDice) {
    const diff = Math.abs(aRoll - dRoll);

    if (aRoll > dRoll) {
        if (aDice.type === '공격') {
            let dmg = aRoll + defUnit.vulnerable;
            if (attacker.abnoPages.some(a => a.effect === 'dmg_up')) dmg = Math.floor(dmg * 1.25);
            
            defUnit.hp = Math.max(0, defUnit.hp - dmg);
            defUnit.takeStaggerDamage(dmg);
            addLog(`  ▶ [${attacker.name}] 승리! (${defUnit.name}에게 ${dmg} HP/흐트러짐 피해)`, 'log-win');
            
            if (aDice.hitEffect) aDice.hitEffect(defUnit);
        } else if (aDice.type === '방어') {
            defUnit.takeStaggerDamage(diff);
            addLog(`  ▶ [${attacker.name}] 방어 성공! (${defUnit.name}에게 ${diff} 흐트러짐 피해)`, 'log-win');
        } else if (aDice.type === '회피') {
            attacker.recoverStagger(diff);
            addLog(`  ▶ [${attacker.name}] 회피 성공! (${attacker.name} 흐트러짐 +${diff} 회복)`, 'log-win');
        }

        if (aDice.winEffect) aDice.winEffect(attacker, defUnit);
        if (attacker.abnoPages.some(a => a.effect === 'heal')) attacker.hp = Math.min(attacker.maxHp, attacker.hp + 3);
        attacker.gainEmotionCoin(1);

    } else if (dRoll > aRoll) {
        if (dDice.type === '공격') {
            let dmg = dRoll + attacker.vulnerable;
            attacker.hp = Math.max(0, attacker.hp - dmg);
            attacker.takeStaggerDamage(dmg);
            addLog(`  ▶ [${defUnit.name}] 승리! (${attacker.name}에게 ${dmg} HP/흐트러짐 피해)`, 'log-lose');

            if (dDice.hitEffect) dDice.hitEffect(attacker);
        } else if (dDice.type === '방어') {
            attacker.takeStaggerDamage(diff);
            addLog(`  ▶ [${defUnit.name}] 방어 성공! (${attacker.name}에게 ${diff} 흐트러짐 피해)`, 'log-lose');
        } else if (dDice.type === '회피') {
            defUnit.recoverStagger(diff);
            addLog(`  ▶ [${defUnit.name}] 회피 성공! (${defUnit.name} 흐트러짐 +${diff} 회복)`, 'log-lose');
        }

        if (dDice.winEffect) dDice.winEffect(defUnit, attacker);
        defUnit.gainEmotionCoin(1);
    } else {
        addLog(`  ▶ ${aRoll} vs ${dRoll} ➔ 무승부!`);
    }
}

function startClash() {
    triggerClashEffects();

    if (player.isStaggered) {
        addLog(`\n--- Scene ${scene} ---`, 'log-turn');
        addLog(`💫 [${player.name}]가 흐트러짐 상태여서 이번 막 행동할 수 없습니다!`, 'log-stagger');
        scene++;
        player.startNewScene();
        enemy.startNewScene();
        renderUI();
        return;
    }

    let pCard = DEFAULT_ATTACK_CARD;

    if (selectedCardInfo && selectedCardInfo.type === 'normal') {
        if (player.hand[selectedCardInfo.index]) {
            pCard = player.hand.splice(selectedCardInfo.index, 1)[0];
            player.grave.push(pCard);
            player.currentLight -= pCard.cost;
        }
    } else if (selectedCardInfo && selectedCardInfo.type === 'ego') {
        if (player.egoHand[selectedCardInfo.index]) {
            pCard = player.egoHand[selectedCardInfo.index];
            player.currentLight -= pCard.cost;
        }
    }

    let eCard = null;
    if (!enemy.isStaggered && enemy.hand.length > 0) {
        const playableIndex = enemy.hand.findIndex(c => c.cost <= enemy.currentLight);
        if (playableIndex !== -1) {
            eCard = enemy.hand.splice(playableIndex, 1)[0];
            enemy.grave.push(eCard);
            enemy.currentLight -= eCard.cost;
        }
    }

    addLog(`\n--- Scene ${scene} 합(Clash) 진행 ---`, 'log-turn');
    
    if (pCard.onUse) pCard.onUse(player);
    if (eCard && eCard.onUse) eCard.onUse(enemy);

    if (eCard) {
        addLog(`⚔️ [${player.name}] <${pCard.name}> VS [${enemy.name}] <${eCard.name}>`);
    } else {
        addLog(`⚔️ [${player.name}] <${pCard.name}> (상대 무력화/카드 없음으로 일방 공격)`);
    }

    const pPower = player.abnoPages.some(a => a.effect === 'power') ? 2 : 0;
    const ePower = enemy.abnoPages.some(a => a.effect === 'power') ? 2 : 0;

    const maxRounds = eCard ? Math.max(pCard.dice.length, eCard.dice.length) : pCard.dice.length;

    for (let i = 0; i < maxRounds; i++) {
        const pDice = pCard.dice[i];
        const eDice = eCard ? eCard.dice[i] : null;

        if (pDice && eDice) {
            const pRoll = rollDice(pDice.min, pDice.max, pPower);
            const eRoll = rollDice(eDice.min, eDice.max, ePower);
            
            addLog(`  • 코인 #${i+1} [${pDice.type}:${pRoll}] vs [${eDice.type}:${eRoll}]`);
            resolveDiceInteraction(player, enemy, pRoll, eRoll, pDice, eDice);

        } else if (pDice && !eDice) {
            const pRoll = rollDice(pDice.min, pDice.max, pPower);
            if (pDice.type === '공격') {
                let dmg = pRoll + enemy.vulnerable;
                enemy.hp = Math.max(0, enemy.hp - dmg);
                enemy.takeStaggerDamage(dmg);
                addLog(`  ▶ 코인 #${i+1} 일방 공격! ➔ ${enemy.name}에게 ${dmg} HP/흐트러짐 피해`, 'log-win');
                if (pDice.hitEffect) pDice.hitEffect(enemy);
            } else if (pDice.type === '방어') {
                enemy.takeStaggerDamage(pRoll);
                addLog(`  ▶ 코인 #${i+1} 방어 일방 사용! ➔ ${enemy.name}에게 ${pRoll} 흐트러짐 피해`, 'log-win');
            } else if (pDice.type === '회피') {
                player.recoverStagger(pRoll);
                addLog(`  ▶ 코인 #${i+1} 회피 일방 사용! ➔ ${player.name} 흐트러짐 +${pRoll} 회복`, 'log-win');
            }
        } else if (eDice && !pDice) {
            const eRoll = rollDice(eDice.min, eDice.max, ePower);
            if (eDice.type === '공격') {
                let dmg = eRoll + player.vulnerable;
                player.hp = Math.max(0, player.hp - dmg);
                player.takeStaggerDamage(dmg);
                addLog(`  ▶ 코인 #${i+1} 적 일방 피격! ➔ ${player.name}에게 ${dmg} HP/흐트러짐 피해`, 'log-lose');
                if (eDice.hitEffect) eDice.hitEffect(player);
            }
        }

        if (player.hp <= 0 || enemy.hp <= 0) break;
    }

    scene++;
    document.getElementById('scene-counter').innerText = `Scene ${scene}`;
    player.startNewScene();
    enemy.startNewScene();
    selectedCardInfo = null;

    renderUI();

    if (enemy.hp <= 0) {
        alert("축하합니다! 적을 처치하고 승리하셨습니다!");
        location.reload();
    } else if (player.hp <= 0) {
        alert("플레이어가 사망했습니다...");
        location.reload();
    }
}