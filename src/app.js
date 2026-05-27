// App.js: Visualizações e Lógica Interativa D3.js

// 1. Configurações de Estado Global
let state = {
    currentYear: 2024,
    currentIndicator: "GDP_growth",
    selectedCountry: "PRT",
    forecastYear: "2026",
    selectedModel: "ridge",
    isPlaying: false,
    dataset: null,
    geoData: null,
    showGlobalTrend: true,
    predictorTab: "forecast",
    currentSlide: 0,
    showRelativeDiff: false
};

// Detalhes dos Indicadores para exibição
const INDICATOR_DETAILS = {
    "GDP_growth": {
        name: "Crescimento do PIB Real (Anual %)",
        shortLabel: "PIB",
        desc: "Mede a variação percentual do valor de todos os bens e serviços produzidos no país. Mostra a aceleração ou abrandamento económico geral.",
        format: v => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`,
        colorRange: ["#0b132b", "#00d4ff"]
    },
    "Tourism_arrivals": {
        name: "Turismo Internacional (Chegadas)",
        shortLabel: "Turismo",
        desc: "Número de turistas internacionais que chegam ao país. Indicador direto do impacto de atração e visibilidade global gerado pela F1.",
        format: v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v.toLocaleString('pt-PT'),
        colorRange: ["#09151b", "#00ffaa"]
    },
    "FDI": {
        name: "Investimento Direto Estrangeiro (FDI - USD Correntes)",
        shortLabel: "IDE (FDI)",
        desc: "Fluxos líquidos de investimento estrangeiro direto (entradas líquidas de capital no país) em dólares americanos correntes. Mede o volume bruto de investimento estrangeiro captado.",
        format: v => {
            if (v === 0) return "$0";
            const sign = v < 0 ? '-' : '';
            const absV = Math.abs(v);
            if (absV >= 1e9) return `${sign}$${(absV/1e9).toFixed(2)}B`;
            if (absV >= 1e6) return `${sign}$${(absV/1e6).toFixed(1)}M`;
            return `${sign}$${absV.toLocaleString('pt-PT')}`;
        },
        colorRange: ["#0d0d1b", "#e10600"]
    },
    "Inflation": {
        name: "Taxa de Inflação (IPC Anual %)",
        shortLabel: "Inflação",
        desc: "Variação percentual anual do custo para o consumidor médio. Permite observar pressões nos preços locais ou flutuações associadas a grandes eventos.",
        format: v => `${v.toFixed(2)}%`,
        colorRange: ["#140d1a", "#d946ef"]
    },
    "GDP_pc": {
        name: "PIB per Capita (USD Constante 2015)",
        shortLabel: "PIB per Capita",
        desc: "Produto Interno Bruto dividido pelo número de habitantes, ajustado pela inflação. Mede o nível de bem-estar económico médio por habitante.",
        format: v => `$${v.toLocaleString('pt-PT', {maximumFractionDigits:0})}`,
        colorRange: ["#0f141d", "#facc15"]
    }
};

// Função auxiliar para formatar variações de indicadores absolutos
function formatAbsoluteChange(val, ind) {
    const symbol = val > 0 ? "+" : (val < 0 ? "-" : "");
    const absVal = Math.abs(val);
    if (ind === "Tourism_arrivals") {
        return `${symbol}${absVal >= 1e6 ? (absVal/1e6).toFixed(2)+'M' : absVal.toLocaleString('pt-PT')}`;
    }
    if (ind === "GDP_pc") {
        return `${symbol}$${absVal.toLocaleString('pt-PT', {maximumFractionDigits:0})}`;
    }
    if (ind === "FDI") {
        if (absVal >= 1e9) return `${symbol}$${(absVal/1e9).toFixed(2)}B`;
        if (absVal >= 1e6) return `${symbol}$${(absVal/1e6).toFixed(1)}M`;
        return `${symbol}$${absVal.toLocaleString('pt-PT')}`;
    }
    return `${symbol}${absVal.toFixed(2)}`;
}

// Função auxiliar para formatar desvios/diferenças relativas à média global
function formatDeviation(val, ind) {
    const symbol = val > 0 ? "+" : (val < 0 ? "-" : "");
    const absVal = Math.abs(val);
    if (ind === "GDP_growth" || ind === "Inflation" || ind === "Unemployment") {
        return `${symbol}${absVal.toFixed(2)} pp`;
    }
    if (ind === "Tourism_arrivals") {
        return `${symbol}${absVal >= 1e6 ? (absVal/1e6).toFixed(2)+'M' : absVal.toLocaleString('pt-PT')}`;
    }
    if (ind === "GDP_pc") {
        return `${symbol}$${absVal.toLocaleString('pt-PT', {maximumFractionDigits:0})}`;
    }
    if (ind === "FDI") {
        if (absVal >= 1e9) return `${symbol}$${(absVal/1e9).toFixed(2)}B`;
        if (absVal >= 1e6) return `${symbol}$${(absVal/1e6).toFixed(1)}M`;
        return `${symbol}$${absVal.toLocaleString('pt-PT')}`;
    }
    return `${symbol}${absVal.toFixed(2)}`;
}

// Reconstruir o PIB de um país para um determinado ano com base no PIB de 2023 e no histórico de crescimento
function getGDPForYear(countryCode, targetYear) {
    const gdp2023 = COUNTRY_GDP_BILLIONS[countryCode];
    if (!gdp2023) return 0;
    
    const countryData = state.dataset.countries[countryCode];
    if (!countryData || !state.dataset) return gdp2023;
    
    const growthHistory = countryData.indicators["GDP_growth"];
    if (!growthHistory) return gdp2023;
    
    let currentGdp = gdp2023;
    const yearInt = parseInt(targetYear);
    
    if (yearInt === 2023) {
        return gdp2023;
    } else if (yearInt < 2023) {
        for (let y = 2023; y > yearInt; y--) {
            const rate = growthHistory[String(y)];
            if (rate !== undefined && rate !== null) {
                currentGdp = currentGdp / (1 + (rate / 100));
            }
        }
    } else {
        for (let y = 2024; y <= yearInt; y++) {
            const rate = growthHistory[String(y)];
            if (rate !== undefined && rate !== null) {
                currentGdp = currentGdp * (1 + (rate / 100));
            }
        }
    }
    return currentGdp;
}

const ESTIMATED_HOSTING_FEES = {
    "PRT": { fee: 22, type: "Europeu / Tradicional (Subsidiado)" },
    "ESP": { fee: 25, type: "Europeu / Tradicional" },
    "BEL": { fee: 22, type: "Europeu / Tradicional" },
    "GBR": { fee: 26, type: "Europeu / Tradicional" },
    "ITA": { fee: 25, type: "Europeu / Tradicional" },
    "DEU": { fee: 25, type: "Europeu / Tradicional" },
    "FRA": { fee: 22, type: "Europeu / Tradicional" },
    "AUT": { fee: 25, type: "Europeu / Tradicional" },
    "HUN": { fee: 40, type: "Médio / Estabilidade" },
    "NLD": { fee: 32, type: "Europeu / Zandvoort" },
    "MCO": { fee: 15, type: "Histórico / Mónaco" },
    "USA": { fee: 30, type: "Médio / Austin (COTA)" },
    "CAN": { fee: 30, type: "Médio / Montreal" },
    "MEX": { fee: 30, type: "Médio / Autódromo" },
    "BRA": { fee: 25, type: "Médio / Interlagos" },
    "AUS": { fee: 37, type: "Médio / Melbourne" },
    "JPN": { fee: 25, type: "Médio / Suzuka" },
    "SGP": { fee: 35, type: "Urbano / Singapura" },
    "CHN": { fee: 35, type: "Médio / Xangai" },
    "AZE": { fee: 57, type: "Prémio / Baku" },
    "BHR": { fee: 40, type: "Prémio / Bahrain" },
    "SAU": { fee: 55, type: "Prémio / Arábia Saudita" },
    "QAT": { fee: 55, type: "Prémio / Qatar" },
    "ARE": { fee: 42, type: "Prémio / Abu Dhabi" },
    "TUR": { fee: 30, type: "Médio / Istambul" },
    "MYS": { fee: 30, type: "Médio / Sepang" },
    "ZAF": { fee: 25, type: "Médio / Kyalami" },
    "ARG": { fee: 25, type: "Médio / Buenos Aires" },
    "SWE": { fee: 22, type: "Histórico / Anderstorp" },
    "CHE": { fee: 22, type: "Histórico" },
    "IND": { fee: 30, type: "Médio / Noida" },
    "KOR": { fee: 35, type: "Médio / Yeongam" },
    "MAR": { fee: 25, type: "Histórico / Casablanca" }
};

// PIB aproximado por país (em mil milhões USD, 2023) para cálculo de ROI
const COUNTRY_GDP_BILLIONS = {
    "USA": 27000, "CHN": 18000, "DEU": 4500, "JPN": 4200,
    "GBR": 3100, "FRA": 3000, "ITA": 2200, "CAN": 2100,
    "AUS": 1700, "ESP": 1600, "BRA": 2100, "KOR": 1700,
    "MEX": 1300, "NLD": 1100, "SAU": 1100, "TUR": 1100,
    "CHE": 900,  "AUT": 500,  "BEL": 600,  "SWE": 600,
    "ARE": 500,  "SGP": 470,  "HUN": 220,  "PRT": 280,
    "QAT": 220,  "BHR": 44,   "AZE": 78,   "MYS": 430,
    "ARG": 620,  "IND": 3700, "ZAF": 380,  "MAR": 140,
    "MCO": 7,    "RUS": 1800, "NZL": 250
};
// Gasto médio por turista internacional (USD) – referência World Bank / UNWTO
const AVG_TOURIST_SPEND_USD = 1500;

// 2. URLs de Origem
const DATA_URL = "data/processed_data.json";
// Holtzy's standard world geojson
const GEOJSON_URL = "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson";

// 3. Inicialização ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

async function initApp() {
    try {
        console.log("A iniciar carregamento de dados...");
        // Carrega dados paralelos
        const [rawGeo, rawData] = await Promise.all([
            d3.json(GEOJSON_URL),
            d3.json(DATA_URL)
        ]);

        state.geoData = rawGeo;
        state.dataset = rawData;
        console.log("Dados carregados com sucesso!");

        // Inicializa seletores e eventos
        initControls();
        
        // Desenha primeira renderização
        updateAll();

        // Configura redimensionamento automático das janelas
        window.addEventListener("resize", () => {
            updateAll();
        });

    } catch (error) {
        console.error("Erro ao inicializar a aplicação:", error);
        alert("Erro ao carregar os dados. Certifique-se de que o script de ETL foi executado com sucesso e os arquivos estão no local correto.");
    }
}

// 4. Configuração de Controladores e Eventos da UI
function initControls() {
    // 1. Selector de Indicador
    const indSelect = document.getElementById("indicator-select");
    indSelect.value = state.currentIndicator;
    indSelect.addEventListener("change", (e) => {
        state.currentIndicator = e.target.value;
        updateIndicatorDetails();
        updateAll();
    });

    // 2. Slider de Ano
    const yearSlider = document.getElementById("year-slider");
    yearSlider.value = state.currentYear;
    document.getElementById("year-label").innerText = state.currentYear;
    yearSlider.addEventListener("input", (e) => {
        state.currentYear = parseInt(e.target.value);
        document.getElementById("year-label").innerText = state.currentYear;
        updateMapOnly();
    });

    // 3. Botão Play/Pause da animação
    const playBtn = document.getElementById("play-button");
    let animationTimer = null;
    
    playBtn.addEventListener("click", () => {
        state.isPlaying = !state.isPlaying;
        if (state.isPlaying) {
            playBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="24" height="24">
                    <rect x="4" y="4" width="4" height="16" fill="#fff"></rect>
                    <rect x="16" y="4" width="4" height="16" fill="#fff"></rect>
                </svg>`;
            playBtn.classList.add("playing");
            
            animationTimer = setInterval(() => {
                let nextYear = state.currentYear + 1;
                if (nextYear > 2024) {
                    nextYear = 1960;
                }
                state.currentYear = nextYear;
                yearSlider.value = nextYear;
                document.getElementById("year-label").innerText = nextYear;
                updateMapOnly();
            }, 800);
        } else {
            clearInterval(animationTimer);
            playBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="24" height="24">
                    <polygon points="5 3 19 12 5 21 5 3" fill="#fff"></polygon>
                </svg>`;
            playBtn.classList.remove("playing");
        }
    });

    // 4. Seletor de Países no Painel de Previsão
    const predictorSelect = document.getElementById("predictor-country-select");
    predictorSelect.innerHTML = "";
    
    // Lista ordenada de países que têm previsões no dataset
    const predictionCountries = Object.keys(state.dataset.countries).map(code => ({
        code: code,
        name: state.dataset.countries[code].name
    })).sort((a, b) => a.name.localeCompare(b.name));
    
    predictionCountries.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.code;
        opt.innerText = c.name;
        if (c.code === state.selectedCountry) opt.selected = true;
        predictorSelect.appendChild(opt);
    });

    predictorSelect.addEventListener("change", (e) => {
        state.selectedCountry = e.target.value;
        // Sincroniza títulos e desenhos
        document.getElementById("selected-country-name").innerText = state.dataset.countries[state.selectedCountry].name;
        document.getElementById("predictor-country-name").innerText = state.dataset.countries[state.selectedCountry].name;
        updateIndicatorDetails();
        updateMapOnly();
        drawTrendChart();
        drawPredictor();
        drawKeyFindings();
    });

    // 5. Botões de Ano de Previsão (2026/2027)
    const btn2026 = document.getElementById("btn-2026");
    const btn2027 = document.getElementById("btn-2027");

    btn2026.addEventListener("click", () => {
        state.forecastYear = "2026";
        btn2026.classList.add("active");
        btn2027.classList.remove("active");
        drawPredictor();
    });

    btn2027.addEventListener("click", () => {
        state.forecastYear = "2027";
        btn2027.classList.add("active");
        btn2026.classList.remove("active");
        drawPredictor();
    });

    // 6. Toggle de Média Global e Desvio Relativo
    const globalToggle = document.getElementById("toggle-global-trend");
    if (globalToggle) {
        globalToggle.checked = state.showGlobalTrend;
        globalToggle.addEventListener("change", (e) => {
            state.showGlobalTrend = e.target.checked;
            drawTrendChart();
        });
    }

    const relativeToggle = document.getElementById("toggle-relative-diff");
    if (relativeToggle) {
        relativeToggle.checked = state.showRelativeDiff;
        relativeToggle.addEventListener("change", (e) => {
            state.showRelativeDiff = e.target.checked;
            // Desativa o toggle global se estiver a mostrar a diferença, para não confundir o utilizador
            if (globalToggle) {
                if (state.showRelativeDiff) {
                    globalToggle.disabled = true;
                    globalToggle.parentElement.style.opacity = "0.5";
                } else {
                    globalToggle.disabled = false;
                    globalToggle.parentElement.style.opacity = "1";
                }
            }
            drawTrendChart();
        });
    }

    // 7. Tabs do Previsor (Simulação vs Impacto Real)
    const tabForecast = document.getElementById("tab-forecast");
    const tabRealImpact = document.getElementById("tab-real-impact");
    
    if (tabForecast && tabRealImpact) {
        tabForecast.addEventListener("click", () => {
            state.predictorTab = "forecast";
            tabForecast.classList.add("active");
            tabRealImpact.classList.remove("active");
            drawPredictor();
        });
        
        tabRealImpact.addEventListener("click", () => {
            state.predictorTab = "real-impact";
            tabRealImpact.classList.add("active");
            tabForecast.classList.remove("active");
            drawPredictor();
        });
    }

    // 8. Seletor de Modelo Preditivo (XGBoost vs Ridge vs RF)
    const modelSelect = document.getElementById("predictor-model-select");
    if (modelSelect) {
        modelSelect.value = state.selectedModel;
        modelSelect.addEventListener("change", (e) => {
            state.selectedModel = e.target.value;
            drawPredictor();
        });
    }

    // Atualiza detalhes do indicador selecionado na carga inicial
    updateIndicatorDetails();
    
    // Inicializa o alternador de modo (Interactive Dashboard vs Data Story)
    initModeToggles();
}

function updateIndicatorDetails() {
    if (!state.dataset) return;
    const details = INDICATOR_DETAILS[state.currentIndicator];
    document.getElementById("ind-name-title").innerText = details.name;
    document.getElementById("ind-description").innerText = details.desc;
    
    // Atualiza badge com o valor real do país no ano selecionado
    const countryData = state.dataset.countries[state.selectedCountry];
    const liftBadge = document.getElementById("global-lift-val");
    const labelSpan = document.querySelector(".lift-badge span");
    
    if (countryData) {
        const val = countryData.indicators[state.currentIndicator][String(state.currentYear)];
        
        if (labelSpan) {
            labelSpan.innerText = `Valor em ${countryData.name} (${state.currentYear}):`;
        }
        
        if (val !== undefined && val !== null) {
            liftBadge.innerText = details.format(val);
            
            // Colorir com base no valor
            const isNegativeGood = (state.currentIndicator === "Unemployment" || state.currentIndicator === "Inflation");
            if (val > 0) {
                liftBadge.className = isNegativeGood ? "neon-text-green-negative" : "neon-text-green";
            } else if (val < 0) {
                liftBadge.className = isNegativeGood ? "neon-text-green" : "neon-text-green-negative";
            } else {
                liftBadge.className = "";
            }
        } else {
            liftBadge.innerText = "Sem dados";
            liftBadge.className = "neon-text-red";
        }
    }
}

// 5. Função Master de Atualização de Desenhos
function updateAll() {
    updateIndicatorDetails();
    drawMap();
    drawTrendChart();
    drawPredictor();
    drawKeyFindings();
}

// 6. Desenho do Mapa Mundial
function drawMap() {
    const container = document.querySelector(".map-wrapper");
    const width = container.clientWidth;
    const height = container.clientHeight || 400;
    
    const svg = d3.select("#world-map")
        .attr("width", width)
        .attr("height", height);
    
    svg.selectAll("*").remove(); // Limpa desenhos anteriores

    // <title> dinâmico para acessibilidade (screen readers)
    svg.append("title")
        .text(`Mapa coroplético: ${INDICATOR_DETAILS[state.currentIndicator].name} — ${state.currentYear}`);

    // Atualiza gradiente da legenda usando o mesmo interpolador HCL do mapa
    // (CSS linear-gradient usa sRGB e diverge visualmente do HCL em cores afastadas)
    const legendColorEl = document.querySelector(".legend-color-scale");
    if (legendColorEl) {
        const cr = INDICATOR_DETAILS[state.currentIndicator].colorRange;
        const interp = d3.interpolateHcl(cr[0], cr[1]);
        const stops = [0, 0.2, 0.4, 0.6, 0.8, 1]
            .map(t => `${interp(t)} ${t * 100}%`)
            .join(", ");
        legendColorEl.style.background = `linear-gradient(90deg, ${stops})`;
    }

    // Grupo para o mapa
    const g = svg.append("g");

    // Projeção
    const projection = d3.geoNaturalEarth1()
        .scale(width / 5.8)
        .translate([width / 2, height / 1.6]);
        
    const path = d3.geoPath().projection(projection);
    
    // Zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });
        
    svg.call(zoom);

    // Determina o intervalo do indicador selecionado para o ano corrente
    const currentYearStr = String(state.currentYear);
    const ind = state.currentIndicator;
    
    // Coleta valores para a escala de cores
    const values = [];
    Object.keys(state.dataset.countries).forEach(code => {
        const val = state.dataset.countries[code].indicators[ind][currentYearStr];
        if (val !== undefined && val !== null) {
            values.push(val);
        }
    });

    // Escala de cores baseada no indicador
    const indDetails = INDICATOR_DETAILS[ind];
    const colorScale = d3.scaleSequential()
        .domain(values.length > 0 ? d3.extent(values) : [0, 100])
        .interpolator(d3.interpolateHcl(indDetails.colorRange[0], indDetails.colorRange[1]));

    const tooltip = d3.select("#map-tooltip");

    // Desenha países
    g.selectAll(".country")
        .data(state.geoData.features)
        .enter()
        .append("path")
        .attr("class", "country")
        .attr("d", path)
        .attr("fill", d => {
            const iso3 = d.id; // ISO alpha-3
            const countryData = state.dataset.countries[iso3];
            if (countryData) {
                const val = countryData.indicators[ind][currentYearStr];
                if (val !== undefined && val !== null) {
                    return colorScale(val);
                }
            }
            return "#161920"; // Cor padrão para países sem dados ou não anfitriões
        })
        .attr("stroke", d => d.id === state.selectedCountry ? "#ffffff" : "rgba(0,0,0,0.5)")
        .attr("stroke-width", d => d.id === state.selectedCountry ? 2.2 : 0.6)
        .on("mouseover", (event, d) => {
            const iso3 = d.id;
            const countryData = state.dataset.countries[iso3];
            let content = `<div class="tooltip-title"><span>🗺️ ${d.properties.name}</span><span style="font-size:0.75rem;color:var(--text-muted)">${iso3}</span></div>`;
            
            if (countryData) {
                const val = countryData.indicators[ind][currentYearStr];
                const valStr = (val !== undefined && val !== null) ? indDetails.format(val) : "Sem dados";
                const isHost = countryData.gps.includes(state.currentYear);
                
                content += `<div class="tooltip-row"><span class="tooltip-key">${indDetails.name}</span><span class="tooltip-val">${valStr}</span></div>`;
                content += `<div class="tooltip-row"><span class="tooltip-key">GPs Históricos</span><span class="tooltip-val">${countryData.gps.length}</span></div>`;
                
                if (isHost) {
                    content += `<div class="tooltip-badge badge-gp">🏎️ Anfitrião F1 em ${state.currentYear}</div>`;
                } else {
                    content += `<div class="tooltip-badge badge-nongp">Sem F1 em ${state.currentYear}</div>`;
                }
            } else {
                content += `<div class="tooltip-row" style="color:var(--text-muted)">Sem histórico de F1</div>`;
            }
            
            tooltip.html(content)
                .style("opacity", 1)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 15) + "px");
        })
        .on("mousemove", (event) => {
            tooltip.style("left", (event.pageX + 15) + "px")
                   .style("top", (event.pageY - 15) + "px");
        })
        .on("mouseleave", () => {
            tooltip.style("opacity", 0);
        })
        .on("click", (event, d) => {
            const iso3 = d.id;
            if (state.dataset.countries[iso3]) {
                state.selectedCountry = iso3;
                
                // Atualiza seleção e textos da interface
                document.getElementById("predictor-country-select").value = iso3;
                document.getElementById("selected-country-name").innerText = state.dataset.countries[iso3].name;
                document.getElementById("predictor-country-name").innerText = state.dataset.countries[iso3].name;
                
                // Sincroniza visualmente as bordas de todos os países no mapa
                d3.selectAll(".country")
                    .transition()
                    .duration(200)
                    .attr("stroke", c => c.id === state.selectedCountry ? "#ffffff" : "rgba(0,0,0,0.5)")
                    .attr("stroke-width", c => c.id === state.selectedCountry ? 2.2 : 0.6);

                // Redesenha gráficos dependentes do país selecionado
                updateIndicatorDetails();
                drawTrendChart();
                drawPredictor();
                drawKeyFindings();
            }
        });

    // 7. Adiciona círculos pulsantes para os anfitriões de GP do ano corrente
    const gpCountriesThisYear = [];
    state.geoData.features.forEach(f => {
        const iso3 = f.id;
        const cData = state.dataset.countries[iso3];
        if (cData && cData.gps.includes(state.currentYear)) {
            // Calcula o centro do polígono para desenhar a marca
            const centroid = path.centroid(f);
            if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
                gpCountriesThisYear.push({
                    iso3: iso3,
                    coords: centroid,
                    name: cData.name
                });
            }
        }
    });

    // Desenha anéis pulsantes
    const pulses = g.selectAll(".f1-pulse-group")
        .data(gpCountriesThisYear, d => d.iso3);

    const pulsesEnter = pulses.enter()
        .append("g")
        .attr("class", "f1-pulse-group")
        .attr("transform", d => `translate(${d.coords[0]}, ${d.coords[1]})`);

    // Anel externo que pulsa via CSS keyframes
    pulsesEnter.append("circle")
        .attr("class", "f1-pulse-ring")
        .attr("r", 1);

    // Centro sólido estático
    pulsesEnter.append("circle")
        .attr("class", "f1-pulse-center")
        .attr("r", 4);
}

// Atualização de cor rápida durante a animação do slider (evita reconstruir tudo)
function updateMapOnly() {
    updateIndicatorDetails();
    const currentYearStr = String(state.currentYear);
    const ind = state.currentIndicator;
    const indDetails = INDICATOR_DETAILS[ind];
    
    // Re-calcula escala de cores
    const values = [];
    Object.keys(state.dataset.countries).forEach(code => {
        const val = state.dataset.countries[code].indicators[ind][currentYearStr];
        if (val !== undefined && val !== null) {
            values.push(val);
        }
    });

    const colorScale = d3.scaleSequential()
        .domain(values.length > 0 ? d3.extent(values) : [0, 100])
        .interpolator(d3.interpolateHcl(indDetails.colorRange[0], indDetails.colorRange[1]));

    // Atualiza cor de preenchimento e bordas dos caminhos dos países
    d3.selectAll(".country")
        .transition()
        .duration(200)
        .attr("fill", function(d) {
            const iso3 = d.id;
            const countryData = state.dataset.countries[iso3];
            if (countryData) {
                const val = countryData.indicators[ind][currentYearStr];
                if (val !== undefined && val !== null) {
                    return colorScale(val);
                }
            }
            return "#161920";
        })
        .attr("stroke", d => d.id === state.selectedCountry ? "#ffffff" : "rgba(0,0,0,0.5)")
        .attr("stroke-width", d => d.id === state.selectedCountry ? 2.2 : 0.6);

    // Reconstrói as marcas de GPs do novo ano
    const svg = d3.select("#world-map");
    const g = svg.select("g");
    
    // Recalcula projeção e caminhos
    const width = svg.attr("width");
    const height = svg.attr("height");
    const projection = d3.geoNaturalEarth1()
        .scale(width / 5.8)
        .translate([width / 2, height / 1.6]);
    const path = d3.geoPath().projection(projection);

    const gpCountriesThisYear = [];
    state.geoData.features.forEach(f => {
        const iso3 = f.id;
        const cData = state.dataset.countries[iso3];
        if (cData && cData.gps.includes(state.currentYear)) {
            const centroid = path.centroid(f);
            if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
                gpCountriesThisYear.push({
                    iso3: iso3,
                    coords: centroid,
                    name: cData.name
                });
            }
        }
    });

    // Limpa e redesenha os pulsares
    g.selectAll(".f1-pulse-group").remove();
    
    const pulses = g.selectAll(".f1-pulse-group")
        .data(gpCountriesThisYear, d => d.iso3)
        .enter()
        .append("g")
        .attr("class", "f1-pulse-group")
        .attr("transform", d => `translate(${d.coords[0]}, ${d.coords[1]})`);

    pulses.append("circle")
        .attr("class", "f1-pulse-ring")
        .attr("r", 1);

    pulses.append("circle")
        .attr("class", "f1-pulse-center")
        .attr("r", 4);

    // Dynamic update of bottom KPIs in real-time
    drawKeyFindings();
    updateIndicatorDetails();
}

// 8. Desenho do Gráfico Histórico de Evolução Temporal
function drawTrendChart() {
    const container = document.querySelector(".chart-wrapper");
    const width = container.clientWidth;
    const height = container.clientHeight || 300;
    
    const svg = d3.select("#trend-chart")
        .attr("width", width)
        .attr("height", height);
        
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 75 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const countryData = state.dataset.countries[state.selectedCountry];
    if (!countryData) return;

    const ind = state.currentIndicator;
    const history = countryData.indicators[ind];
    const gps = countryData.gps;

    // Carrega a média mundial correspondente
    const globalAverages = state.dataset.global_averages[ind];
    const globalPoints = Object.keys(globalAverages).map(year => ({
        year: parseInt(year),
        value: globalAverages[year]
    })).sort((a, b) => a.year - b.year);

    // Converte os dados históricos para uma lista ordenável
    const dataPoints = Object.keys(history).map(year => {
        const yr = parseInt(year);
        const val = history[year];
        const globVal = globalAverages[year];
        let displayVal = val;
        if (state.showRelativeDiff && globVal !== undefined && globVal !== null) {
            displayVal = val - globVal;
        }
        return {
            year: yr,
            value: displayVal,
            rawCountryVal: val,
            rawGlobalVal: globVal
        };
    }).filter(d => d.value !== null && d.value !== undefined)
      .sort((a, b) => a.year - b.year);

    if (dataPoints.length === 0) {
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height / 2)
            .attr("text-anchor", "middle")
            .attr("fill", "var(--text-secondary)")
            .text("Sem dados históricos disponíveis para este indicador.");
        return;
    }

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Define unique clip path ID para evitar transbordar a linha/pontos sobre os eixos ao dar zoom
    const clipId = `trend-clip-${state.selectedCountry}-${state.currentIndicator}`;
    svg.append("defs")
        .append("clipPath")
        .attr("id", clipId)
        .append("rect")
        .attr("width", chartWidth)
        .attr("height", chartHeight);

    // Grupo do corpo do gráfico que será clipado
    const chartBody = g.append("g")
        .attr("clip-path", `url(#${clipId})`);

    // Escalas
    const xScale = d3.scaleLinear()
        .domain(d3.extent(dataPoints, d => d.year))
        .range([0, chartWidth]);

    let yDomain;
    if (state.showRelativeDiff) {
        yDomain = d3.extent(dataPoints, d => d.value);
        // Garante que o zero está sempre visível
        if (yDomain[0] > 0) yDomain[0] = -0.5;
        if (yDomain[1] < 0) yDomain[1] = 0.5;
    } else {
        const allValues = state.showGlobalTrend
            ? dataPoints.map(d => d.value).concat(globalPoints.map(d => d.value))
            : dataPoints.map(d => d.value);
        yDomain = d3.extent(allValues);
    }

    const yScale = d3.scaleLinear()
        .domain(yDomain)
        .nice()
        .range([chartHeight, 0]);

    // Grelha Horizontal e Vertical
    g.append("g")
        .attr("class", "grid")
        .selectAll("line")
        .data(yScale.ticks(5))
        .enter()
        .append("line")
        .attr("class", "grid-line")
        .attr("x1", 0)
        .attr("x2", chartWidth)
        .attr("y1", d => yScale(d))
        .attr("y2", d => yScale(d));

    // Eixo X
    g.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format("d")).ticks(Math.min(10, chartWidth / 50)))
        .selectAll("text")
        .attr("class", "axis-label");

    // Eixo Y
    const indDetails = INDICATOR_DETAILS[ind];
    g.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).ticks(5))
        .selectAll("text")
        .attr("class", "axis-label");

    // Desenha bandas de anomalia económica em segundo plano (2008-2009 e 2020-2021)
    const ANOMALY_PERIODS = [
        { start: 2008, end: 2009, name: "Crise Financeira Global", desc: "Recessão global de 2008-2009" },
        { start: 2020, end: 2021, name: "Pandemia COVID-19", desc: "Confinamentos e paralisia económica global durante a pandemia" }
    ];

    const activeAnomalies = ANOMALY_PERIODS.filter(p => {
        const dMin = xScale.domain()[0];
        const dMax = xScale.domain()[1];
        return p.start <= dMax && p.end >= dMin;
    });

    chartBody.selectAll(".anomaly-band")
        .data(activeAnomalies)
        .enter()
        .append("rect")
        .attr("class", "anomaly-band")
        .attr("x", d => xScale(Math.max(d.start, xScale.domain()[0])))
        .attr("width", d => {
            const xStart = xScale(Math.max(d.start, xScale.domain()[0]));
            const xEnd = xScale(Math.min(d.end, xScale.domain()[1]));
            return Math.max(0, xEnd - xStart);
        })
        .attr("y", 0)
        .attr("height", chartHeight)
        .attr("fill", "rgba(255, 145, 0, 0.05)")
        .attr("stroke", "rgba(255, 145, 0, 0.15)")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3 3")
        .style("cursor", "help")
        .on("mouseover", (event, d) => {
            const tooltip = d3.select("#map-tooltip");
            let content = `<div class="tooltip-title"><span>⚠️ Anomalia: ${d.name}</span></div>`;
            content += `<div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:6px;max-width:220px;line-height:1.3;">${d.desc}.</div>`;
            content += `<div class="tooltip-badge" style="background-color:rgba(255,145,0,0.15);color:#ff9100;border:1px solid rgba(255,145,0,0.3)">Filtro: Excluído das Previsões</div>`;
            
            tooltip.html(content)
                .style("opacity", 1)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 15) + "px");
        })
        .on("mousemove", (event) => {
            d3.select("#map-tooltip")
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 15) + "px");
        })
        .on("mouseleave", () => {
            d3.select("#map-tooltip").style("opacity", 0);
        });

    // Desenha marcas verticais pontilhadas nos anos de GPs de F1
    const verticalGPs = gps.filter(y => y >= xScale.domain()[0] && y <= xScale.domain()[1]);
    
    const gpLines = chartBody.selectAll(".f1-vertical-event")
        .data(verticalGPs)
        .enter()
        .append("line")
        .attr("class", "f1-vertical-event f1-vertical-event-hover")
        .attr("x1", d => xScale(d))
        .attr("x2", d => xScale(d))
        .attr("y1", 0)
        .attr("y2", chartHeight)
        .style("cursor", "pointer")
        .on("mouseover", (event, y) => {
            const tooltip = d3.select("#map-tooltip");
            let content = `<div class="tooltip-title"><span>🏎️ GP de F1 Acolhido</span><span style="font-size:0.75rem;color:var(--text-muted)">${y}</span></div>`;
            content += `<div class="tooltip-row"><span class="tooltip-key">País</span><span class="tooltip-val">${countryData.name}</span></div>`;
            
            if (history[y] !== undefined && history[y] !== null) {
                content += `<div class="tooltip-row"><span class="tooltip-key">${indDetails.name}</span><span class="tooltip-val">${indDetails.format(history[y])}</span></div>`;
            }
            
            if (y === 2020 || y === 2021) {
                content += `<div class="tooltip-badge" style="background-color:rgba(255,145,0,0.15);color:#ff9100;border:1px solid rgba(255,145,0,0.3)">⚠️ Ano Pandémico (Excluído)</div>`;
            } else if (y === 2008 || y === 2009) {
                content += `<div class="tooltip-badge" style="background-color:rgba(255,145,0,0.15);color:#ff9100;border:1px solid rgba(255,145,0,0.3)">⚠️ Crise Global (Excluída)</div>`;
            } else {
                content += `<div class="tooltip-badge badge-gp">Incluído no Modelo Preditivo</div>`;
            }
            
            tooltip.html(content)
                .style("opacity", 1)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 15) + "px");
                
            d3.select(event.currentTarget)
                .transition()
                .duration(100)
                .style("stroke-width", "3px")
                .style("opacity", 1.0);
        })
        .on("mousemove", (event) => {
            d3.select("#map-tooltip")
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 15) + "px");
        })
        .on("mouseleave", (event) => {
            d3.select("#map-tooltip").style("opacity", 0);
            d3.select(event.currentTarget)
                .transition()
                .duration(100)
                .style("stroke-width", "1.5px")
                .style("opacity", 0.75);
        });

    // Desenha Linha de Média Mundial em segundo plano (se ativo e não em modo desvio relativo)
    if (state.showGlobalTrend && !state.showRelativeDiff) {
        const globalLine = d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(d.value))
            .curve(d3.curveMonotoneX);

        chartBody.append("path")
            .datum(globalPoints)
            .attr("class", "global-line-path")
            .attr("d", globalLine)
            .attr("fill", "none")
            .attr("stroke", "var(--text-secondary)")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "4 4")
            .attr("opacity", 0.55);
    }

    // Desenha baseline zero se estiver a mostrar o desvio relativo
    if (state.showRelativeDiff) {
        chartBody.append("line")
            .attr("class", "relative-baseline")
            .attr("x1", 0)
            .attr("x2", chartWidth)
            .attr("y1", yScale(0))
            .attr("y2", yScale(0))
            .attr("stroke", "rgba(255, 255, 255, 0.35)")
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", "3 3");

        chartBody.append("text")
            .attr("class", "relative-baseline-label")
            .attr("x", 10)
            .attr("y", yScale(0) - 6)
            .attr("fill", "var(--text-muted)")
            .attr("font-size", "0.7rem")
            .text("Média Mundial (Baseline)");
    }

    // Desenha Linha de Tendência Económica do País
    const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.value))
        .curve(d3.curveMonotoneX);

    chartBody.append("path")
        .datum(dataPoints)
        .attr("class", "line-path")
        .attr("d", line)
        .attr("stroke", indDetails.colorRange[1]);

    // Pontos (Círculos) nos dados reais
    const dots = chartBody.selectAll(".dot")
        .data(dataPoints)
        .enter()
        .append("circle")
        .attr("class", "dot")
        .attr("cx", d => xScale(d.year))
        .attr("cy", d => yScale(d.value))
        .attr("r", 4)
        .attr("fill", d => {
            if (d.year === 2008 || d.year === 2009 || d.year === 2020 || d.year === 2021) {
                return "#ff9100"; // Cor de aviso âmbar para anos excluídos
            }
            return "#ffffff";
        })
        .attr("stroke", d => {
            if (d.year === 2008 || d.year === 2009 || d.year === 2020 || d.year === 2021) {
                return "#ff9100";
            }
            return indDetails.colorRange[1];
        })
        .attr("stroke-width", 2)
        .style("cursor", "pointer");

    // Tooltip para o Gráfico de Tendência
    const tooltip = d3.select("#map-tooltip");

    dots.on("mouseover", (event, d) => {
        let content = `<div class="tooltip-title"><span>📈 ${countryData.name}</span><span style="font-size:0.75rem;color:var(--text-muted)">${d.year}</span></div>`;
        const hasGP = gps.includes(d.year);
        
        if (state.showRelativeDiff) {
            const isNegativeGood = (ind === "Unemployment" || ind === "Inflation");
            const isOutperforming = (d.value >= 0) !== isNegativeGood;
            const diffClass = isOutperforming ? "neon-text-green" : "neon-text-green-negative";
            
            content += `<div class="tooltip-row"><span class="tooltip-key">Valor Local</span><span class="tooltip-val">${indDetails.format(d.rawCountryVal)}</span></div>`;
            content += `<div class="tooltip-row"><span class="tooltip-key">Média F1 Global</span><span class="tooltip-val" style="color:var(--text-secondary);">${indDetails.format(d.rawGlobalVal)}</span></div>`;
            content += `<div class="tooltip-row"><span class="tooltip-key">Desvio Líquido</span><span class="tooltip-val ${diffClass}" style="font-weight:bold;text-shadow:none;">${formatDeviation(d.value, ind)}</span></div>`;
        } else {
            content += `<div class="tooltip-row"><span class="tooltip-key">${indDetails.name}</span><span class="tooltip-val">${indDetails.format(d.value)}</span></div>`;
        }
        
        // Find previous year to calculate YoY change
        const idx = dataPoints.findIndex(dp => dp.year === d.year);
        if (idx > 0) {
            const prev = dataPoints[idx - 1];
            if (prev.year === d.year - 1) {
                const countryVal = state.showRelativeDiff ? d.rawCountryVal : d.value;
                const prevCountryVal = state.showRelativeDiff ? prev.rawCountryVal : prev.value;
                
                if (prevCountryVal !== 0 && prevCountryVal !== null && prevCountryVal !== undefined) {
                    let changeStr = "";
                    let classColor = "";
                    const isNegativeGood = (ind === "Unemployment" || ind === "Inflation");
                    if (ind === "GDP_growth" || ind === "Inflation" || ind === "Unemployment") {
                        const change = countryVal - prevCountryVal;
                        changeStr = `${change > 0 ? '+' : ''}${change.toFixed(2)} pp (abs)`;
                        classColor = (change > 0) !== isNegativeGood ? "neon-text-green" : "neon-text-green-negative";
                    } else {
                        const pct = ((countryVal - prevCountryVal) / Math.abs(prevCountryVal)) * 100.0;
                        changeStr = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}% (YoY)`;
                        classColor = (pct > 0) !== isNegativeGood ? "neon-text-green" : "neon-text-green-negative";
                    }
                    content += `<div class="tooltip-row"><span class="tooltip-key">Variação YoY</span><span class="tooltip-val ${classColor}" style="text-shadow:none;">${changeStr}</span></div>`;
                }
            }
        }

        // Média Global e Comparação (apenas em modo absoluto)
        if (state.showGlobalTrend && !state.showRelativeDiff) {
            const globalVal = globalAverages[String(d.year)];
            if (globalVal !== undefined && globalVal !== null) {
                content += `<div class="tooltip-row" style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08)">` +
                           `<span class="tooltip-key">Média Global F1</span>` +
                           `<span class="tooltip-val" style="color:var(--text-secondary);">${indDetails.format(globalVal)}</span></div>`;
                
                let diff = d.value - globalVal;
                let diffStr = "";
                let diffClass = "";
                
                if (ind === "GDP_growth" || ind === "Inflation" || ind === "Unemployment") {
                    diffStr = `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} pp`;
                    if (ind === "GDP_growth") {
                        diffClass = diff >= 0 ? "neon-text-green" : "neon-text-green-negative";
                    } else {
                        diffClass = diff <= 0 ? "neon-text-green" : "neon-text-green-negative";
                    }
                } else {
                    if (globalVal !== 0) {
                        const pctDiff = (diff / Math.abs(globalVal)) * 100.0;
                        diffStr = `${pctDiff >= 0 ? '+' : ''}${pctDiff.toFixed(1)}%`;
                        diffClass = pctDiff >= 0 ? "neon-text-green" : "neon-text-green-negative";
                    }
                }
                
                if (diffStr) {
                    content += `<div class="tooltip-row">` +
                               `<span class="tooltip-key">Desvio ao Global</span>` +
                               `<span class="tooltip-val ${diffClass}" style="text-shadow:none;">${diffStr}</span></div>`;
                }
            }
        }
        
        if (d.year === 2020 || d.year === 2021) {
            content += `<div class="tooltip-badge" style="background-color:rgba(255,145,0,0.15);color:#ff9100;border:1px solid rgba(255,145,0,0.3);margin-top:6px;width:calc(100% - 2px);box-sizing:border-box;gap:4px;">⚠️ Pandemia (Excluído)</div>`;
        } else if (d.year === 2008 || d.year === 2009) {
            content += `<div class="tooltip-badge" style="background-color:rgba(255,145,0,0.15);color:#ff9100;border:1px solid rgba(255,145,0,0.3);margin-top:6px;width:calc(100% - 2px);box-sizing:border-box;gap:4px;">⚠️ Crise Global (Excluído)</div>`;
        } else if (hasGP) {
            content += `<div class="tooltip-badge badge-gp">🏎️ Acolheu Corrida de F1</div>`;
        } else {
            content += `<div class="tooltip-badge badge-nongp">Sem Corrida de F1</div>`;
        }
        
        tooltip.html(content)
            .style("opacity", 1)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 15) + "px");
            
        d3.select(event.currentTarget)
            .transition()
            .duration(100)
            .attr("r", 7)
            .attr("fill", d.year === 2008 || d.year === 2009 || d.year === 2020 || d.year === 2021 ? "#ffb300" : "var(--f1-red)");
    })
    .on("mousemove", (event) => {
        tooltip.style("left", (event.pageX + 15) + "px")
               .style("top", (event.pageY - 15) + "px");
    })
    .on("mouseleave", (event, d) => {
        tooltip.style("opacity", 0);
        d3.select(event.currentTarget)
            .transition()
            .duration(100)
            .attr("r", 4)
            .attr("fill", d => {
                if (d.year === 2008 || d.year === 2009 || d.year === 2020 || d.year === 2021) {
                    return "#ff9100";
                }
                return "#ffffff";
            });
    });

    // Função de atualização do zoom (eixo X + adaptação dinâmica do eixo Y)
    function zoomed(event) {
        const transform = event.transform;
        const newXScale = transform.rescaleX(xScale);

        // Atualiza eixo X
        g.select(".x-axis")
            .call(d3.axisBottom(newXScale).tickFormat(d3.format("d")).ticks(Math.min(10, chartWidth / 50)))
            .selectAll("text")
            .attr("class", "axis-label");

        // --- Adaptação dinâmica do eixo Y ---
        const [xMin, xMax] = newXScale.domain();
        const visiblePts = dataPoints.filter(d => d.year >= xMin - 0.5 && d.year <= xMax + 0.5);
        const visibleGlb = (state.showGlobalTrend && !state.showRelativeDiff)
            ? globalPoints.filter(d => d.year >= xMin - 0.5 && d.year <= xMax + 0.5)
            : [];
        const allVisible = visiblePts.map(d => d.value).concat(visibleGlb.map(d => d.value));

        if (allVisible.length >= 2) {
            let yDomain = d3.extent(allVisible);
            if (state.showRelativeDiff) {
                if (yDomain[0] > 0) yDomain[0] = -0.5;
                if (yDomain[1] < 0) yDomain[1] = 0.5;
            }
            yScale.domain(yDomain).nice();

            // Redesenha eixo Y
            g.select(".y-axis")
                .transition().duration(150)
                .call(d3.axisLeft(yScale).ticks(5))
                .selectAll("text").attr("class", "axis-label");

            // Reconstrói grelha horizontal com novos ticks
            g.select(".grid").selectAll("line")
                .data(yScale.ticks(5))
                .join("line")
                .attr("class", "grid-line")
                .attr("x1", 0).attr("x2", chartWidth)
                .attr("y1", d => yScale(d)).attr("y2", d => yScale(d));
        }
        // --- fim adaptação Y ---

        // Atualiza linha de tendência
        const updatedLine = d3.line()
            .x(d => newXScale(d.year))
            .y(d => yScale(d.value))
            .curve(d3.curveMonotoneX);

        chartBody.select(".line-path")
            .attr("d", updatedLine);

        // Atualiza linha de média mundial (se ativa e não em modo desvio relativo)
        if (state.showGlobalTrend && !state.showRelativeDiff) {
            const updatedGlobalLine = d3.line()
                .x(d => newXScale(d.year))
                .y(d => yScale(d.value))
                .curve(d3.curveMonotoneX);

            chartBody.select(".global-line-path")
                .attr("d", updatedGlobalLine);
        }

        // Atualiza baseline zero se estiver a mostrar o desvio relativo
        if (state.showRelativeDiff) {
            chartBody.select(".relative-baseline")
                .attr("y1", yScale(0))
                .attr("y2", yScale(0));

            chartBody.select(".relative-baseline-label")
                .attr("y", yScale(0) - 6);
        }

        // Atualiza posições dos pontos (X e Y)
        chartBody.selectAll(".dot")
            .attr("cx", d => newXScale(d.year))
            .attr("cy", d => yScale(d.value));

        // Atualiza linhas verticais de GPs
        chartBody.selectAll(".f1-vertical-event")
            .attr("x1", d => newXScale(d))
            .attr("x2", d => newXScale(d));

        // Atualiza posições das bandas de anomalia
        chartBody.selectAll(".anomaly-band")
            .attr("x", d => newXScale(Math.max(d.start, xScale.domain()[0])))
            .attr("width", d => {
                const xStart = newXScale(Math.max(d.start, xScale.domain()[0]));
                const xEnd = newXScale(Math.min(d.end, xScale.domain()[1]));
                return Math.max(0, xEnd - xStart);
            });
    }

    // Desenha a legenda das linhas
    const legend = svg.append("g")
        .attr("class", "chart-legend")
        .attr("transform", `translate(${margin.left + 15}, ${margin.top + 5})`);

    // Linha do país selecionado
    legend.append("line")
        .attr("x1", 0).attr("x2", 15)
        .attr("y1", 5).attr("y2", 5)
        .attr("stroke", indDetails.colorRange[1])
        .attr("stroke-width", 3);

    legend.append("text")
        .attr("x", 20).attr("y", 9)
        .attr("fill", "var(--text-primary)")
        .attr("font-size", "0.75rem")
        .attr("font-weight", "500")
        .text(state.showRelativeDiff ? `${countryData.name} (Desvio vs Média)` : countryData.name);

    if (state.showGlobalTrend && !state.showRelativeDiff) {
        // Linha da média mundial
        legend.append("line")
            .attr("x1", 110).attr("x2", 125)
            .attr("y1", 5).attr("y2", 5)
            .attr("stroke", "var(--text-secondary)")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "3 3")
            .attr("opacity", 0.8);

        legend.append("text")
            .attr("x", 130).attr("y", 9)
            .attr("fill", "var(--text-secondary)")
            .attr("font-size", "0.75rem")
            .text("Média Mundial (Países F1)");
    }

    // Configura o comportamento de zoom no D3
    const zoom = d3.zoom()
        .scaleExtent([1, 8]) // Zoom mínimo 1x (normal), máximo 8x
        .translateExtent([[0, 0], [chartWidth, chartHeight]]) // Restringe deslocamento horizontal
        .extent([[0, 0], [chartWidth, chartHeight]])
        .on("zoom", zoomed);

    svg.call(zoom);

    // Geração dinâmica de nota econométrica / insights
    const insightEl = document.getElementById("country-economic-insight");
    if (insightEl) {
        const gpYearsList = gps.filter(y => y <= 2024);
        const totalGPs = gpYearsList.length;
        
        let insightText = "";
        
        if (totalGPs === 0) {
            insightText = `<strong>Nota de Análise:</strong> O país <strong>${countryData.name}</strong> não acolheu nenhum Grande Prémio de F1 no período histórico analisado (1960-2024). Os dados no gráfico mostram a sua tendência económica agregada nacional e como ela se compara com a média dos países anfitriões.`;
        } else {
            const firstGP = d3.min(gpYearsList);
            const lastGP = d3.max(gpYearsList);
            
            // Calcula médias reais excluindo anos de anomalias (COVID e crises) para evitar enviesamento
            const EXCLUDED = new Set([2008, 2009, 2020, 2021]);
            const gpVals = dataPoints.filter(d => gps.includes(d.year) && !EXCLUDED.has(d.year)).map(d => d.value);
            const nongpVals = dataPoints.filter(d => !gps.includes(d.year) && !EXCLUDED.has(d.year)).map(d => d.value);
            
            const avgGP = gpVals.length > 0 ? d3.mean(gpVals) : 0;
            const avgNonGP = nongpVals.length > 0 ? d3.mean(nongpVals) : 0;
            const diff = avgGP - avgNonGP;
            
            insightText = `<strong>Nota de Análise (${countryData.name}):</strong> Organizou <strong>${totalGPs} GPs</strong> (entre ${firstGP} e ${lastGP}). `;
            
            if (ind === "Tourism_arrivals") {
                if (lastGP < 2010) {
                    insightText += `⚠️ <strong>Viés de Época & Escala do Turismo:</strong> O país não acolhe a F1 no calendário recente (última edição em ${lastGP}). Historicamente, os anos de GP registaram em média <strong>${indDetails.format(avgGP)}</strong> chegadas vs <strong>${indDetails.format(avgNonGP)}</strong> em anos comuns. Esta diferença negativa reflete o crescimento secular do turismo global nas últimas décadas (fora do período da F1 local) e não um impacto negativo do evento. O modelo preditivo corrige este viés temporal ao isolar a tendência global.`;
                } else {
                    insightText += `📈 <strong>Dinamismo no Setor de Turismo:</strong> O país acolhe ativamente o evento no calendário moderno. Os anos de Grande Prémio registaram em média <strong>${indDetails.format(avgGP)}</strong> chegadas de turistas internacionais, em comparação com <strong>${indDetails.format(avgNonGP)}</strong> nos anos sem GP (diferença média de <strong>+${indDetails.format(diff)}</strong>). Isto demonstra uma correlação direta com a atratividade turística gerada pela projeção mediática da F1.`;
                }
            } else if (ind === "GDP_growth") {
                if (diff < 0) {
                    insightText += `📉 <strong>Ciclo Económico vs. Impacto Setorial:</strong> O crescimento do PIB Real foi marginalmente inferior nos anos com GP (média de <strong>${avgGP.toFixed(2)}%</strong> com GP vs <strong>${avgNonGP.toFixed(2)}%</strong> sem GP, diferença de <strong>${diff.toFixed(2)} pp</strong>). Isto reflete a dominância dos ciclos macroeconómicos globais (taxas de juro, comércio internacional) sobre o impacto local da F1. Embora a corrida estimule fortemente setores específicos (hotelaria, restauração), a sua escala agregada anual é absorvida pelo ruído estatístico nacional.`;
                } else {
                    insightText += `🚀 <strong>Aceleração de Curto Prazo:</strong> Observa-se um prémio positivo de crescimento económico nos anos com GP (média de <strong>${avgGP.toFixed(2)}%</strong> vs <strong>${avgNonGP.toFixed(2)}%</strong>, diferença de <strong>+${diff.toFixed(2)} pp</strong>). Isto sugere que a organização do evento coincide com fases de expansão económica e robustez do consumo interno, onde o investimento público/privado na infraestrutura do circuito gera um efeito multiplicador temporário no produto nacional.`;
                }
            } else if (ind === "Unemployment") {
                if (diff < 0) {
                    insightText += `💼 <strong>Criação de Emprego & Atividade:</strong> A taxa de desemprego foi em média <strong>${avgGP.toFixed(2)}%</strong> nos anos de GP vs <strong>${avgNonGP.toFixed(2)}%</strong> em anos comuns (diferença de <strong>${diff.toFixed(2)} pp</strong>). Há uma correlação positiva com períodos de forte contratação e atividade económica no mercado de trabalho local associada à preparação e realização do evento.`;
                } else {
                    insightText += `💼 <strong>Rigidez Estrutural do Emprego:</strong> A taxa de desemprego média foi ligeiramente superior nos anos de GP (diferença de <strong>+${diff.toFixed(2)} pp</strong>). Isso sugere que o evento cria emprego temporário no setor de serviços, mas não altera a taxa estrutural de desemprego do país a longo prazo.`;
                }
            } else if (ind === "Inflation") {
                if (diff > 0) {
                    insightText += `⚠️ <strong>Enquadramento Inflacionário Estrutural:</strong> A inflação média foi superior nos anos de GP (<strong>${avgGP.toFixed(2)}%</strong> vs <strong>${avgNonGP.toFixed(2)}%</strong>, diferença de <strong>+${diff.toFixed(2)} pp</strong>). Este aumento é essencialmente explicável pelo enquadramento histórico: muitas edições do GP ocorreram durante as décadas de 70 e 80, períodos marcados por crises petrolíferas globais e inflação estrutural elevada, e não por uma pressão sobre a procura induzida diretamente pelo evento.`;
                } else {
                    insightText += `✅ <strong>Estabilidade de Preços & Oferta:</strong> Os anos com corrida registaram inflação controlada (média de <strong>${avgGP.toFixed(2)}%</strong> com GP vs <strong>${avgNonGP.toFixed(2)}%</strong> sem GP, diferença de <strong>${diff.toFixed(2)} pp</strong>). Isto demonstra estabilidade monetária nacional, sugerindo que o pico de procura turística de curto prazo durante a semana do GP é absorvido pela elasticidade da oferta local, sem provocar pressões inflacionárias persistentes a nível macroeconómico.`;
                }
            } else if (ind === "FDI") {
                const percentDiff = avgNonGP !== 0 ? (diff / Math.abs(avgNonGP)) * 100.0 : 0.0;
                const formattedDiff = formatAbsoluteChange(diff, "FDI");
                if (diff < 0) {
                    insightText += `🏢 <strong>Fluxos de IDE e Integração de Mercados:</strong> O Investimento Direto Estrangeiro (FDI) líquido anual foi inferior nos anos de GP (média de <strong>${formatAbsoluteChange(avgGP, "FDI")}</strong> vs <strong>${formatAbsoluteChange(avgNonGP, "FDI")}</strong>, diferença de <strong>${formattedDiff}</strong> ou <strong>${percentDiff.toFixed(1)}%</strong>). Historicamente, os maiores fluxos de IDE em países europeus e emergentes decorreram de reformas estruturais e integrações em blocos económicos (como a adesão de Portugal à CEE em 1986), ocorrendo predominantemente fora dos anos de GP.`;
                } else {
                    insightText += `🏢 <strong>Captação de Capital & Credibilidade:</strong> Os anos com corrida registaram um fluxo superior de IDE (média de <strong>${formatAbsoluteChange(avgGP, "FDI")}</strong> vs <strong>${formatAbsoluteChange(avgNonGP, "FDI")}</strong>, diferença de <strong>+${formattedDiff}</strong> ou <strong>+${percentDiff.toFixed(1)}%</strong>). A organização do Grande Prémio correlaciona-se com períodos de elevada confiança dos investidores internacionais, projetando estabilidade jurídica e financeira que estimula a entrada de capital produtivo de longo prazo.`;
                }
            } else if (ind === "GDP_pc") {
                if (diff < 0) {
                    insightText += `💰 <strong>Viés Temporal do PIB per Capita:</strong> A média do PIB per capita real foi inferior nos anos de GP (<strong>${indDetails.format(avgGP)}</strong> vs <strong>${indDetails.format(avgNonGP)}</strong>). Este resultado é puramente um reflexo do viés temporal de crescimento secular da economia (a F1 decorreu maioritariamente no passado, quando a produtividade e o PIB per capita eram naturalmente inferiores). O nosso modelo autoregressivo corrige este viés ao isolar o crescimento real secular e a tendência tecnológica.`;
                } else {
                    insightText += `💰 <strong>Bem-Estar Económico & Produtividade:</strong> O PIB per capita real registou uma média superior nos anos de GP (<strong>${indDetails.format(avgGP)}</strong> vs <strong>${indDetails.format(avgNonGP)}</strong>, diferença de <strong>+${indDetails.format(diff)}</strong>). Isto alinha a organização do Grande Prémio a anos de elevada produtividade do trabalho e maior poder de compra médio da população.`;
                }
            }
        }
        
        insightEl.innerHTML = insightText;
    }
}

