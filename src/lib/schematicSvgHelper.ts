// ============================================================================
// PARVUS AUTOMATE - CYBERNETIC SCHEMATIC SVG BLUEPRINT GENERATOR
// Gera diagramas esquemáticos com fidelidade visual estilo blueprint industrial
// ============================================================================

export function renderCyberSchematicSvg(project: any): string {
  const placa = (project?.placa || 'ESP32 WROOM-32').toUpperCase();
  const titulo = (project?.titulo || 'Projeto IoT').toUpperCase();
  const componentes = project?.componentes || [];
  const conexoes = project?.esquema_ligacao?.conexoes || [];

  // Se o projeto já tiver um SVG válido retornado pela IA, e ele tiver tags <svg>, usamos ele
  if (project?.esquema_ligacao?.pinout_svg && typeof project.esquema_ligacao.pinout_svg === 'string') {
    let rawSvg = project.esquema_ligacao.pinout_svg.trim();
    rawSvg = rawSvg.replace(/^```(?:xml|svg|html)?\s*/i, '').replace(/\s*```$/i, '').trim();
    if (rawSvg.startsWith('<svg') && rawSvg.endsWith('</svg>') && rawSvg.length > 200) {
      return rawSvg;
    }
  }

  // Gera o blueprint procedural de alta qualidade
  const isScale = (titulo + JSON.stringify(componentes)).toLowerCase().includes('balan') || 
                  (titulo + JSON.stringify(componentes)).toLowerCase().includes('hx711') ||
                  (titulo + JSON.stringify(componentes)).toLowerCase().includes('peso');

  const compsToRender = componentes && componentes.length > 0 ? componentes : (
    isScale ? [
      { nome: 'Módulo Conversor ADC HX711 24-bit', especificacao: 'ADC diferencial ganho 128', pino_sugerido: 'GPIO 19 (DT) e GPIO 18 (SCK)' },
      { nome: 'Célula de Carga Strain Gauge 5kg', especificacao: 'Ponte de Wheatstone 4 fios', pino_sugerido: 'Bornes E+/E-/A+/A-' },
      { nome: 'Botão de Tara (Pushbutton)', especificacao: 'Chave táctil com pull-up', pino_sugerido: 'GPIO 4' },
      { nome: 'Buzzer Alerta Sobrecarga', especificacao: 'Alarme piezoelétrico 3.3V', pino_sugerido: 'GPIO 15' },
      { nome: 'LED Indicador Estabilidade', especificacao: 'LED verde difuso com resistor 330Ω', pino_sugerido: 'GPIO 2' }
    ] : [
      { nome: 'Sensor Principal', especificacao: 'Módulo de medição de campo', pino_sugerido: 'GPIO 4' },
      { nome: 'Atuador / Relé', especificacao: 'Módulo de potência isolado', pino_sugerido: 'GPIO 18' }
    ]
  );

  const componentBoxes = compsToRender.slice(0, 5).map((comp: any, idx: number) => {
    const yPos = 100 + idx * 95;
    const pino = comp.pino_sugerido || `Pino ${idx + 1}`;
    const nome = comp.nome || `Módulo ${idx + 1}`;
    
    return `
      <!-- Componente ${idx + 1}: ${nome} -->
      <g transform="translate(620, ${yPos})">
        <rect width="330" height="75" rx="8" fill="#0d111a" stroke="#00d4ff" stroke-width="1.5" stroke-dasharray="none" filter="url(#glow-soft)" />
        <rect x="0" y="0" width="330" height="22" rx="8" fill="rgba(0, 212, 255, 0.15)" />
        <text x="12" y="15" fill="#00d4ff" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="bold">MOD-0${idx + 1}: ${nome.substring(0, 32)}</text>
        <text x="12" y="42" fill="#e2e8f0" font-family="'JetBrains Mono', monospace" font-size="10">Espec: ${String(comp.especificacao || '').substring(0, 42)}</text>
        <text x="12" y="62" fill="#00ff88" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="bold">PINO: ${pino}</text>
        <!-- Portas de Conexão -->
        <circle cx="0" cy="37" r="5" fill="#00ff88" stroke="#050811" stroke-width="2" />
        <circle cx="330" cy="37" r="4" fill="#38bdf8" />
      </g>
    `;
  }).join('\n');

  // Traçados das trilhas de sinal (Wiring traces)
  const traces = componentes.slice(0, 5).map((_: any, idx: number) => {
    const startY = 180 + idx * 45;
    const endY = 137 + idx * 95;
    const color = idx === 0 ? '#ef4444' : idx === 1 ? '#00d4ff' : idx === 2 ? '#00ff88' : idx === 3 ? '#ffaa00' : '#a855f7';
    
    return `
      <path d="M 370 ${startY} L 480 ${startY} L 540 ${endY} L 620 ${endY}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85" />
      <circle cx="370" cy="${startY}" r="4" fill="${color}" />
      <circle cx="620" cy="${endY}" r="4" fill="${color}" />
    `;
  }).join('\n');

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 640" width="100%" height="100%" style="background: #06080e; font-family: 'JetBrains Mono', monospace;">
  <defs>
    <!-- Filtro de Brilho Cyberpunk -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="glow-soft" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="1.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <!-- Grid Pattern de Fundo -->
    <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
      <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(0, 212, 255, 0.05)" stroke-width="1" />
    </pattern>
  </defs>

  <!-- Fundo com Grid Cibernético -->
  <rect width="1000" height="640" fill="#06080e" />
  <rect width="1000" height="640" fill="url(#grid)" />

  <!-- Cabeçalho Técnico do Blueprint -->
  <rect x="30" y="20" width="940" height="50" rx="8" fill="#0a0e1a" stroke="rgba(0, 212, 255, 0.25)" stroke-width="1" />
  <text x="50" y="45" fill="#00d4ff" font-size="14" font-weight="bold" letter-spacing="1">ESQUEMA TÉCNICO ELETRÔNICO: ${titulo}</text>
  <text x="50" y="60" fill="#64748b" font-size="10">PADRÃO: ENGENHARIA INDUSTRIAL PARVUS | TENSÃO NÓ: 3.3V / 5.0V | BUS: I2C/SPI/GPIO</text>
  <rect x="820" y="32" width="130" height="26" rx="6" fill="rgba(0, 255, 136, 0.1)" stroke="#00ff88" stroke-width="1" />
  <text x="885" y="49" fill="#00ff88" font-size="10" font-weight="bold" text-anchor="middle">HARDWARE ATIVO</text>

  <!-- BLOCO PRINCIPAL: MICROCONTROLADOR (Ex: ESP32) -->
  <g transform="translate(50, 100)">
    <!-- Chassis do Microcontrolador -->
    <rect width="320" height="490" rx="12" fill="#0a0d18" stroke="#00d4ff" stroke-width="2" filter="url(#glow)" />
    <rect x="0" y="0" width="320" height="35" rx="12" fill="rgba(0, 212, 255, 0.2)" />
    <text x="160" y="23" fill="#ffffff" font-size="13" font-weight="bold" text-anchor="middle" letter-spacing="1">${placa}</text>

    <!-- SoC Chip Core -->
    <rect x="60" y="55" width="200" height="70" rx="6" fill="#111625" stroke="#334155" stroke-width="1" />
    <text x="160" y="85" fill="#38bdf8" font-size="11" font-weight="bold" text-anchor="middle">ESP-WROOM-32 MCU</text>
    <text x="160" y="102" fill="#94a3b8" font-size="9" text-anchor="middle">Xtensa Dual-Core 240MHz</text>
    <text x="160" y="115" fill="#00ff88" font-size="8" text-anchor="middle">Wi-Fi 802.11 b/g/n + BLE 4.2</text>

    <!-- Headers e Pinos Laterais -->
    <!-- Coluna Esquerda de Pinos (Alimentação e GND) -->
    <g transform="translate(15, 140)">
      <rect width="90" height="22" rx="4" fill="#1e293b" />
      <text x="45" y="15" fill="#ef4444" font-size="10" font-weight="bold" text-anchor="middle">3V3 (VCC)</text>
      
      <rect y="30" width="90" height="22" rx="4" fill="#1e293b" />
      <text x="45" y="45" fill="#94a3b8" font-size="10" font-weight="bold" text-anchor="middle">GND (TERRA)</text>

      <rect y="60" width="90" height="22" rx="4" fill="#1e293b" />
      <text x="45" y="75" fill="#ef4444" font-size="10" font-weight="bold" text-anchor="middle">VIN (5V USB)</text>

      <rect y="90" width="90" height="22" rx="4" fill="#1e293b" />
      <text x="45" y="105" fill="#cbd5e1" font-size="9" text-anchor="middle">EN / RST</text>
    </g>

    <!-- Coluna Direita de Pinos (GPIO e Sinais) -->
    <g transform="translate(215, 140)">
      <rect width="90" height="22" rx="4" fill="#1e293b" stroke="#00ff88" stroke-width="1" />
      <text x="45" y="15" fill="#00ff88" font-size="10" font-weight="bold" text-anchor="middle">${isScale ? 'GPIO 19 DT' : 'GPIO 4'}</text>

      <rect y="30" width="90" height="22" rx="4" fill="#1e293b" stroke="#00d4ff" stroke-width="1" />
      <text x="45" y="45" fill="#00d4ff" font-size="10" font-weight="bold" text-anchor="middle">${isScale ? 'GPIO 18 SCK' : 'GPIO 21 SDA'}</text>

      <rect y="60" width="90" height="22" rx="4" fill="#1e293b" stroke="#fbbf24" stroke-width="1" />
      <text x="45" y="75" fill="#fbbf24" font-size="10" font-weight="bold" text-anchor="middle">${isScale ? 'GPIO 4 TARE' : 'GPIO 22 SCL'}</text>

      <rect y="90" width="90" height="22" rx="4" fill="#1e293b" stroke="#c084fc" stroke-width="1" />
      <text x="45" y="105" fill="#c084fc" font-size="10" font-weight="bold" text-anchor="middle">${isScale ? 'GPIO 15 BUZ' : 'GPIO 2 LED'}</text>

      <rect y="120" width="90" height="22" rx="4" fill="#1e293b" stroke="#f43f5e" stroke-width="1" />
      <text x="45" y="135" fill="#f43f5e" font-size="10" font-weight="bold" text-anchor="middle">${isScale ? 'GPIO 2 LED' : 'GPIO 15'}</text>
    </g>

    <!-- Indicador de Status Onboard -->
    <circle cx="160" cy="380" r="10" fill="#00ff88" filter="url(#glow)" />
    <text x="160" y="410" fill="#00ff88" font-size="9" font-weight="bold" text-anchor="middle">STATUS: FIRMWARE OK</text>
    <text x="160" y="425" fill="#64748b" font-size="8" text-anchor="middle">Watchdog Timer Ativo</text>
  </g>

  <!-- TRILHAS DE FIAÇÃO (TRACES) -->
  <g>
    ${traces}
  </g>

  <!-- CAIXAS DOS COMPONENTES PERIFÉRICOS -->
  <g>
    ${componentBoxes}
  </g>

  <!-- LEGENDA TÉCNICA INFERIOR -->
  <g transform="translate(50, 600)">
    <text x="0" y="18" fill="#64748b" font-size="10">LEGENDA CABEAMENTO:</text>
    <circle cx="130" cy="14" r="4" fill="#ef4444" />
    <text x="140" y="18" fill="#cbd5e1" font-size="9">VCC (+3.3V/5V)</text>
    <circle cx="240" cy="14" r="4" fill="#94a3b8" />
    <text x="250" y="18" fill="#cbd5e1" font-size="9">GND (Terra)</text>
    <circle cx="340" cy="14" r="4" fill="#00ff88" />
    <text x="350" y="18" fill="#cbd5e1" font-size="9">Dados / DOUT (DT)</text>
    <circle cx="470" cy="14" r="4" fill="#00d4ff" />
    <text x="480" y="18" fill="#cbd5e1" font-size="9">Clock / SCK</text>
    <circle cx="580" cy="14" r="4" fill="#fbbf24" />
    <text x="590" y="18" fill="#cbd5e1" font-size="9">Acionamento Digital / Tara</text>
  </g>
</svg>
  `.trim();
}
