export interface WokwiDiagram {
  version: number;
  author: string;
  editor: string;
  parts: Array<{
    type: string;
    id: string;
    top: number;
    left: number;
    attrs?: Record<string, any>;
  }>;
  connections: Array<[string, string, string, string[]]>;
}

export function generateWokwiDiagram(projeto: any): { diagram: WokwiDiagram; diagramJson: string; wokwiToml: string } {
  const placa = (projeto?.placa || '').toLowerCase();
  
  let boardType = 'wokwi-esp32-devkit-v1';
  let elfPath = 'firmware.bin';
  
  if (placa.includes('arduino') || placa.includes('uno') || placa.includes('mega')) {
    boardType = 'wokwi-arduino-uno';
    elfPath = 'firmware.hex';
  } else if (placa.includes('rasp') || placa.includes('pico')) {
    boardType = 'wokwi-pi-pico';
    elfPath = 'firmware.uf2';
  } else if (placa.includes('8266') || placa.includes('nodemcu')) {
    boardType = 'wokwi-esp32-devkit-v1'; // Wokwi standard fallback
    elfPath = 'firmware.bin';
  }

  const parts: WokwiDiagram['parts'] = [
    { type: boardType, id: 'esp', top: 0, left: 0, attrs: {} }
  ];

  const connections: WokwiDiagram['connections'] = [];

  // Parse components and map to Wokwi parts
  const componentes = projeto?.componentes || [];
  let yOffset = -80;
  let xOffset = 220;

  componentes.forEach((comp: any, index: number) => {
    const nome = (comp.nome || '').toLowerCase();
    const id = `part_${index + 1}`;
    let partType = 'wokwi-led';
    let defaultAttrs: Record<string, any> = {};

    if (nome.includes('dht') || nome.includes('temperatura') || nome.includes('umidade')) {
      partType = 'wokwi-dht22';
    } else if (nome.includes('servo') || nome.includes('motor')) {
      partType = 'wokwi-servo';
    } else if (nome.includes('relay') || nome.includes('rele') || nome.includes('relé')) {
      partType = 'wokwi-relay-module';
    } else if (nome.includes('oled') || nome.includes('display') || nome.includes('i2c')) {
      partType = 'wokwi-ssd1306';
    } else if (nome.includes('lcd') || nome.includes('1602') || nome.includes('display')) {
      partType = 'wokwi-lcd1602';
    } else if (nome.includes('buzzer') || nome.includes('som') || nome.includes('alarme')) {
      partType = 'wokwi-buzzer';
    } else if (nome.includes('botao') || nome.includes('botão') || nome.includes('switch') || nome.includes('button')) {
      partType = 'wokwi-pushbutton';
      defaultAttrs = { color: 'green' };
    } else if (nome.includes('potenciometro') || nome.includes('potenciômetro')) {
      partType = 'wokwi-potentiometer';
    } else if (nome.includes('ldr') || nome.includes('luz') || nome.includes('luminosidade')) {
      partType = 'wokwi-photoresistor-sensor';
    } else if (nome.includes('led') || nome.includes('lâmpada') || nome.includes('lampada')) {
      partType = 'wokwi-led';
      defaultAttrs = { color: 'red' };
    } else if (nome.includes('resistor')) {
      partType = 'wokwi-resistor';
      defaultAttrs = { value: '220' };
    } else {
      partType = 'wokwi-led';
      defaultAttrs = { color: 'blue' };
    }

    parts.push({
      type: partType,
      id,
      top: yOffset,
      left: xOffset,
      attrs: defaultAttrs
    });

    // Suggest connection if pin is available
    const pin = comp.pino_sugerido || (comp.pinout ? comp.pinout.toString() : '');
    if (pin) {
      const cleanPin = pin.replace(/[^0-9A-Za-z]/g, '');
      const boardPin = cleanPin ? (cleanPin.startsWith('GPIO') ? cleanPin.replace('GPIO', '') : (boardType.includes('arduino') ? cleanPin : cleanPin)) : 'GND';
      
      if (partType === 'wokwi-led') {
        connections.push([`esp:${boardPin}`, `${id}:A`, 'green', ['v0']]);
        connections.push(['esp:GND.1', `${id}:C`, 'black', ['v0']]);
      } else if (partType === 'wokwi-dht22') {
        connections.push([`esp:${boardPin}`, `${id}:SDA`, 'yellow', ['v0']]);
        connections.push(['esp:3V3', `${id}:VCC`, 'red', ['v0']]);
        connections.push(['esp:GND.1', `${id}:GND`, 'black', ['v0']]);
      } else if (partType === 'wokwi-relay-module') {
        connections.push([`esp:${boardPin}`, `${id}:IN`, 'purple', ['v0']]);
        connections.push(['esp:5V', `${id}:VCC`, 'red', ['v0']]);
        connections.push(['esp:GND.1', `${id}:GND`, 'black', ['v0']]);
      } else if (partType === 'wokwi-servo') {
        connections.push([`esp:${boardPin}`, `${id}:PWM`, 'orange', ['v0']]);
        connections.push(['esp:5V', `${id}:V+`, 'red', ['v0']]);
        connections.push(['esp:GND.1', `${id}:GND`, 'black', ['v0']]);
      } else if (partType === 'wokwi-pushbutton') {
        connections.push([`esp:${boardPin}`, `${id}:1.l`, 'blue', ['v0']]);
        connections.push(['esp:GND.1', `${id}:2.l`, 'black', ['v0']]);
      } else {
        connections.push([`esp:${boardPin}`, `${id}:1`, 'blue', ['v0']]);
      }
    }

    yOffset += 110;
    if (yOffset > 300) {
      yOffset = -80;
      xOffset += 180;
    }
  });

  const diagram: WokwiDiagram = {
    version: 1,
    author: 'Parvus Automate AI',
    editor: 'wokwi',
    parts,
    connections
  };

  const diagramJson = JSON.stringify(diagram, null, 2);

  const wokwiToml = `[wokwi]
version = 1
firmware = '${elfPath}'
elf = '${elfPath}'
`;

  return { diagram, diagramJson, wokwiToml };
}
