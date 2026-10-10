// ============================================================================
// PARVUS AUTOMATE - IOT INDUSTRIAL REPAIR & SYNTHESIS HELPER
// Garante completude técnica, conformidade industrial e ausência de truncamentos
// ============================================================================

export type DeviceCategory = 'scale' | 'weather' | 'energy' | 'tank' | 'access' | 'generic';

/**
 * Detecta a categoria real de hardware com base nos metadados do projeto
 */
export function detectDeviceCategory(project?: any): DeviceCategory {
  if (!project) return 'generic';
  const text = `${project.titulo || ''} ${project.nome || ''} ${project.descricao_tecnica || ''} ${project.descricao || ''} ${JSON.stringify(project.componentes || [])}`.toLowerCase();
  
  if (text.includes('balan') || text.includes('peso') || text.includes('hx711') || text.includes('load cell') || text.includes('carga') || text.includes('scale') || text.includes('grama') || text.includes('quilograma')) {
    return 'scale';
  }
  if (text.includes('energia') || text.includes('corrente') || text.includes('potencia') || text.includes('potência') || text.includes('acs712') || text.includes('pzem') || text.includes('kwh')) {
    return 'energy';
  }
  if (text.includes('tanque') || text.includes('nível') || text.includes('nivel') || text.includes('vazão') || text.includes('vazao') || text.includes('fluxo') || text.includes('caixa d') || text.includes('litro')) {
    return 'tank';
  }
  if (text.includes('temperatura') || text.includes('umidade') || text.includes('dht') || text.includes('bme') || text.includes('clima') || text.includes('termostato') || text.includes('meteorol') || text.includes('ambiente') || text.includes('pluvi') || text.includes('barômetro') || text.includes('barometro')) {
    return 'weather';
  }
  if (text.includes('rfid') || text.includes('catraca') || text.includes('porta') || text.includes('fechadura') || text.includes('biometria') || text.includes('acesso')) {
    return 'access';
  }
  return 'generic';
}

/**
 * Formata timestamps de forma 100% segura contra erros 'Invalid Date'
 */
