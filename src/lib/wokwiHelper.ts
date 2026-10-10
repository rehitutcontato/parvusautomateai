export interface WokwiPart {
  type: string;
  id: string;
  top: number;
  left: number;
  attrs?: Record<string, any>;
}

export type WokwiConnection = [string, string, string, string[]];

export interface WokwiDiagram {
  version: number;
  author: string;
  editor: string;
  parts: WokwiPart[];
  connections: WokwiConnection[];
}

export interface WokwiBundle {
  diagram: WokwiDiagram;
  diagramJson: string;
  wokwiToml: string;
  librariesTxt: string;
}

export function generateWokwiDiagram(projeto: any): WokwiBundle {
  // Se o projeto já trouxer um wokwi_diagram válido gerado pela IA, utilizamos com validação
  if (projeto?.wokwi_diagram && typeof projeto.wokwi_diagram === 'object' && Array.isArray(projeto.wokwi_diagram.parts)) {
    const customDiagram: WokwiDiagram = {
      version: 1,
      author: 'Parvus Automate AI',
      editor: 'wokwi',
      parts: projeto.wokwi_diagram.parts,
      connections: Array.isArray(projeto.wokwi_diagram.connections) ? projeto.wokwi_diagram.connections : []
    };
    const deps = projeto?.codigo?.dependencias || ['PubSubClient', 'ArduinoJson', 'WiFi'];
    return {
      diagram: customDiagram,
      diagramJson: JSON.stringify(customDiagram, null, 2),
      wokwiToml: `[wokwi]\nversion = 1\nfirmware = "firmware.bin"\nelf = "firmware.elf"\n`,
      librariesTxt: deps.join('\n')
    };
  }

  const placa = (projeto?.placa || '').toLowerCase();
  
  let boardType = 'wokwi-esp32-devkit-v1';
  let elfName = 'firmware.bin';
  
  if (placa.includes('arduino') || placa.includes('uno') || placa.includes('mega') || placa.includes('r4')) {
    boardType = 'wokwi-arduino-uno';
    elfName = 'firmware.hex';
  } else if (placa.includes('rasp') || placa.includes('pico')) {
    boardType = 'wokwi-pi-pico';
    elfName = 'firmware.uf2';
  } else if (placa.includes('8266') || placa.includes('nodemcu')) {
    boardType = 'wokwi-esp32-devkit-v1';
    elfName = 'firmware.bin';
  }

  const parts: WokwiPart[] = [
    { type: boardType, id: 'esp', top: 50, left: 100, attrs: {} }
  ];

  const connections: WokwiConnection[] = [];

  const componentes = projeto?.componentes || [];
  let yOffset = -40;
  let xOffset = 380;

  componentes.forEach((comp: any, index: number) => {
    const nome = (comp.nome || '').toLowerCase();
    const id = `part_${index + 1}`;
    let partType = 'wokwi-led';
    let defaultAttrs: Record<string, any> = {};

    if (nome.includes('hx711') || nome.includes('balan') || nome.includes('peso') || nome.includes('carga') || nome.includes('load cell') || nome.includes('célula')) {
      partType = 'wokwi-potentiometer'; // Simula a variação de deformação da célula de carga
      defaultAttrs = { label: 'Célula HX711' };
    } else if (nome.includes('dht') || nome.includes('temperatura') || nome.includes('umidade')) {
      partType = 'wokwi-dht22';
    } else if (nome.includes('bme280') || nome.includes('bmp280')) {
      partType = 'wokwi-bme280';
    } else if (nome.includes('mpu') || nome.includes('acelerômetro') || nome.includes('giroscópio')) {
      partType = 'wokwi-mpu6050';
    } else if (nome.includes('servo') || nome.includes('motor')) {
      partType = 'wokwi-servo';
    } else if (nome.includes('relay') || nome.includes('rele') || nome.includes('relé')) {
      partType = 'wokwi-relay-module';
    } else if (nome.includes('oled') || nome.includes('ssd1306') || (nome.includes('display') && nome.includes('i2c'))) {
      partType = 'wokwi-ssd1306';
    } else if (nome.includes('lcd') || nome.includes('1602')) {
      partType = 'wokwi-lcd1602';
    } else if (nome.includes('buzzer') || nome.includes('som') || nome.includes('alarme')) {
      partType = 'wokwi-buzzer';
    } else if (nome.includes('pir') || nome.includes('presença') || nome.includes('movimento')) {
      partType = 'wokwi-pir-motion-sensor';
    } else if (nome.includes('ultrassom') || nome.includes('ultrasonico') || nome.includes('hcsr04')) {
      partType = 'wokwi-hc-sr04';
    } else if (nome.includes('potenciometro') || nome.includes('potenciômetro')) {
      partType = 'wokwi-potentiometer';
    } else if (nome.includes('ldr') || nome.includes('luminosidade') || nome.includes('fotoresistor')) {
      partType = 'wokwi-photoresistor-sensor';
    } else if (nome.includes('botao') || nome.includes('botão') || nome.includes('switch') || nome.includes('pushbutton') || nome.includes('tara') || nome.includes('tare')) {
      partType = 'wokwi-pushbutton';
      defaultAttrs = { color: 'blue', label: 'Tara' };
    } else if (nome.includes('led') || nome.includes('lampada') || nome.includes('lâmpada')) {
      partType = 'wokwi-led';
      defaultAttrs = { color: index % 2 === 0 ? 'red' : 'green' };
    } else if (nome.includes('resistor')) {
      partType = 'wokwi-resistor';
      defaultAttrs = { value: '220' };
    } else {
      partType = 'wokwi-led';
      defaultAttrs = { color: 'cyan' };
    }

    parts.push({
      type: partType,
      id,
      top: yOffset,
      left: xOffset,
      attrs: defaultAttrs
    });

    const pin = comp.pino_sugerido || (comp.pinout ? comp.pinout.toString() : '');
    if (pin) {
      // Extrai de forma limpa o número do pino GPIO (ex: "GPIO 19 (DT) e GPIO 18 (SCK)" -> "19", "D4" -> "4")
      const pinMatch = pin.match(/(?:GPIO\s*(\d+)|(?:^|[^\w])D(\d+)|(?:^|[^\w])(\d+)(?:[^\w]|$))/i);
      const boardPin = pinMatch ? (pinMatch[1] || pinMatch[2] || pinMatch[3]) : '4';

      if (partType === 'wokwi-led') {
        connections.push([`esp:${boardPin}`, `${id}:A`, 'green', ['v0']]);
        connections.push(['esp:GND.1', `${id}:C`, 'black', ['v0']]);
      } else if (partType === 'wokwi-dht22') {
        connections.push([`esp:${boardPin}`, `${id}:SDA`, 'yellow', ['v0']]);
        connections.push(['esp:3V3', `${id}:VCC`, 'red', ['v0']]);
        connections.push(['esp:GND.1', `${id}:GND`, 'black', ['v0']]);
      } else if (partType === 'wokwi-bme280') {
        connections.push([`esp:${boardPin || '21'}`, `${id}:SDA`, 'cyan', ['v0']]);
        connections.push(['esp:22', `${id}:SCL`, 'blue', ['v0']]);
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
      } else if (partType === 'wokwi-potentiometer') {
        connections.push(['esp:3V3', `${id}:VCC`, 'red', ['v0']]);
        connections.push([`esp:${boardPin || '19'}`, `${id}:SIG`, 'green', ['v0']]);
        connections.push(['esp:GND.1', `${id}:GND`, 'black', ['v0']]);
      } else if (partType === 'wokwi-pushbutton') {
        connections.push([`esp:${boardPin}`, `${id}:1.l`, 'blue', ['v0']]);
        connections.push(['esp:GND.1', `${id}:2.l`, 'black', ['v0']]);
      } else if (partType === 'wokwi-buzzer') {
        connections.push([`esp:${boardPin}`, `${id}:1`, 'yellow', ['v0']]);
        connections.push(['esp:GND.1', `${id}:2`, 'black', ['v0']]);
      } else if (partType === 'wokwi-ssd1306') {
        connections.push(['esp:21', `${id}:SDA`, 'cyan', ['v0']]);
        connections.push(['esp:22', `${id}:SCL`, 'blue', ['v0']]);
        connections.push(['esp:3V3', `${id}:VCC`, 'red', ['v0']]);
        connections.push(['esp:GND.1', `${id}:GND`, 'black', ['v0']]);
      } else {
        connections.push([`esp:${boardPin}`, `${id}:1`, 'green', ['v0']]);
      }
    }

    yOffset += 120;
    if (yOffset > 380) {
      yOffset = -40;
      xOffset += 200;
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
firmware = "${elfName}"
`;

  const deps = projeto?.codigo?.dependencias || ['WiFi', 'PubSubClient', 'ArduinoJson'];
  const librariesTxt = deps.join('\n');

  return { diagram, diagramJson, wokwiToml, librariesTxt };
}