// 9. Desenho do Painel do Simulador/Previsor (2026-2027)
function drawPredictor() {
    const container = document.querySelector(".forecast-chart-area");
    const width = container.clientWidth;
    const height = 230;
    
    const svg = d3.select("#predictor-chart")
        .attr("width", width)
        .attr("height", height);
        
    svg.selectAll("*").remove();

    const countryData = state.dataset.countries[state.selectedCountry];
    if (!countryData) return;

    const ind = state.currentIndicator;
    const yearStr = state.forecastYear; // "2026" ou "2027"
    const isForecast = state.predictorTab === "forecast";

    // Configuração dinâmica da interface baseada no Tab ativo
    const introEl = document.querySelector(".predictor-intro");
    const scenarioWithTitle = document.querySelector(".with-gp-box .scenario-title");
    const scenarioWithoutTitle = document.querySelector(".without-gp-box .scenario-title");
    const scenarioWithYear = document.querySelector(".with-gp-box .scenario-year");
    const scenarioWithoutYear = document.querySelector(".without-gp-box .scenario-year");
    const netImpactLabel = document.querySelector(".net-impact-box .impact-label");
    const forecastToggleContainer = document.querySelector(".forecast-years-toggle");

    let valWithGP, valWithoutGP;
    const indDetails = INDICATOR_DETAILS[ind];
    const shortLabel = indDetails ? (indDetails.shortLabel || indDetails.name) : "Métrica";

    if (isForecast) {
        if (introEl) introEl.innerHTML = `Simulação preditiva baseada no modelo autoregressivo para <span id="predictor-country-name" class="neon-text-red">${countryData.name}</span>.`;
        if (scenarioWithTitle) scenarioWithTitle.innerText = `Cenário Com GP (${shortLabel})`;
        if (scenarioWithoutTitle) scenarioWithoutTitle.innerText = `Cenário Sem GP (${shortLabel})`;
        if (scenarioWithYear) scenarioWithYear.innerText = `Previsão ${yearStr}`;
        if (scenarioWithoutYear) scenarioWithoutYear.innerText = `Previsão ${yearStr}`;
        if (netImpactLabel) netImpactLabel.innerText = `Impacto Neto (${shortLabel})`;
        if (forecastToggleContainer) forecastToggleContainer.style.display = "flex";
        
        const modelSelect = document.getElementById("predictor-model-select");
        const modelContainer = document.getElementById("model-selector-container");
        
        const getR2 = (modelKey) => {
            const metrics = countryData.predictions && countryData.predictions.metrics && countryData.predictions.metrics[modelKey]
                ? countryData.predictions.metrics[modelKey][ind]
                : null;
            return metrics ? metrics.r2 : 0.0;
        };

        if (modelSelect) {
            modelSelect.innerHTML = "";
            const originalLabels = {
                "ridge": "Regressão Ridge (ML)",
                "xgboost": "XGBoost Regressor (ML)",
                "rf": "Random Forest (ML)"
            };

            const validModels = [];
            ["ridge", "xgboost", "rf"].forEach(modelKey => {
                const r2 = getR2(modelKey);
                if (r2 >= 0.70) {
                    validModels.push({ key: modelKey, r2: r2 });
                }
            });

            if (validModels.length > 0) {
                if (modelContainer) modelContainer.style.display = "flex";
                validModels.forEach(m => {
                    const opt = document.createElement("option");
                    opt.value = m.key;
                    opt.text = `${originalLabels[m.key]} (R²: ${(m.r2 * 100).toFixed(0)}%)`;
                    modelSelect.appendChild(opt);
                });
                
                if (!validModels.some(m => m.key === state.selectedModel)) {
                    validModels.sort((a, b) => b.r2 - a.r2);
                    state.selectedModel = validModels[0].key;
                }
                modelSelect.value = state.selectedModel;
            } else {
                if (modelContainer) modelContainer.style.display = "none";
                state.selectedModel = null;
            }
        }

        const histInfo = document.getElementById("predictor-hist-info");
        if (histInfo) histInfo.remove();

        if (!state.selectedModel) {
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", height / 2 - 10)
                .attr("text-anchor", "middle")
                .attr("fill", "var(--text-secondary)")
                .style("font-size", "0.9rem")
                .style("font-weight", "600")
                .text("Previsão Indisponível (R² < 70%)");
                
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", height / 2 + 15)
                .attr("text-anchor", "middle")
                .attr("fill", "var(--text-muted)")
                .style("font-size", "0.75rem")
                .text("Nenhum modelo preditivo atingiu o nível de confiança exigido de 70% R².");
                
            document.getElementById("val-with-gp").innerText = "—";
            document.getElementById("val-without-gp").innerText = "—";
            document.getElementById("val-net-impact").innerText = "—";
            document.getElementById("model-r2").innerText = "—";
            document.getElementById("model-mae").innerText = "—";
            return;
        }

        const predictionsBlock = countryData.predictions && countryData.predictions[state.selectedModel] ? countryData.predictions[state.selectedModel] : null;
        const predObj = predictionsBlock && predictionsBlock[yearStr] ? predictionsBlock[yearStr][ind] : null;
        
        if (!predObj) {
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", height / 2)
                .attr("text-anchor", "middle")
                .attr("fill", "var(--text-secondary)")
                .text("Modelo não conseguiu estimar este indicador.");
            return;
        }
        valWithGP = predObj.with_gp;
        valWithoutGP = predObj.without_gp;

        // Atualizar métricas do modelo
        const metricsBlock = countryData.predictions && countryData.predictions.metrics && countryData.predictions.metrics[state.selectedModel] ? countryData.predictions.metrics[state.selectedModel][ind] : null;
        if (metricsBlock) {
            document.getElementById("model-r2").innerText = metricsBlock.r2.toFixed(2);
            const maeFormatted = (ind === "GDP_growth" || ind === "Inflation")
                ? `${metricsBlock.mae.toFixed(2)}%`
                : indDetails.format(metricsBlock.mae);
            document.getElementById("model-mae").innerText = maeFormatted;
        } else {
            document.getElementById("model-r2").innerText = "—";
            document.getElementById("model-mae").innerText = "—";
        }
    } else {
        if (introEl) introEl.innerHTML = `Retrospectiva dos dados reais registados nos anos de corrida vs. comuns para <span id="predictor-country-name" class="neon-text-red">${countryData.name}</span>.`;
        if (scenarioWithTitle) scenarioWithTitle.innerText = `Média Anos Com GP (${shortLabel})`;
        if (scenarioWithoutTitle) scenarioWithoutTitle.innerText = `Média Anos Sem GP (${shortLabel})`;
        if (scenarioWithYear) scenarioWithYear.innerText = "Histórico Real (1960-2024)";
        if (scenarioWithoutYear) scenarioWithoutYear.innerText = "Histórico Real (1960-2024)";
        if (netImpactLabel) netImpactLabel.innerText = `Diferença Média (${shortLabel})`;
        if (forecastToggleContainer) forecastToggleContainer.style.display = "none";
        
        const modelContainer = document.getElementById("model-selector-container");
        if (modelContainer) modelContainer.style.display = "none";

        let histInfo = document.getElementById("predictor-hist-info");
        if (!histInfo) {
            histInfo = document.createElement("div");
            histInfo.id = "predictor-hist-info";
            histInfo.style.fontSize = "0.75rem";
            histInfo.style.color = "var(--text-secondary)";
            histInfo.style.marginTop = "5px";
            histInfo.style.fontWeight = "500";
            const toggleParent = document.querySelector(".forecast-toggle-container");
            if (toggleParent) toggleParent.appendChild(histInfo);
        }
        
        const gpYears = countryData.gps.filter(y => y <= 2024);
        if (gpYears.length > 0) {
            histInfo.innerText = `${gpYears.length} GPs: ${gpYears.join(", ")}`;
            histInfo.style.maxWidth = "280px";
            histInfo.style.wordBreak = "break-word";
        } else {
            histInfo.innerText = "Nunca acolheu GPs de F1 antes de 2025.";
        }

        // Lógica para Impacto Real Histórico
        const history = countryData.indicators[ind];
        const gpsSet = new Set(countryData.gps);
        const gpVals = [];
        const nongpVals = [];
        const EXCLUDED = new Set([2008, 2009, 2020, 2021]);

        Object.keys(history).forEach(year => {
            const y = parseInt(year);
            if (y <= 2024 && !EXCLUDED.has(y)) {
                let val = history[year];
                
                // Aplicar YoY para indicadores absolutos, para consistência com o ETL
                if (ind === "Tourism_arrivals" || ind === "GDP_pc" || ind === "FDI") {
                    const prevYear = y - 1;
                    if (history[prevYear] !== undefined && history[prevYear] !== null && history[prevYear] !== 0 && !EXCLUDED.has(prevYear)) {
                        val = ((history[year] - history[prevYear]) / Math.abs(history[prevYear])) * 100.0;
                    } else {
                        val = null; // Ignorar se não houver base comparável
                    }
                }

                if (val !== null && val !== undefined) {
                    if (gpsSet.has(y)) {
                        gpVals.push(val);
                    } else {
                        nongpVals.push(val);
                    }
                }
            }
        });

        // Caso limite: se não houver anos GP fora de anomalias (ex: só correu na pandemia), inclui anos com anomalia como fallback
        if (gpVals.length === 0) {
            Object.keys(history).forEach(year => {
                const y = parseInt(year);
                if (y <= 2024) {
                    const val = history[year];
                    if (val !== undefined && val !== null && gpsSet.has(y)) {
                        gpVals.push(val);
                    }
                }
            });
        }

        if (gpVals.length > 0) {
            valWithGP = gpVals.reduce((a, b) => a + b, 0) / gpVals.length;
        } else {
            valWithGP = 0.0;
        }

        if (nongpVals.length > 0) {
            valWithoutGP = nongpVals.reduce((a, b) => a + b, 0) / nongpVals.length;
        } else {
            valWithoutGP = 0.0;
        }
    }

    const netImpact = valWithGP - valWithoutGP;

    // Atualiza os dados nas caixas de texto (Metrics Panel) da UI
    const formatPercent = v => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
    
    document.getElementById("val-with-gp").innerText = formatPercent(valWithGP);
    document.getElementById("val-without-gp").innerText = formatPercent(valWithoutGP);
    
    const impactEl = document.getElementById("val-net-impact");
    let symbol = netImpact > 0 ? "+" : "";
    
    impactEl.innerText = `${symbol}${netImpact.toFixed(2)}%`;
    if (ind === "Inflation") {
        impactEl.className = netImpact < 0 ? "impact-value neon-text-green" : "impact-value neon-text-red";
    } else {
        impactEl.className = netImpact > 0 ? "impact-value neon-text-green" : "impact-value neon-text-red";
    }

    // Atualiza o custo estimado da licença F1
    const costValEl = document.getElementById("val-hosting-cost");
    const costDescEl = document.getElementById("val-hosting-type");
    const feeObj = ESTIMATED_HOSTING_FEES[state.selectedCountry];

    if (costValEl && costDescEl) {
        if (feeObj) {
            costValEl.innerText = `$${feeObj.fee}M / ano`;
            costDescEl.innerText = `Licença: ${feeObj.type}`;
        } else {
            costValEl.innerText = "N/D";
            costDescEl.innerText = "Sem estimativa disponível";
        }
    }

    // --- Cálculo de ROI ---
    const roiValEl  = document.getElementById("val-roi");
    const roiDescEl = document.getElementById("val-roi-desc");
    if (roiValEl && roiDescEl && feeObj) {
        const hostingFeeM = feeObj.fee;
        let gdpBn = COUNTRY_GDP_BILLIONS[state.selectedCountry];
        if (isForecast) {
            gdpBn = getGDPForYear(state.selectedCountry, yearStr);
        } else {
            const gpYears = countryData.gps ? countryData.gps.filter(y => y <= 2024) : [];
            if (gpYears.length > 0) {
                let totalGdp = 0;
                let count = 0;
                gpYears.forEach(y => {
                    const gdp = getGDPForYear(state.selectedCountry, y);
                    if (gdp > 0) {
                        totalGdp += gdp;
                        count++;
                    }
                });
                if (count > 0) {
                    gdpBn = totalGdp / count;
                }
            }
        }
        
        let baselineVal = 1.0;
        if (isForecast) {
            const predictionsBlock = countryData.predictions && countryData.predictions[state.selectedModel] ? countryData.predictions[state.selectedModel] : null;
            const predObj = predictionsBlock && predictionsBlock[yearStr] ? predictionsBlock[yearStr][ind] : null;
            if (predObj) {
                baselineVal = predObj.baseline || 1.0;
            }
        } else {
            const history = countryData.indicators[ind];
            if (history) {
                const gpYears = countryData.gps ? countryData.gps.filter(y => y <= 2024) : [];
                let validGpVals = [];
                gpYears.forEach(y => {
                    const val = history[String(y)];
                    if (val !== undefined && val !== null) {
                        validGpVals.push(val);
                    }
                });
                if (validGpVals.length > 0) {
                    baselineVal = validGpVals.reduce((a, b) => a + b, 0) / validGpVals.length;
                } else {
                    const years = Object.keys(history).map(Number).filter(y => y <= 2024);
                    const latestYear = years.length > 0 ? Math.max(...years) : 2024;
                    baselineVal = history[latestYear] || 1.0;
                }
            }
        }

        let gainM = null;
        let roiText = "N/D";
        let roiDesc = "Indicador não monetizável diretamente";
        let roiClass = "roi-value";

        // Determinação de estados de retorno com base no impacto líquido
        const isNegative = netImpact < 0;
        const isMarginal = Math.abs(netImpact) < 0.05;

        if (ind === "GDP_growth" && gdpBn) {
            // Fator de atribuição local para converter impacto macroeconómico nacional na escala regional do evento
            const localAttFactor = 1 / (1 + (gdpBn / 150));
            gainM = (netImpact / 100) * gdpBn * 1000 * localAttFactor;
            const roiPct = ((gainM - hostingFeeM) / hostingFeeM) * 100;
            
            if (isNegative) {
                roiText = "Risco Fiscal Elevado";
                roiDesc = `Retorno Macro: ${roiPct.toLocaleString('pt-PT', {maximumFractionDigits: 0})}%. O impacto estimado no PIB é negativo nesta série histórica.`;
                roiClass = "roi-value neon-text-red";
                roiValEl.style.fontSize = "0.9rem";
            } else if (isMarginal) {
                roiText = "Efeito Marginal";
                roiDesc = `Retorno Macro: ${roiPct >= 0 ? "+" : ""}${roiPct.toLocaleString('pt-PT', {maximumFractionDigits: 0})}%. Variação do PIB insignificante para cobrir o custo da licença.`;
                roiClass = "roi-value neon-text-red";
                roiValEl.style.fontSize = "0.95rem";
            } else {
                roiText = `+$${gainM.toFixed(0)}M`;
                roiDesc = `Retorno Macro Est.: ${roiPct >= 0 ? "+" : ""}${roiPct.toFixed(0)}%`;
                roiClass = `roi-value ${gainM >= hostingFeeM ? "neon-text-green" : "neon-text-green-negative"}`;
                roiValEl.style.fontSize = "1.2rem";
            }
        } else if (ind === "FDI") {
            // Desconto para Investimento Direto Estrangeiro na escala nacional vs local (referência $5B de IDE base)
            const fdiAttFactor = 1 / (1 + (baselineVal / 5e9));
            gainM = ((netImpact / 100) * baselineVal * fdiAttFactor) / 1e6;
            const roiPct = ((gainM - hostingFeeM) / hostingFeeM) * 100;
            
            if (isNegative) {
                roiText = "Risco Fiscal Elevado";
                roiDesc = `Retorno Macro: ${roiPct.toLocaleString('pt-PT', {maximumFractionDigits: 0})}%. O impacto estimado no IDE líquido é negativo nesta série histórica.`;
                roiClass = "roi-value neon-text-red";
                roiValEl.style.fontSize = "0.9rem";
            } else if (isMarginal) {
                roiText = "Efeito Marginal";
                roiDesc = `Retorno Macro: ${roiPct >= 0 ? "+" : ""}${roiPct.toLocaleString('pt-PT', {maximumFractionDigits: 0})}%. Variação do IDE insuficiente para amortizar a licença.`;
                roiClass = "roi-value neon-text-red";
                roiValEl.style.fontSize = "0.95rem";
            } else {
                roiText = `+$${gainM.toFixed(0)}M`;
                roiDesc = `Retorno Macro Est.: ${roiPct >= 0 ? "+" : ""}${roiPct.toFixed(0)}%`;
                roiClass = `roi-value ${gainM >= hostingFeeM ? "neon-text-green" : "neon-text-green-negative"}`;
                roiValEl.style.fontSize = "1.2rem";
            }
        } else if (ind === "Tourism_arrivals") {
            // Desconto para chegada de turistas na escala nacional vs local (referência 5M de turistas base)
            const tourismAttFactor = 1 / (1 + (baselineVal / 5e6));
            gainM = ((netImpact / 100) * baselineVal * AVG_TOURIST_SPEND_USD * tourismAttFactor) / 1e6;
            const roiPct = ((gainM - hostingFeeM) / hostingFeeM) * 100;
            
            if (isNegative) {
                roiText = "Risco Fiscal Elevado";
                roiDesc = `Retorno Macro: ${roiPct.toLocaleString('pt-PT', {maximumFractionDigits: 0})}%. O fluxo de turistas estimado é negativo nesta série histórica.`;
                roiClass = "roi-value neon-text-red";
                roiValEl.style.fontSize = "0.9rem";
            } else if (isMarginal) {
                roiText = "Efeito Marginal";
                roiDesc = `Retorno Macro: ${roiPct >= 0 ? "+" : ""}${roiPct.toLocaleString('pt-PT', {maximumFractionDigits: 0})}%. O aumento turístico estimado não cobre a taxa da licença.`;
                roiClass = "roi-value neon-text-red";
                roiValEl.style.fontSize = "0.95rem";
            } else {
                const formattedGain = gainM >= 1000 ? `$${(gainM/1000).toFixed(1)}B` : `$${gainM.toFixed(0)}M`;
                roiText = `+${formattedGain}`;
                roiDesc = `Retorno Macro Est.: ${roiPct >= 0 ? "+" : ""}${roiPct.toFixed(0)}%`;
                roiClass = `roi-value ${gainM >= hostingFeeM ? "neon-text-green" : "neon-text-green-negative"}`;
                roiValEl.style.fontSize = "1.2rem";
            }
        }

        roiValEl.innerText  = roiText;
        roiValEl.className  = roiClass;
        roiDescEl.innerText = roiDesc;
    } else if (roiValEl && roiDescEl) {
        roiValEl.innerText  = "N/D";
        roiDescEl.innerText = "Sem dados de licença disponíveis";
    }
    // --- fim ROI ---

    // Configura e desenha o gráfico de barras comparativo
    const margin = { top: 25, right: 15, bottom: 40, left: 45 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const data = [
        { scenario: isForecast ? "Sem GP" : "Média Sem GP", value: valWithoutGP, color: "var(--text-muted)" },
        { scenario: isForecast ? "Com GP" : "Média Com GP", value: valWithGP, color: indDetails.colorRange[1] }
    ];

    // Escalas
    const xScale = d3.scaleBand()
        .domain(data.map(d => d.scenario))
        .range([0, chartWidth])
        .padding(0.4);

    // Eixo Y ajustado para incluir o zero
    const maxVal = d3.max(data, d => Math.abs(d.value)) || 1.0;
    const yScale = d3.scaleLinear()
        .domain(d3.min(data, d => d.value) < 0 ? [d3.min(data, d => d.value) * 1.2, maxVal * 1.2] : [0, maxVal * 1.2])
        .nice()
        .range([chartHeight, 0]);

    // Grelha
    g.append("g")
        .attr("class", "grid")
        .selectAll("line")
        .data(yScale.ticks(4))
        .enter()
        .append("line")
        .attr("class", "grid-line")
        .attr("x1", 0)
        .attr("x2", chartWidth)
        .attr("y1", d => yScale(d))
        .attr("y2", d => yScale(d));

    // Eixos
    g.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .attr("class", "axis-label");

    g.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).ticks(4))
        .selectAll("text")
        .attr("class", "axis-label");

    // Linha do Zero (se aplicável)
    if (yScale.domain()[0] < 0) {
        g.append("line")
            .attr("x1", 0)
            .attr("x2", chartWidth)
            .attr("y1", yScale(0))
            .attr("y2", yScale(0))
            .attr("stroke", "rgba(255,255,255,0.3)")
            .attr("stroke-width", 1.5);
    }

    // Desenha Barras
    g.selectAll(".bar")
        .data(data)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d.scenario))
        .attr("y", d => d.value >= 0 ? yScale(d.value) : yScale(0))
        .attr("width", xScale.bandwidth())
        .attr("height", d => Math.abs(yScale(d.value) - yScale(0)))
        .attr("fill", d => d.color)
        .attr("rx", 4)
        .style("cursor", "pointer")
        .on("mouseover", (event, d) => {
            const tooltip = d3.select("#map-tooltip");
            let content = isForecast
                ? `<div class="tooltip-title"><span>🔮 ${d.scenario}</span><span style="font-size:0.75rem;color:var(--text-muted)">Projeção ${yearStr}</span></div>`
                : `<div class="tooltip-title"><span>📊 ${d.scenario}</span><span style="font-size:0.75rem;color:var(--text-muted)">Média Histórica</span></div>`;
            
            content += `<div class="tooltip-row"><span class="tooltip-key">${indDetails.name}</span><span class="tooltip-val">${d.value > 0 ? '+' : ''}${d.value.toFixed(2)}%</span></div>`;
            
            if (d.scenario.includes("Com GP")) {
                const isNegativeGood = (ind === "Inflation");
                let liftSymbol = netImpact > 0 ? "+" : "";
                let liftClass = (netImpact > 0) !== isNegativeGood ? "neon-text-green" : "neon-text-green-negative";
                if (ind === "Inflation") {
                    liftClass = netImpact < 0 ? "neon-text-green" : "neon-text-green-negative";
                }
                
                let liftStr = `${liftSymbol}${netImpact.toFixed(2)}%`;
                content += `<div class="tooltip-row" style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08)">` +
                           `<span class="tooltip-key">${isForecast ? 'Impacto Neto F1' : 'Diferença Média'}</span>` +
                           `<span class="tooltip-val ${liftClass}" style="text-shadow:none;">${liftStr}</span></div>`;
            } else {
                content += `<div class="tooltip-badge badge-nongp">${isForecast ? 'Cenário Base (Sem GP)' : 'Média de Anos Comuns'}</div>`;
            }
            
            tooltip.html(content)
                .style("opacity", 1)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 15) + "px");
        })
        .on("mousemove", (event) => {
            d3.select("#map-tooltip")
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 15) + "px");
        })
        .on("mouseleave", () => {
            d3.select("#map-tooltip").style("opacity", 0);
        });

    // Etiquetas numéricas acima das barras
    g.selectAll(".bar-label")
        .data(data)
        .enter()
        .append("text")
        .attr("class", "bar-label")
        .attr("x", d => xScale(d.scenario) + xScale.bandwidth() / 2)
        .attr("y", d => d.value >= 0 ? yScale(d.value) - 8 : yScale(d.value) + 14)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--text-primary)")
        .attr("font-size", "0.75rem")
        .attr("font-weight", "600")
        .text(d => `${d.value > 0 ? '+' : ''}${d.value.toFixed(2)}%`);
}

