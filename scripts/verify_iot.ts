import { detectDeviceCategory, formatSafeTimestamp, sanitizeFirmwareCode, repairIncompleteIotProject, getProductionScaleFirmware } from '../src/lib/iotRepairHelper';
import { generateWokwiDiagram } from '../src/lib/wokwiHelper';
import { renderCyberSchematicSvg } from '../src/lib/schematicSvgHelper';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
  console.log(`[PASS] ${msg}`);
}

console.log('--- 1. Testing detectDeviceCategory ---');
assert(detectDeviceCategory({ titulo: 'Sistema de Balança Inteligente Parvus Scale-IoT' }) === 'scale', 'Scale detected by title');
assert(detectDeviceCategory({ nome: 'Balança de precisão', hardware: 'ESP32' }) === 'scale', 'Scale detected by nome from Supabase');
assert(detectDeviceCategory({ descricao: 'Pesagem com célula de carga HX711' }) === 'scale', 'Scale detected by descricao');
assert(detectDeviceCategory({ componentes: [{ nome: 'Sensor HX711 24bit' }] }) === 'scale', 'Scale detected by componentes');
assert(detectDeviceCategory({ titulo: 'Estação Meteorológica' }) === 'weather', 'Weather detected');
assert(detectDeviceCategory(null) === 'generic', 'Null defaults to generic');
assert(detectDeviceCategory(undefined) === 'generic', 'Undefined defaults to generic');

console.log('\n--- 2. Testing formatSafeTimestamp (No Invalid Date) ---');
assert(!formatSafeTimestamp(null).includes('Invalid'), 'Null returns safe time string');
assert(!formatSafeTimestamp(undefined).includes('Invalid'), 'Undefined returns safe time string');
assert(!formatSafeTimestamp('invalid-date-string-xyz').includes('Invalid'), 'Malformed date string does not produce Invalid Date');
assert(formatSafeTimestamp('14:20:05') === '14:20:05', 'Direct time string preserved');
assert(!formatSafeTimestamp(new Date().toISOString()).includes('Invalid'), 'ISO string correctly formatted');

console.log('\n--- 3. Testing sanitizeFirmwareCode ---');
const fencedCpp = '```cpp\n#include <WiFi.h>\nvoid setup() {}\nvoid loop() {}\n```';
const sanitized = sanitizeFirmwareCode(fencedCpp);
assert(!sanitized.startsWith('```'), 'Markdown code fences removed');
assert(!sanitized.endsWith('```'), 'Markdown trailing fence removed');
assert(sanitized.includes('#include <WiFi.h>'), 'Firmware code preserved');

console.log('\n--- 4. Testing Wokwi Pin Extraction with Compound Names ---');
const scaleProject = {
  placa: 'ESP32 WROOM-32',
  componentes: [
    { nome: 'Célula HX711 5kg', pino_sugerido: 'GPIO 19 (DT) e GPIO 18 (SCK)' },
    { nome: 'Botão de Tara', pino_sugerido: 'GPIO 4' }
  ]
};
const wokwi = generateWokwiDiagram(scaleProject);
const sigConn = wokwi.diagram.connections.find(c => c[1] === 'part_1:SIG');
assert(Boolean(sigConn), 'Wokwi signal connection exists');
assert(sigConn![0] === 'esp:19', `Wokwi connected to clean GPIO 19, got: ${sigConn![0]}`);
const btnConn = wokwi.diagram.connections.find(c => c[0] === 'esp:4');
assert(Boolean(btnConn), 'Tara button connected to esp:4');

console.log('\n--- 5. Testing renderCyberSchematicSvg ---');
const svg = renderCyberSchematicSvg(scaleProject);
assert(svg.startsWith('<svg'), 'Rendered valid SVG tag');
assert(svg.includes('GPIO 19 DT'), 'Rendered scale DT pin label');
assert(svg.includes('GPIO 18 SCK'), 'Rendered scale SCK pin label');
assert(svg.includes('GPIO 4 TARE'), 'Rendered scale tare pin label');

console.log('\n--- 6. Testing repairIncompleteIotProject in Agency & Standard modes ---');
const incompleteProject = {
  titulo: 'Balança Industrial',
  placa: 'ESP32',
  codigo: {
    codigo_completo: '#include <WiFi.h>\n// truncado'
  }
};
const repairedAgency = repairIncompleteIotProject(incompleteProject, 'Célula de carga HX711 e pesagem de pallets', 'ESP32');
assert(repairedAgency.codigo.codigo_completo.length > 500, 'Repaired firmware has complete implementation');
assert(repairedAgency.codigo.codigo_completo.includes('void loop()'), 'Repaired firmware has void loop');
assert(repairedAgency.codigo.codigo_completo.includes('void setup()'), 'Repaired firmware has void setup');
assert(repairedAgency.codigo.codigo_completo.includes('ESP_ARDUINO_VERSION_MAJOR'), 'Firmware has dual Core 2.x and 3.x watchdog compatibility');
assert(repairedAgency.codigo.codigo_completo.includes('scale.tare'), 'Firmware has Tare method');

console.log('\nALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
