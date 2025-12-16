const addedCities = new Set();

// --- 2. CONFIGURAÇÃO DO MAPA (COM ZOOM) ---
const map = L.map('map', {
    zoomControl: true,       // Habilita os botões de + e -
    dragging: true,          // Habilita arrastar o mapa (essencial se tiver zoom)
    scrollWheelZoom: true,   // Zoom com a roda do mouse
    doubleClickZoom: true,   // Zoom com duplo clique
    boxZoom: true,           // Zoom segurando Shift + Arrastar
    keyboard: true,          // Navegação por teclado
    touchZoom: true,         // Zoom com pinça em celulares
    attributionControl: false,
    maxZoom: Infinity
});

// Centraliza inicial
map.setView([-30.5, -53.5], 7);

// Limites de navegação (Opcional: Impede que o usuário saia muito do RS)
// Isso evita que o usuário se perca no oceano ao dar muito zoom out
map.setMinZoom(7);
map.setMaxBounds([
    [-34.0, -58.0], // Sudoeste
    [-26.0, -49.0]  // Nordeste
]);

// Fundo "Mudo"
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png').addTo(map);

// --- 3. DESENHAR FRONTEIRA DO RS ---
// Baixa o GeoJSON dos estados do Brasil e filtra o RS
fetch('https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson')
    .then(response => response.json())
    .then(data => {
        // Encontra o RS no arquivo
        const rsFeature = data.features.find(f => f.properties.sigla === 'RS');

        if (rsFeature) {
            L.geoJSON(rsFeature, {
                style: {
                    color: '#000000',   // Cor da linha: Preto
                    weight: 3,          // Espessura da linha: 3px (BEM VISÍVEL)
                    opacity: 0.8,       // Opacidade da linha
                    fillColor: '#ffffff',
                    fillOpacity: 0.0    // Fundo transparente (só a borda)
                }
            }).addTo(map);
        }
    })
    .catch(err => console.error("Erro ao carregar fronteiras:", err));


// --- 4. LÓGICA DO JOGO ---

// Elementos da DOM
const inp = document.getElementById('municipio');
const btn = document.getElementById('add-btn');
const counterEl = document.getElementById('contador');
const msgEl = document.getElementById('msg');
const listEl = document.getElementById('city-list');
const sidebarEl = document.getElementById('sidebar');

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

function checkAnswer() {
    const val = inp.value;
    if (!val) return;

    const cleanInput = clean(val);
    let match = null;
    let minDist = 999;

    // Busca na lista
    municipios.forEach(m => {
        const cleanName = clean(m.name);
        if (cleanName === cleanInput) { minDist = 0; match = m; return; }

        // Fuzzy logic
        if (cleanInput.length >= 3) {
            const dist = levenshtein(cleanInput, cleanName);
            const tolerance = cleanName.length > 6 ? 2 : 1;
            if (dist <= tolerance && dist < minDist) { minDist = dist; match = m; }
        }
    });

    // Lógica de Acerto/Erro
    if (match) {
        if (addedCities.has(match.name)) {
            showMessage(`${match.name} já foi adicionada!`, 'orange');
        } else {
            // --- SUCESSO ---
            addCity(match);
            showMessage(`Adicionado: ${match.name}`, 'green');
            inp.value = '';
        }
    } else {
        showMessage('Cidade não encontrada.', 'red');
    }
    inp.focus();
}

function addCity(city) {
    addedCities.add(city.name);

    // 1. Marcador no Mapa
    const myIcon = L.divIcon({
        className: 'leaflet-div-icon',
        html: `<div class="city-label">${city.name}</div>`
    });
    L.marker([city.lat, city.lng], { icon: myIcon }).addTo(map);

    // 2. Atualizar Contador
    counterEl.textContent = addedCities.size;

    // 3. Adicionar à Lista Lateral
    const li = document.createElement('li');
    li.textContent = city.name;
    li.className = 'new-item'; // Para animação CSS
    listEl.appendChild(li);

    // Scroll automático para o final da lista
    sidebarEl.scrollTop = sidebarEl.scrollHeight;
}

function showMessage(text, color) {
    msgEl.textContent = text;
    msgEl.style.color = color;
    // Limpa msg após 3 seg
    setTimeout(() => {
        if (msgEl.textContent === text) msgEl.textContent = '';
    }, 3000);
}

// Eventos
btn.addEventListener('click', checkAnswer);
inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkAnswer();
});

// Foco inicial
inp.focus();