// 10. Painel de Conclusões / Key Findings (Data Story)
function drawKeyFindings() {
    if (!state.dataset) return;

    const countries = state.dataset.countries;
    const selectedCode = state.selectedCountry;
    const countryData = countries[selectedCode];
    const yearStr = String(state.currentYear);
    const prevYearStr = String(state.currentYear - 1);

    // Atualiza o título dinâmico da secção
    const titleEl = document.querySelector("#conclusions-section .card-title");
    if (titleEl && countryData) {
        titleEl.innerHTML = `<span>🏁 Perfil Macroeconómico: <span class="neon-text-red">${countryData.name}</span> em <span class="neon-text">${state.currentYear}</span></span>`;
    }

    if (!countryData) return;

    const indTourism = "Tourism_arrivals";
    const indGDP = "GDP_growth";
    const indFDI = "FDI";

    // Formatação de valores
    const formatTourism = (v) => {
        if (v === null || v === undefined) return "N/D";
        return v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v.toLocaleString('pt-PT');
    };

    const formatGDP = (v) => {
        if (v === null || v === undefined) return "N/D";
        return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
    };

    const formatFDI = (v) => {
        if (v === null || v === undefined) return "N/D";
        const sign = v < 0 ? '-' : '';
        const absV = Math.abs(v);
        if (absV >= 1e9) return `${sign}$${(absV/1e9).toFixed(2)}B`;
        if (absV >= 1e6) return `${sign}$${(absV/1e6).toFixed(1)}M`;
        return `${sign}$${absV.toLocaleString('pt-PT')}`;
    };

    // Card 1: Turismo Internacional
    const tourEl = document.getElementById("finding-tourism");
    if (tourEl) {
        const valEl = tourEl.querySelector(".finding-value");
        const subEl = tourEl.querySelector(".finding-sub");
        const labelEl = tourEl.querySelector(".finding-label");
        
        if (labelEl) labelEl.textContent = "Turismo Internacional";
        
        const val = countryData.indicators[indTourism][yearStr];
        valEl.textContent = formatTourism(val);
        valEl.className = "finding-value"; // manter neutro
        
        const prevVal = countryData.indicators[indTourism][prevYearStr];
        if (val !== undefined && val !== null && prevVal !== undefined && prevVal !== null && prevVal > 0) {
            const yoy = ((val - prevVal) / prevVal) * 100;
            const absYoY = Math.abs(yoy).toFixed(1);
            if (yoy > 0) {
                subEl.textContent = `Aumentou ${absYoY}% vs ano anterior`;
            } else if (yoy < 0) {
                subEl.textContent = `Diminuiu ${absYoY}% vs ano anterior`;
            } else {
                subEl.textContent = "Sem variação vs ano anterior";
            }
            subEl.className = `finding-sub ${yoy >= 0 ? "neon-text-green" : "neon-text-green-negative"}`;
        } else {
            subEl.textContent = "Sem variação YoY";
            subEl.className = "finding-sub";
        }
    }

    // Card 2: Crescimento do PIB
    const gdpEl = document.getElementById("finding-gdp");
    if (gdpEl) {
        const valEl = gdpEl.querySelector(".finding-value");
        const subEl = gdpEl.querySelector(".finding-sub");
        const labelEl = gdpEl.querySelector(".finding-label");
        
        if (labelEl) labelEl.textContent = "Crescimento do PIB";
        
        const val = countryData.indicators[indGDP][yearStr];
        valEl.textContent = formatGDP(val);
        
        if (val !== undefined && val !== null) {
            valEl.className = `finding-value ${val >= 0 ? "neon-text-green" : "neon-text-green-negative"}`;
            subEl.textContent = "Taxa de crescimento anual";
            subEl.className = "finding-sub";
        } else {
            valEl.className = "finding-value";
            subEl.textContent = "N/D";
            subEl.className = "finding-sub";
        }
    }

    // Card 3: Investimento Estrangeiro (FDI)
    const fdiEl = document.getElementById("finding-premium"); // Reaproveitando este card
    if (fdiEl) {
        const valEl = fdiEl.querySelector(".finding-value");
        const subEl = fdiEl.querySelector(".finding-sub");
        const labelEl = fdiEl.querySelector(".finding-label");
        const iconEl = fdiEl.querySelector(".finding-icon");
        
        if (iconEl) iconEl.textContent = "💰";
        if (labelEl) labelEl.textContent = "Investimento Estrangeiro (FDI)";
        
        const val = countryData.indicators[indFDI][yearStr];
        valEl.textContent = formatFDI(val);
        valEl.className = "finding-value";
        
        const prevVal = countryData.indicators[indFDI][prevYearStr];
        if (val !== undefined && val !== null && prevVal !== undefined && prevVal !== null && prevVal !== 0) {
            const yoy = ((val - prevVal) / Math.abs(prevVal)) * 100;
            const absYoY = Math.abs(yoy).toFixed(1);
            if (yoy > 0) {
                subEl.textContent = `Aumentou ${absYoY}% vs ano anterior`;
            } else if (yoy < 0) {
                subEl.textContent = `Diminuiu ${absYoY}% vs ano anterior`;
            } else {
                subEl.textContent = "Sem variação vs ano anterior";
            }
            subEl.className = `finding-sub ${yoy >= 0 ? "neon-text-green" : "neon-text-green-negative"}`;
        } else {
            subEl.textContent = "Sem variação YoY";
            subEl.className = "finding-sub";
        }
    }

    // Card 4: Calendário F1
    const hostEl = document.getElementById("finding-selected-country");
    if (hostEl) {
        const valEl = hostEl.querySelector(".finding-value");
        const subEl = hostEl.querySelector(".finding-sub");
        const labelEl = hostEl.querySelector(".finding-label");
        const iconEl = hostEl.querySelector(".finding-icon");
        
        if (labelEl) labelEl.textContent = "Estado da Fórmula 1";
        
        const isHost = countryData.gps.includes(state.currentYear);
        if (isHost) {
            if (iconEl) iconEl.textContent = "🏎️";
            valEl.textContent = "Anfitrião";
            valEl.className = "finding-value neon-text-red";
            subEl.textContent = `Acolheu GP de F1 em ${state.currentYear}`;
            subEl.className = "finding-sub";
        } else {
            if (iconEl) iconEl.textContent = "🏁";
            valEl.textContent = "Sem GP";
            valEl.className = "finding-value";
            subEl.textContent = `Nenhum GP realizado em ${state.currentYear}`;
            subEl.className = "finding-sub";
        }
    }
}

