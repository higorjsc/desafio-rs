import { municipios } from './dados.js';

// --- 1. CONFIGURAÇÃO GERAL ---

// ======================================================
// AJUSTE O TEMPO AQUI (em segundos)
// Ex: 180 = 3 minutos | 300 = 5 minutos | 60 = 1 minuto
const TEMPO_LIMITE = 120;
// ======================================================

const addedCities = new Set();
let currentRecord = parseInt(localStorage.getItem('rs_game_record')) || 0;

let recordBrokenThisSession = false;
let timerInterval = null;
let timeRemaining = TEMPO_LIMITE; // Usa a constante inicial

// Elementos da DOM
const inp = document.getElementById('municipio');
const btn = document.getElementById('add-btn');
const counterEl = document.getElementById('contador');
const msgEl = document.getElementById('msg');
const listEl = document.getElementById('city-list');
const sidebarEl = document.getElementById('sidebar');
const recordEl = document.getElementById('record-val');
const timerBoxEl = document.getElementById('timer-box');
const timerValEl = document.getElementById('timer-val');
const restartBtn = document.getElementById('restart-btn');

// Inicializa visual do recorde
if (recordEl) recordEl.textContent = currentRecord;

// --- 2. MAPA ---
const map = L.map('map', {
    zoomControl: true, dragging: true, scrollWheelZoom: true,
    doubleClickZoom: true, boxZoom: true, keyboard: true, touchZoom: true, attributionControl: false
});

map.setView([-30.5, -53.5], 7);
map.setMinZoom(5);
map.setMaxBounds([[-35.0, -60.0], [-25.0, -48.0]]);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png').addTo(map);

const markersLayer = L.layerGroup().addTo(map);

fetch('https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson')
    .then(r => r.json())
    .then(data => {
        const rs = data.features.find(f => f.properties.sigla === 'RS');
        if (rs) L.geoJSON(rs, { style: { color: '#000', weight: 2, opacity: 0.8, fillColor: '#fff', fillOpacity: 0.0 } }).addTo(map);
    });

// --- 3. FUNÇÕES DE TIMER E ESTADO ---

function updateTimerDisplay() {
    const min = Math.floor(timeRemaining / 60);
    const sec = timeRemaining % 60;

    if (timerValEl) {
        timerValEl.textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }

    if (timeRemaining < 30) {
        timerBoxEl.style.backgroundColor = '#ffcccc';
        timerBoxEl.style.color = 'red';
    } else {
        timerBoxEl.style.backgroundColor = '#fff0f0';
        timerBoxEl.style.color = '#dc3545';
    }
}

function startTimer() {
    clearInterval(timerInterval);
    timeRemaining = TEMPO_LIMITE; // Reset usa a constante
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            gameOver();
        }
    }, 1000);
}

function resetTimer() {
    timeRemaining = TEMPO_LIMITE; // Reset usa a constante
    updateTimerDisplay();
}

function gameOver() {
    clearInterval(timerInterval);
    // 1. Desabilita inputs (Impede digitar)
    inp.disabled = true;
    btn.disabled = true;
    inp.placeholder = "Acabou o tempo!";

    // 2. Mostra botão de recomeçar
    restartBtn.style.display = 'block';
}

function restartGame() {
    // 1. Limpa tudo
    addedCities.clear();
    markersLayer.clearLayers();
    listEl.innerHTML = '';
    counterEl.textContent = '0';
    recordBrokenThisSession = false;

    // 2. Reabilita inputs
    inp.disabled = false;
    btn.disabled = false;
    inp.value = '';
    inp.placeholder = "Digite o município...";

    // 3. Esconde botão e reinicia timer
    restartBtn.style.display = 'none';
    startTimer();
    inp.focus();
}

// --- 4. LÓGICA DO JOGO ---
function clean(str) {
    return str.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
            else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
    }
    return matrix[b.length][a.length];
}

