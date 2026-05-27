# F1 & Macroeconomia: Análise de Impacto e Correlação

Este projeto é um painel interativo e narrativo desenvolvido para a unidade curricular de **Sistemas de Visualização de Dados de Computador (SVDC)** na **Universidade do Minho (UMinho)**. O objetivo é explorar as correlações históricas (1960–2024) entre o acolhimento de Grandes Prémios (GP) de Fórmula 1 e o comportamento macroeconómico dos países anfitriões, oferecendo ainda projeções preditivas para os anos de 2026/2027.

---

## 📊 Datasets Utilizados e Fontes

O dashboard consolida dados de três fontes principais, processados através de um pipeline ETL em Python:

1. **Dados Macroeconómicos (1960–2024)**:
   * **Fonte**: [World Bank Data API (Banco Mundial)](https://data.worldbank.org/)
   * **Unidades/Indicadores**:
     * **Crescimento do PIB Real** (`NY.GDP.MKTP.KD.ZG`): Variação percentual anual.
     * **Turismo Internacional (Chegadas)** (`ST.INT.ARVL`): Número absoluto de entradas de turistas.
     * **Investimento Direto Estrangeiro (FDI/IDE)** (`BX.KLT.DINV.CD.WD`): Fluxos líquidos de entrada em USD correntes.
     * **PIB per Capita** (`NY.GDP.PCAP.KD`): Em USD constantes de 2015.
     * **Taxa de Inflação** (`FP.CPI.TOTL.ZG`): Índice de Preços ao Consumidor (IPC) anual %.
     * **Taxa de Desemprego** (`SL.UEM.TOTL.ZS`): Percentagem da força de trabalho.
     * **Comércio (% do PIB)** (`NE.TRD.GNFS.ZS`): Soma das exportações e importações.

2. **Dados Históricos de Fórmula 1 (1950–2024)**:
   * **Fonte**: [Ergast Motor Racing Developer API](https://ergast.com/mrd/) e base de dados Kaggle.
   * **Métricas**: Localização dos circuitos, países organizadores e anos dos Grandes Prémios correspondentes a 34 nações anfitriãs.

3. **Custos de Licenciamento de Grandes Prémios (Hosting Fees)**:
   * **Fonte**: [RacingNews365](https://racingnews365.com/) & [Formula Money](http://formulamoney.com/) (estimativas médias da era moderna).
   * **Métricas**: Custo anual estimado da taxa de licença paga à FOM (Formula One Management), variando de **$20M a $57M** por ano.

---

## 🏎️ A História que Mostramos (Narrativa do Story Mode)

O "Modo História" (Data Story) é desenhado para defender a seguinte tese académica e analítica:

> **"O acolhimento de um GP de Fórmula 1 não gera um retorno financeiro (ROI) imediato ou direto no PIB no ano da corrida, mas funciona como um catalisador estratégico de longo prazo: acumula capital turístico, atrai Investimento Direto Estrangeiro (FDI) estrutural e serve de plataforma para diplomacia corporativa e Soft Power global."**

### Roteiro dos Slides Narrativos:
1. **A Pergunta de $57 Milhões**: O dilema do custo das taxas de licença em relação ao impacto económico agregado.
2. **O Retorno Direto (Turismo)**: O caso do Reino Unido (Silverstone) mostrando o impacto visível, mas focado no setor de serviços local, diluído nos agregados nacionais.
3. **O Custo Fiscal (Retorno Negativo)**: O exemplo de Marrocos (1958/1983) provando que organizar corridas sem estabilidade macroeconómica ou infraestruturas adequadas gera retornos macroeconómicos negativos.
4. **O Soft Power de Baku**: O caso do Azerbaijão onde a F1 é uma montra geopolítica deliberada e de diplomacia corporativa, onde o ROI tradicional é secundário ao posicionamento de marca-país.
5. **O Caso de Portugal (FDI e AutoEuropa)**: A era do Estoril (1984–1996) e Portimão (2020–2021) demonstrando como a F1 serviu de plataforma de *networking B2B*, alinhando-se com marcos históricos como a instalação da AutoEuropa em Palmela (1991).
6. **O Veredicto pelos Dados**: Conclusão empírica baseada nas **889 observações** país-ano da base de dados. Demonstra que enquanto o PIB sofre uma contração média temporária no ano de GP (investimentos públicos elevados de curto prazo), o turismo cresce a um ritmo anual de **+8.2% vs. +6.9%** (um ganho estrutural de **+1.33 pp**), e o FDI médio escala substancialmente nas décadas seguintes (ex: Singapura com FDI médio de **$77.6B nos anos de F1 vs. $40.8B nos anos comuns**).

---

## 🛠️ Tecnologias Utilizadas

O projeto adota uma arquitetura limpa de alto desempenho visual:

* **Frontend**:
  * **HTML5 Semântico**: Estrutura robusta otimizada para legibilidade.
  * **CSS3 Customizado**: Folha de estilos vanilla aplicando conceitos modernos de design de interfaces (Dark Mode, Glassmorphism, Neon Typography, CSS Grid e Flexbox responsivo).
  * **JavaScript (ES6+)**: Programação assíncrona orientada a objetos para controlo de estados, transições e renderização dinâmica.
  * **D3.js (v7)**: Manipulação avançada do DOM para desenhos SVG vetoriais, projeções cartográficas e gráficos dinâmicos de alta interatividade.

* **Backend / ETL & Modelos de Projeção**:
  * **Python 3**: Scripts de ETL (`etl.py`) para recolha de dados via APIs, limpeza de valores ausentes, fusão e interpolação.
  * **Algoritmos de Machine Learning**: Modelos de regressão preditiva (**XGBoost**, **Random Forest** e **Ridge Regression**) aplicados localmente em Python para calcular cenários económicos preditivos de 2026 e 2027 com base em históricos e tendências mundiais.

---

## 🚀 Funcionalidades (Features)

* **Mapa Coroplético Interativo (D3 SVG)**:
  * Projeção cartográfica mundial destacando os 34 países anfitriões.
  * *Choropleth* dinâmico que altera as cores dos países de acordo com a magnitude do indicador selecionado no ano corrente.
  * Sistema de Zoom inteligente (`centerMapOnCountry`) com transições e suavização cúbica (`easeCubicInOut`), que foca no país alvo e mantém o alinhamento espacial ao navegar na história.
* **Modo Dashboard Interativo**:
  * Seleção livre de indicadores e países.
  * Slider temporal interativo para animação ano a ano.
  * Alternador de exibição para **Desvio vs. Média Global** (mostrando a diferença líquida de performance face à média de todos os países F1) ou valores absolutos.
* **Painel de Evolução Temporal (Line Chart)**:
  * Gráfico de linha que exibe a trajetória histórica do país.
  * Bandas de Anomalia Económica Global integradas em segundo plano para contextualizar crises externas (Crise de 2008 e COVID-19).
  * Linhas dinâmicas comparando a curva nacional contra a média mundial dos países anfitriões.
  * Escalas e eixos dinâmicos com formatação abreviada inteligente (B, M, k, %, pp) no eixo Y para evitar sobreposição ou cortes de texto.
* **Módulo Preditor e Análise de Impacto (Bar Chart)**:
  * **Modo Simulação (2026/27)**: Permite simular o impacto de acolher ou não um GP em 2026/2027, exibindo os resultados gerados pelos modelos de ML (XGBoost, Random Forest, Ridge) com métricas de confiança ($R^2$ e MAE).
  * **Modo Impacto Real Histórico**: Retrospectiva robusta baseada em **medianas** estatísticas ao longo de toda a série histórica (eliminando distorções de anos atípicos e YoY voláteis) para provar o verdadeiro diferencial entre anos de corrida e anos normais.
  * **Painel de ROI Est. (Retorno do Investimento)**: Traduz o impacto percentual do indicador em dólares americanos estimados com base no PIB base do país e custos reais de licenciamento.

---

## 🚀 Como Executar o Projeto Localmente

Como a aplicação realiza o carregamento de ficheiros locais JSON (base de dados processada e coordenadas geográficas do mapa), o navegador necessita de ser servido através de um **servidor HTTP local** para cumprir as políticas de segurança CORS (não sendo recomendado abrir diretamente o ficheiro `index.html` via double-click).

Escolha uma das seguintes formas simples para executar o projeto:

### Opção A: Usando Python (Recomendado)
Se tiver o Python instalado no seu sistema, execute o seguinte comando na pasta raiz do projeto:
```bash
python -m http.server 8080
```
*(ou `python3 -m http.server 8080` em sistemas Linux/macOS)*.
Depois, abra o navegador e aceda a: **[http://localhost:8080](http://localhost:8080)**.

### Opção B: Usando Node.js / npm
Se utiliza o ecossistema de Node.js, pode rodar diretamente na pasta raiz:
```bash
npx live-server
```
*(o live-server abrirá automaticamente uma aba no navegador no endereço correto)*.
Alternativamente, pode usar o pacote `http-server`:
```bash
npm install -g http-server
http-server -p 8080
```

### Opção C: Extensão "Live Server" do VS Code
Se utiliza o **Visual Studio Code**:
1. Aceda ao separador de extensões e instale a extensão **Live Server** (desenvolvida por Ritwick Dey).
2. Abra a pasta deste projeto no VS Code.
3. Clique no botão **"Go Live"** que surgirá na barra de estado (no canto inferior direito do editor).