// 11. Data Story / Presentation Mode Configurations
const STORY_SLIDES = [
    {
        title: "1. Introdução: O Impacto Macroeconómico da F1",
        indicator: "GDP_growth",
        country: "PRT",
        year: 2024,
        tab: "real",
        text: `O debate sobre os retornos económicos de acolher a Fórmula 1 é longo. Este painel estuda se o elevado custo de licenciamento (estimado entre <strong>$20M e $57M por ano</strong>) se traduz em crescimento económico real.
        <br><br>
        Os nossos modelos baseados em regressão linear de efeito fixo estimam um impacto líquido médio marginal de <strong>-1.10 pp</strong> no crescimento do PIB nos anos em que os países acolhem o Grande Prémio (ciclo macroeconómico global dominante). No entanto, estes ganhos estão distribuídos de forma muito desigual entre circuitos europeus tradicionais e novos destinos.`
    },
    {
        title: "2. Turismo: O Caso de Portugal e a Grande Visibilidade",
        indicator: "Tourism_arrivals",
        country: "PRT",
        year: 1996,
        tab: "real",
        text: `Portugal organizou o GP no Estoril até 1996 e regressou brevemente em Portimão (2020-2021). A atração de turistas estrangeiros é um dos argumentos mais fortes para o financiamento público.
        <br><br>
        Se olharmos para 1996, Portugal registava cerca de <strong>9.7M de chegadas de turistas</strong>. O impacto local da F1 é significativo a curto prazo, mas os nossos modelos revelam que, ao nível macroeconómico nacional, o impacto líquido no turismo anual dilui-se no ruído estatístico geral do país.`
    },
    {
        title: "3. O Fenómeno dos 'GP Premium' e Soft Power",
        indicator: "GDP_growth",
        country: "AZE",
        year: 2021,
        tab: "real",
        text: `Os <strong>'GP Premium'</strong> referem-se a países como a Arábia Saudita, Qatar, Azerbaijão, Bahrein e Emirados Árabes Unidos (Abu Dhabi), que pagam taxas de licenciamento astronómicas (<strong>$40M a $57M</strong> por ano). Estes eventos são fortemente subsidiados para alavancar a visibilidade global.
        <br><br>
        Para o <strong>Azerbaijão</strong> (Baku), o GP funciona como um motor de branding nacional pós-petróleo. Embora a F1 impulsione a visibilidade internacional, as nossas estimativas sugerem um impacto líquido estrutural marginal de <strong>-0.47 pp</strong> no crescimento do PIB sob o modelo de Ridge, indicando que os elevados custos fiscais diluem o retorno económico agregado direto, justificando o evento principalmente por via de <em>soft power</em> e prestígio geopolítico.`
    },
    {
        title: "4. Investimento Estrangeiro Direto (FDI)",
        indicator: "FDI",
        country: "SGP",
        year: 2019,
        tab: "real",
        text: `Singapura (SGP) representa o exemplo perfeito de integração da F1 na atração de capital global. A corrida noturna de Marina Bay serve de montra para o hub financeiro.
        <br><br>
        Em 2019, o FDI de Singapura atingiu a marca recorde de <strong>$119.8B</strong>. Embora a F1 não seja a única responsável, ela serve como a plataforma de networking corporativo premium por excelência, ajudando a cimentar o país como polo de atração de capitais internacionais.`
    },
    {
        title: "5. O Veredicto do Simulador para Portugal (2026/27)",
        indicator: "Tourism_arrivals",
        country: "PRT",
        year: 2026,
        tab: "forecast",
        model: "ridge",
        text: `Faz sentido Portugal tentar recuperar a F1 para 2026 ou 2027?
        <br><br>
        O nosso simulador preditivo estima um <strong>Ganho Económico de Turismo</strong> de <strong>+$999M</strong> baseando-se num acréscimo líquido de <strong>+3.32%</strong> em chegadas (+666 mil turistas) sobre uma base de 20.1M de turistas, contra uma taxa de licença de $22M. Isto representa um ROI altamente positivo para o setor turístico local.
        <br><br>
        Contudo, se alternar o seletor para <strong>PIB Real</strong> verá que o impacto direto é inconclusivo (-1.10 pp) devido à volatilidade das contas públicas e infraestruturas, confirmando que o evento se justifica principalmente pela ótica de visibilidade e turismo.`
    }
];