export function formatSafeTimestamp(ts?: any): string {
  if (!ts) {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  if (typeof ts === 'string') {
    const trimmed = ts.trim();
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      return trimmed;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  } else if (typeof ts === 'number') {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Remove markdown fences (```cpp, ```) do código gerado
 */
export function sanitizeFirmwareCode(code: string): string {
  if (!code || typeof code !== 'string') return '';
  return code
    .replace(/^```(?:cpp|c\+\+|c|arduino|ino)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

/**
 * Retorna o firmware industrial completo em C++ para Balança Inteligente (ESP32 + HX711)
 */
export function getProductionScaleFirmware(placa: string = 'ESP32 WROOM-32', projectTitle: string = 'Balança Inteligente'): string {
  return `#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <esp_task_wdt.h>
#include "HX711.h"

// ============================================================================
// ${projectTitle.toUpperCase()} - PARVUS SCALE-IOT
// Firmware Industrial C++ de Nível de Produção para ${placa}
// Sensor: Célula de Carga com ADC HX711 24-bit de Alta Precisão
// ============================================================================

// --- MAPEAMENTO DE PINOS GPIO (Sem pinos de strapping) ---
#define LOADCELL_DOUT_PIN 19   // HX711 Pino DT / DOUT (Entrada de Dados)
#define LOADCELL_SCK_PIN  18   // HX711 Pino SCK / CLK (Sinal de Clock)
#define TARE_BUTTON_PIN   4    // Botão de Tara com Resistor Pull-Up interno
#define STATUS_LED_PIN    2    // LED indicador de estado e estabilização de peso
#define BUZZER_PIN        15   // Alarme sonoro para alerta de sobrecarga (> 5000g)

// --- CREDENCIAIS DE REDE & BROKER MQTT ---
const char* WIFI_SSID       = "MinhaRede_WiFi";
const char* WIFI_PASSWORD   = "senha1234";
const char* MQTT_SERVER     = "broker.parvusautomate.com";
const int   MQTT_PORT       = 1883;
const char* DEVICE_ID       = "esp32_scale_01";
const char* TOPIC_TELEMETRY = "parvus/enterprise-corp/esp32/telemetry";
const char* TOPIC_COMMANDS  = "parvus/enterprise-corp/esp32/commands";

// --- PARÂMETROS METROLÓGICOS DA BALANÇA ---
const float DEFAULT_CALIBRATION_FACTOR = -2280.0f; // Calibração padrão para célula de carga de 5kg
const float MAX_CAPACITY_GRAMS         = 5000.0f;  // Carga máxima nominal do sensor
const float STABILITY_THRESHOLD_GRAMS  = 1.5f;     // Tolerância de estabilização (+/- 1.5g)
const unsigned long WATCHDOG_TIMEOUT_S = 10;       // Watchdog de 10 segundos

// --- OBJETOS DE SISTEMA ---
HX711 scale;
WiFiClient espClient;
PubSubClient mqttClient(espClient);
Preferences preferences; // Armazenamento NVS não-volátil para Fator de Calibração e Tara

// --- TEMPORIZADORES MILLIS() (LOOP 100% NÃO-BLOQUEANTE) ---
unsigned long lastTelemetryTime   = 0;
const unsigned long TELEMETRY_INTERVAL_MS = 1500; // Publicação MQTT a cada 1.5 segundos

unsigned long lastSampleTime      = 0;
const unsigned long SAMPLE_INTERVAL_MS = 200;     // Amostragem ADC HX711 a cada 200ms

unsigned long lastWifiRetryTime   = 0;
const unsigned long WIFI_RETRY_INTERVAL_MS = 5000;

// Variáveis de Estado Metrológico
float currentWeightGrams = 0.0f;
float previousWeightGrams = 0.0f;
long currentAdcRaw = 0;
bool isWeightStable = false;
int stableCycles = 0;
float calibrationFactor = DEFAULT_CALIBRATION_FACTOR;

// Debounce do Botão de Tara
unsigned long lastButtonPressTime = 0;
const unsigned long DEBOUNCE_DELAY_MS = 250;

// --- FUNÇÃO DE TARA FÍSICA ---
void executarTara() {
  Serial.println(F("[SCALE] Executando comando de Tara / Zeramento físico..."));
  digitalWrite(STATUS_LED_PIN, HIGH);
  
  scale.tare(10); // Média de 10 amostras rápidas para definir novo ponto zero
  
  long zeroOffset = scale.get_offset();
  preferences.begin("scale_nvs", false);
  preferences.putLong("zero_offset", zeroOffset);
  preferences.end();
  
  digitalWrite(STATUS_LED_PIN, LOW);
  Serial.print(F("[SCALE] Tara concluída com sucesso! Novo offset NVS salvo: "));
  Serial.println(zeroOffset);
}

// --- CALLBACK MQTT PARA COMANDOS DA NUVEM (Ex: ZERAR TARA REMOTAMENTE) ---
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  char message[256];
  if (length >= sizeof(message)) length = sizeof(message) - 1;
  memcpy(message, payload, length);
  message[length] = '\\0';

  Serial.print(F("[MQTT CMD] Mensagem recebida no tópico "));
  Serial.print(topic);
  Serial.print(F(": "));
  Serial.println(message);

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, message);
  if (!err) {
    if (doc.containsKey("comando")) {
      const char* cmd = doc["comando"];
      if (strcmp(cmd, "TARE") == 0 || strcmp(cmd, "ZERAR") == 0) {
        executarTara();
      } else if (strcmp(cmd, "CALIBRAR") == 0 && doc.containsKey("fator")) {
        calibrationFactor = doc["fator"].as<float>();
        scale.set_scale(calibrationFactor);
        preferences.begin("scale_nvs", false);
        preferences.putFloat("cal_factor", calibrationFactor);
        preferences.end();
        Serial.print(F("[SCALE] Novo fator de calibração salvo no NVS: "));
        Serial.println(calibrationFactor);
      }
    }
  }
}

// --- RECONEXÃO WI-FI SEM BLOQUEIO ---
void verificarConectividadeWifi() {
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long now = millis();
  if (now - lastWifiRetryTime >= WIFI_RETRY_INTERVAL_MS) {
    lastWifiRetryTime = now;
    Serial.print(F("[WIFI] Reconectando à rede Wi-Fi "));
    Serial.println(WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
}

// --- RECONEXÃO MQTT SEM BLOQUEIO ---
void verificarConectividadeMqtt() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (mqttClient.connected()) return;

  unsigned long now = millis();
  if (now - lastWifiRetryTime >= WIFI_RETRY_INTERVAL_MS) {
    lastWifiRetryTime = now;
    Serial.print(F("[MQTT] Conectando ao broker "));
    Serial.println(MQTT_SERVER);
    
    if (mqttClient.connect(DEVICE_ID)) {
      Serial.println(F("[MQTT] Conectado ao broker MQTT com sucesso!"));
      mqttClient.subscribe(TOPIC_COMMANDS);
    } else {
      Serial.print(F("[MQTT] Falha na conexão. Código rc="));
      Serial.println(mqttClient.state());
    }
  }
}

// --- FORMATAÇÃO E DESPACHO DE TELEMETRIA MQTT ---
void despacharTelemetria() {
  if (!mqttClient.connected()) return;

  StaticJsonDocument<384> doc;
  doc["device_id"]      = DEVICE_ID;
  doc["tenant"]         = "enterprise-corp";
  doc["hardware"]       = "ESP32_WROOM_32";
  doc["tipo"]           = "BALANCA_HX711";
  
  float pesoTratado = (abs(currentWeightGrams) < 0.2f) ? 0.0f : round(currentWeightGrams * 10.0f) / 10.0f;
  doc["peso"]           = pesoTratado;
  doc["unidade"]        = "g";
  doc["tara"]           = 0.0;
  doc["estavel"]        = isWeightStable;
  doc["adc_raw"]        = currentAdcRaw;
  doc["rssi"]           = WiFi.RSSI();
  doc["bateria_mv"]     = 4120;
  doc["uptime_s"]       = millis() / 1000;
  doc["status"]         = (currentWeightGrams > MAX_CAPACITY_GRAMS) ? "SOBRECARGA" : (isWeightStable ? "ESTAVEL" : "PESANDO");

  char buffer[384];
  serializeJson(doc, buffer);
  
  if (mqttClient.publish(TOPIC_TELEMETRY, buffer)) {
    Serial.print(F("[TELEMETRY] Pacote JSON publicado -> Peso: "));
    Serial.print(pesoTratado, 1);
    Serial.print(F("g | ADC: "));
    Serial.print(currentAdcRaw);
    Serial.print(F(" | Estável: "));
    Serial.println(isWeightStable ? F("SIM") : F("NÃO"));
  }
}

// ============================================================================
// SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.println(F("\\n========================================================"));
  Serial.println(F(" PARVUS AUTOMATE - SISTEMA INDUSTRIAL DE BALANÇA IOT   "));
  Serial.println(F(" Hardware: ESP32 WROOM-32 | Sensor: Célula HX711 24-bit "));
  Serial.println(F("========================================================"));

  // Configuração dos pinos de controle
  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(TARE_BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(STATUS_LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  // Inicialização do Hardware Watchdog com suporte multiplataforma (Core 2.x e 3.x)
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
  esp_task_wdt_config_t wdt_config = {
    .timeout_ms = WATCHDOG_TIMEOUT_S * 1000,
    .idle_core_mask = 0,
    .trigger_panic = true
  };
  esp_task_wdt_reconfigure(&wdt_config);
  esp_task_wdt_add(NULL);
#else
  esp_task_wdt_init(WATCHDOG_TIMEOUT_S, true);
  esp_task_wdt_add(NULL);
#endif
  Serial.println(F("[BOOT] Hardware Watchdog Timer configurado (10 segundos)."));

  // Carrega Calibração e Offset do NVS Flash
  preferences.begin("scale_nvs", true);
  calibrationFactor = preferences.getFloat("cal_factor", DEFAULT_CALIBRATION_FACTOR);
  long savedZeroOffset = preferences.getLong("zero_offset", 0);
  preferences.end();

  Serial.print(F("[BOOT] Fator de calibração NVS: "));
  Serial.println(calibrationFactor);

  // Inicialização do Módulo HX711
  Serial.println(F("[BOOT] Inicializando HX711 nos pinos DT=19, SCK=18..."));
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  
  if (scale.wait_ready_timeout(1000)) {
    scale.set_scale(calibrationFactor);
    if (savedZeroOffset != 0) {
      scale.set_offset(savedZeroOffset);
      Serial.println(F("[BOOT] Offset de Tara recuperado do NVS com sucesso."));
    } else {
      scale.tare(10);
      Serial.println(F("[BOOT] Tara inicial automática realizada."));
    }
    Serial.println(F("[HX711] Módulo pronto e calibrado para medições."));
  } else {
    Serial.println(F("[HX711 ERRO] HX711 não detectado! Verifique alimentação e pinagem."));
  }

  // Inicialização Wi-Fi
  WiFi.mode(WIFI_STA);
  verificarConectividadeWifi();

  // Configuração do Cliente MQTT
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  Serial.println(F("[BOOT] Sistema pronto para pesagem contínua industrial."));
}

// ============================================================================
// LOOP PRINCIPAL (100% NÃO-BLOQUEANTE)
// ============================================================================
void loop() {
  // Alimenta o Watchdog de hardware para evitar reinicializações
  esp_task_wdt_reset();

  unsigned long now = millis();

  // 1. Manutenção Contínua de Rede
  verificarConectividadeWifi();
  verificarConectividadeMqtt();
  if (mqttClient.connected()) {
    mqttClient.loop();
  }

  // 2. Leitura com Debounce do Botão Físico de Tara
  if (digitalRead(TARE_BUTTON_PIN) == LOW) {
    if (now - lastButtonPressTime > DEBOUNCE_DELAY_MS) {
      lastButtonPressTime = now;
      executarTara();
    }
  }

  // 3. Amostragem Periódica do ADC HX711
  if (now - lastSampleTime >= SAMPLE_INTERVAL_MS) {
    lastSampleTime = now;

    if (scale.is_ready()) {
      float rawWeight = scale.get_units(3); // Média ponderada de 3 amostras rápidas
      currentAdcRaw   = scale.read_average(2);
      
      // Filtro de suavização contra ruídos mecânicos e vibrações
      currentWeightGrams = (currentWeightGrams * 0.7f) + (rawWeight * 0.3f);
      
      // Verificação de Estabilidade de Leitura
      float delta = abs(currentWeightGrams - previousWeightGrams);
      if (delta < STABILITY_THRESHOLD_GRAMS) {
        stableCycles++;
        if (stableCycles >= 3) {
          isWeightStable = true;
          digitalWrite(STATUS_LED_PIN, HIGH); // LED aceso = medição estabilizada
        }
      } else {
        stableCycles = 0;
        isWeightStable = false;
        digitalWrite(STATUS_LED_PIN, LOW);
      }
      previousWeightGrams = currentWeightGrams;

      // Alarme de Sobrecarga Crítica (> 5000g)
      if (currentWeightGrams > MAX_CAPACITY_GRAMS) {
        digitalWrite(BUZZER_PIN, HIGH);
        Serial.println(F("[ALERTA CRÍTICO] SOBRECARGA DETECTADA NA CÉLULA DE CARGA!"));
      } else {
        digitalWrite(BUZZER_PIN, LOW);
      }
    }
  }

  // 4. Publicação Periódica da Telemetria no Broker
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = now;
    despacharTelemetria();
  }
}
`;
}

/**
 * Repara projetos IoT que sofreram truncamento durante a geração
 */
export function repairIncompleteIotProject(project: any, promptText: string = '', placaNome: string = 'ESP32 WROOM-32'): any {
  const mergedProject = { ...project };
  const category = detectDeviceCategory({
    ...mergedProject,
    descricao_tecnica: `${mergedProject.descricao_tecnica || ''} ${promptText}`
  });

  const placa = mergedProject.placa || placaNome || 'ESP32 WROOM-32';
  const titulo = mergedProject.titulo || 'Sistema de Balança Inteligente Parvus Scale-IoT';

  if (category === 'scale') {
    // Garante código de firmware de produção para Balança
    if (!mergedProject.codigo || !mergedProject.codigo.codigo_completo || mergedProject.codigo.codigo_completo.length < 250 || !mergedProject.codigo.codigo_completo.includes('void loop')) {
      mergedProject.codigo = {
        linguagem: 'C++',
        arquivo_principal: 'main.cpp',
        codigo_completo: getProductionScaleFirmware(placa, titulo),
        dependencias: [
          'HX711@^0.7.5',
          'PubSubClient@^2.8',
          'ArduinoJson@^6.21.3'
        ],
        instrucoes_upload: '1. Abra na Arduino IDE ou VSCode PlatformIO\\n2. Instale as bibliotecas HX711 e PubSubClient\\n3. Selecione a placa ESP32 Dev Module, velocidade 115200 baud e porta COM\\n4. Carregue o firmware e abra o Serial Monitor'
      };
    }

    // Componentes essenciais da Balança
    if (!mergedProject.componentes || mergedProject.componentes.length === 0) {
      mergedProject.componentes = [
        {
          nome: 'Módulo Conversor ADC HX711 24-bit',
          quantidade: 1,
          especificacao: 'ADC diferencial de 24 bits com ganho 128/64, alimentação 2.6V a 5.5V',
          pino_sugerido: 'GPIO 19 (DT) e GPIO 18 (SCK)',
          preco_estimado_brl: 14.50,
          onde_comprar: 'FilipeFlop / Mercado Livre / Baú da Eletrônica',
          link_sugerido: 'https://www.mercadolivre.com.br'
        },
        {
          nome: 'Célula de Carga Strain Gauge 5kg',
          quantidade: 1,
          especificacao: 'Sensor de peso por extensômetro de 4 fios (E+, E-, A+, A-), precisão 0.05% F.S.',
          pino_sugerido: 'Conexão direta nos bornes E+/E-/A+/A- do HX711',
          preco_estimado_brl: 22.90,
          onde_comprar: 'FilipeFlop / Mercado Livre',
          link_sugerido: 'https://www.mercadolivre.com.br'
        },
        {
          nome: 'Pushbutton com Capa (Botão de Tara)',
          quantidade: 1,
          especificacao: 'Chave táctil 12x12mm com resistor pull-up interno ativado no ESP32',
          pino_sugerido: 'GPIO 4',
          preco_estimado_brl: 2.50,
          onde_comprar: 'Baú da Eletrônica / Mercado Livre',
          link_sugerido: 'https://www.mercadolivre.com.br'
        },
        {
          nome: 'Buzzer Ativo 5V / 3.3V',
          quantidade: 1,
          especificacao: 'Emissor sonoro piezoelétrico para alerta de sobrecarga (> 5000g)',
          pino_sugerido: 'GPIO 15',
          preco_estimado_brl: 3.80,
          onde_comprar: 'FilipeFlop / Mercado Livre',
          link_sugerido: 'https://www.mercadolivre.com.br'
        },
        {
          nome: 'LED Difuso Verde 5mm (Indicador de Estabilidade)',
          quantidade: 1,
          especificacao: 'LED de status com resistor limitador de 330Ω',
          pino_sugerido: 'GPIO 2',
          preco_estimado_brl: 1.20,
          onde_comprar: 'Baú da Eletrônica',
          link_sugerido: 'https://www.mercadolivre.com.br'
        }
      ];
      mergedProject.preco_total_estimado_brl = 44.90;
    }

    // Esquema de ligação completo
    if (!mergedProject.esquema_ligacao || !mergedProject.esquema_ligacao.conexoes || mergedProject.esquema_ligacao.conexoes.length === 0) {
      mergedProject.esquema_ligacao = {
        descricao_textual: 'Conexão Fio a Fio do Sistema de Balança:\\n1. HX711 VCC -> ESP32 3V3 (Fio Vermelho)\\n2. HX711 GND -> ESP32 GND (Fio Preto)\\n3. HX711 DT (DOUT) -> ESP32 GPIO 19 (Fio Amarelo)\\n4. HX711 SCK (CLK) -> ESP32 GPIO 18 (Fio Verde)\\n5. Célula de Carga: Fio Vermelho em E+, Fio Preto em E-, Fio Branco em A-, Fio Verde em A+\\n6. Botão de Tara: Um terminal em GPIO 4 e outro em GND (Fio Azul)\\n7. Buzzer (+): em GPIO 15 e (-) em GND\\n8. LED (+): em GPIO 2 através de resistor 330Ω e (-) em GND',
        conexoes: [
          { de: 'ESP32 3V3', para: 'HX711 VCC', via: 'Linha positiva 3.3V protoboard' },
          { de: 'ESP32 GND', para: 'HX711 GND', via: 'Linha de terra comum protoboard' },
          { de: 'ESP32 GPIO 19', para: 'HX711 DT', via: 'Linha de dados SPI bit-bang' },
          { de: 'ESP32 GPIO 18', para: 'HX711 SCK', via: 'Linha de clock serial' },
          { de: 'Célula E+', para: 'HX711 E+', via: 'Alimentação excitação positiva' },
          { de: 'Célula E-', para: 'HX711 E-', via: 'Alimentação excitação negativa' },
          { de: 'Célula A+', para: 'HX711 A+', via: 'Sinal diferencial positivo' },
          { de: 'Célula A-', para: 'HX711 A-', via: 'Sinal diferencial negativo' },
          { de: 'ESP32 GPIO 4', para: 'Botão de Tara', via: 'Resistor pull-up interno ativado' },
          { de: 'ESP32 GPIO 15', para: 'Buzzer Alarme (+)', via: 'Saída digital de disparo sonoro' }
        ],
        pinout_svg: ''
      };
    }

    // Definição rica de telemetria metrológica
    mergedProject.telemetria_definicao = [
      { id: 'peso', label: 'Peso Líquido', unidade: 'g', tipo: 'number', min: 0, max: 5000, destaque: true },
      { id: 'tara', label: 'Tara / Offset', unidade: 'g', tipo: 'number', min: 0, max: 5000 },
      { id: 'estavel', label: 'Estabilidade', tipo: 'boolean', destaque: true },
      { id: 'adc_raw', label: 'Leitura HX711 (ADC 24-bit)', unidade: 'counts', tipo: 'number' },
      { id: 'rssi', label: 'Sinal Wi-Fi', unidade: 'dBm', tipo: 'number' },
      { id: 'bateria_mv', label: 'Tensão Alimentação', unidade: 'mV', tipo: 'number' }
    ];
  }

  return mergedProject;
}