function getSnarkyMessage(count) {
    const msgs = {
        low: ["Só isso?", "Começou agora, né?", "Qualquer um sabe isso"],
        mid: ["Parabéns, mas é tua obrigação.", "Tá andando, mas quase parando.", "Não te emociona, falta muito."],
        high: ["Até que não tá tão ruim.", "Boa, mas duvido passar disso", "Tá se achando o gaúcho, né?"],
        god: ["Tu está se tornando um deus!", "Não tem o que fazer não?", "Desempregado, né?", "Falta pouco, não estraga tudo."]
    };
    if (count < 50) return msgs.low[Math.floor(Math.random() * msgs.low.length)];
    if (count < 200) return msgs.mid[Math.floor(Math.random() * msgs.mid.length)];
    if (count < 400) return msgs.high[Math.floor(Math.random() * msgs.high.length)];
    return msgs.god[Math.floor(Math.random() * msgs.god.length)];
}

function checkAnswer() {
    if (!municipios || municipios.length === 0) return;

    const val = inp.value;
    if (!val) return;

    const cleanInput = clean(val);
    let match = null;
    let minDist = 999;

    municipios.forEach(m => {
        const cleanName = clean(m.name);
        if (cleanName === cleanInput) { minDist = 0; match = m; return; }
        if (cleanInput.length >= 3) {
            const dist = levenshtein(cleanInput, cleanName);
            const tolerance = cleanName.length > 6 ? 2 : 1;
            if (dist <= tolerance && dist < minDist) { minDist = dist; match = m; }
        }
    });

    if (match) {
        if (addedCities.has(match.name)) {
            showMessage(`${match.name} já foi!`, 'orange');
        } else {
            addCity(match);
            resetTimer();

            const currentCount = addedCities.size;

            if (currentCount === 497) {
                showMessage("Parabéns, tu é um deus!", "purple");
                localStorage.setItem('rs_game_record', 497);
                recordEl.textContent = 497;
                clearInterval(timerInterval);
                return;
            }

            if (currentCount > currentRecord) {
                currentRecord = currentCount;
                localStorage.setItem('rs_game_record', currentRecord);
                recordEl.textContent = currentRecord;

                if (!recordBrokenThisSession) {
                    const snarky = getSnarkyMessage(currentCount);
                    showMessage(`✅ ${match.name}. ${snarky}`, '#007bff');
                    recordBrokenThisSession = true;
                } else {
                    showMessage(`✅ ${match.name}`, 'green');
                }
            } else {
                showMessage(`✅ ${match.name}`, 'green');
            }
            inp.value = '';
        }
    } else {
        showMessage('Cidade não encontrada.', 'red');
    }
    inp.focus();
}

function addCity(city) {
    addedCities.add(city.name);

    const myIcon = L.divIcon({
        className: 'leaflet-div-icon',
        html: `<div class="city-label">${city.name}</div>`
    });

    L.marker([city.lat, city.lng], { icon: myIcon }).addTo(markersLayer);

    counterEl.textContent = addedCities.size;

    const li = document.createElement('li');
    li.textContent = city.name;
    li.className = 'new-item';
    listEl.appendChild(li);
    sidebarEl.scrollTop = sidebarEl.scrollHeight;
}

function showMessage(text, color) {
    msgEl.textContent = text;
    if (color === 'red') msgEl.style.backgroundColor = '#f8d7da', msgEl.style.color = '#721c24';
    else if (color === 'green') msgEl.style.backgroundColor = '#d4edda', msgEl.style.color = '#155724';
    else if (color === 'orange') msgEl.style.backgroundColor = '#fff3cd', msgEl.style.color = '#856404';
    else if (color === 'purple') msgEl.style.backgroundColor = '#e2d9f3', msgEl.style.color = '#6f42c1';
    else msgEl.style.backgroundColor = '#cce5ff', msgEl.style.color = '#004085';

    msgEl.classList.add('visible');

    setTimeout(() => {
        if (msgEl.textContent === text) {
            msgEl.classList.remove('visible');
        }
    }, 4000);
}

// Eventos
btn.addEventListener('click', checkAnswer);
restartBtn.addEventListener('click', restartGame);
inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkAnswer(); });

// Inicialização
inp.focus();
startTimer();