function goToSlide(index) {
    if (index < 0 || index >= STORY_SLIDES.length) return;
    state.currentSlide = index;

    const slide = STORY_SLIDES[index];

    // Reconfigura o estado global de acordo com o slide
    state.currentIndicator = slide.indicator;
    state.selectedCountry = slide.country;
    state.currentYear = slide.year;

    // Configura a aba do simulador/previsor
    if (slide.tab) {
        state.predictorTab = slide.tab;
        const tabForecast = document.getElementById("tab-forecast");
        const tabReal = document.getElementById("tab-real-impact");
        if (tabForecast && tabReal) {
            if (slide.tab === "forecast") {
                tabForecast.classList.add("active");
                tabReal.classList.remove("active");
            } else {
                tabReal.classList.add("active");
                tabForecast.classList.remove("active");
            }
        }
    }

    // Configura o ano de previsão se for ano de previsão
    if (slide.year === 2026 || slide.year === 2027) {
        state.forecastYear = String(slide.year);
        const btn2026 = document.getElementById("btn-2026");
        const btn2027 = document.getElementById("btn-2027");
        if (btn2026 && btn2027) {
            if (slide.year === 2026) {
                btn2026.classList.add("active");
                btn2027.classList.remove("active");
            } else {
                btn2027.classList.add("active");
                btn2026.classList.remove("active");
            }
        }
    }

    // Configura o modelo preditivo se especificado pelo slide
    if (slide.model) {
        state.selectedModel = slide.model;
        const modelSelect = document.getElementById("predictor-model-select");
        if (modelSelect) modelSelect.value = slide.model;
    } else {
        state.selectedModel = "ridge";
        const modelSelect = document.getElementById("predictor-model-select");
        if (modelSelect) modelSelect.value = "ridge";
    }

    // Atualiza seletores visuais na UI
    const indSelect = document.getElementById("indicator-select");
    if (indSelect) indSelect.value = slide.indicator;

    const countrySelect = document.getElementById("predictor-country-select");
    if (countrySelect) countrySelect.value = slide.country;

    const yearSlider = document.getElementById("year-slider");
    if (yearSlider) {
        yearSlider.value = slide.year;
        document.getElementById("year-label").innerText = slide.year;
    }

    // Sincroniza nomes de país exibidos nos cards
    const countryName = state.dataset.countries[slide.country]?.name || slide.country;
    document.getElementById("selected-country-name").innerText = countryName;
    document.getElementById("predictor-country-name").innerText = countryName;

    // Atualiza o texto do slide
    const slideTextEl = document.getElementById("active-slide-text");
    if (slideTextEl) {
        slideTextEl.innerHTML = `
            <h3 style="font-family: var(--font-heading); font-size: 1.15rem; font-weight: 700; margin-bottom: 12px; color: var(--f1-red);">${slide.title}</h3>
            <div style="font-size: 0.88rem; line-height: 1.6; color: var(--text-secondary);">${slide.text}</div>
        `;
    }

    // Atualiza os indicadores de bolinhas (dots)
    const dotsContainer = document.getElementById("slide-indicators-dots");
    if (dotsContainer) {
        dotsContainer.innerHTML = "";
        STORY_SLIDES.forEach((_, i) => {
            const dot = document.createElement("span");
            dot.style.width = "8px";
            dot.style.height = "8px";
            dot.style.borderRadius = "50%";
            dot.style.background = i === index ? "var(--f1-red)" : "rgba(255,255,255,0.2)";
            dot.style.cursor = "pointer";
            dot.style.transition = "background 0.2s";
            dot.addEventListener("click", () => goToSlide(i));
            dotsContainer.appendChild(dot);
        });
    }

    // Configura botões anterior/seguinte
    const prevBtn = document.getElementById("prev-slide-btn");
    const nextBtn = document.getElementById("next-slide-btn");
    
    if (prevBtn) prevBtn.disabled = index === 0;
    
    if (nextBtn) {
        if (index === STORY_SLIDES.length - 1) {
            nextBtn.textContent = "Concluir 🏁";
            nextBtn.onclick = () => {
                setMode("dashboard");
            };
        } else {
            nextBtn.textContent = "Seg. ▶";
            nextBtn.onclick = () => {
                goToSlide(state.currentSlide + 1);
            };
        }
    }

    // Atualiza as visualizações e detalhes do indicador
    updateIndicatorDetails();
    updateAll();
}

function setMode(mode) {
    const btnDashboard = document.getElementById("mode-dashboard");
    const btnStory = document.getElementById("mode-story");
    const controlPanel = document.getElementById("control-panel-section");
    const storyPanel = document.getElementById("data-story-panel");

    if (mode === "story") {
        btnStory.classList.add("active");
        btnDashboard.classList.remove("active");
        controlPanel.style.display = "none";
        storyPanel.style.display = "flex";
        goToSlide(0);
    } else {
        btnDashboard.classList.add("active");
        btnStory.classList.remove("active");
        storyPanel.style.display = "none";
        controlPanel.style.display = "flex";
        
        // Restaurar estado padrão de exploração interativa
        state.currentIndicator = "GDP_growth";
        state.selectedCountry = "PRT";
        state.currentYear = 2024;
        state.showRelativeDiff = false;
        
        const relativeToggle = document.getElementById("toggle-relative-diff");
        if (relativeToggle) {
            relativeToggle.checked = false;
        }
        
        const globalToggle = document.getElementById("toggle-global-trend");
        if (globalToggle) {
            globalToggle.disabled = false;
            globalToggle.checked = true;
            globalToggle.parentElement.style.opacity = "1";
            state.showGlobalTrend = true;
        }
        
        const indSelect = document.getElementById("indicator-select");
        if (indSelect) indSelect.value = "GDP_growth";
        
        const countrySelect = document.getElementById("predictor-country-select");
        if (countrySelect) countrySelect.value = "PRT";
        
        const yearSlider = document.getElementById("year-slider");
        if (yearSlider) {
            yearSlider.value = 2024;
            document.getElementById("year-label").innerText = 2024;
        }
        
        document.getElementById("selected-country-name").innerText = "Portugal";
        document.getElementById("predictor-country-name").innerText = "Portugal";
        
        updateIndicatorDetails();
        updateAll();
    }
}

function initModeToggles() {
    const btnDashboard = document.getElementById("mode-dashboard");
    const btnStory = document.getElementById("mode-story");

    if (btnDashboard && btnStory) {
        btnDashboard.addEventListener("click", () => setMode("dashboard"));
        btnStory.addEventListener("click", () => setMode("story"));
    }

    // Configura botões anterior
    const prevBtn = document.getElementById("prev-slide-btn");
    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            if (state.currentSlide > 0) {
                goToSlide(state.currentSlide - 1);
            }
        });
    }
}
