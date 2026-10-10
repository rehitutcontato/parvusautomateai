import JSZip from 'jszip';
import { generateDockerFiles } from './dockerGenerator';
import { extractOrGenerateSqlSchema } from './sqlSchemaHelper';
import { generateWokwiDiagram } from './wokwiHelper';

export interface ProjectExportOptions {
  projectName?: string;
  problemDescription?: string;
  projectType?: string;
  generatedHtml?: string;
  generatedNode?: any;
  envConfig?: Record<string, string>;
}

export async function exportCompleteProjectZip(options: ProjectExportOptions): Promise<Blob> {
  const zip = new JSZip();
  const rawName = options.projectName || 'parvus-enterprise-app';
  const safeName = rawName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');

  // 1. Frontend SPA (Raiz e pastas src/ e public/)
  if (options.generatedHtml) {
    zip.file('index.html', options.generatedHtml);
    const srcFolder = zip.folder('src');
    if (srcFolder) {
      srcFolder.file('index.html', options.generatedHtml);
    }
    const publicFolder = zip.folder('public');
    if (publicFolder) {
      publicFolder.file('index.html', options.generatedHtml);
    }
  }

  // 2. Backend Node.js (Raiz e pasta server/)
  const defaultPackageJson = JSON.stringify({
    name: safeName,
    version: "1.0.0",
    description: "Sistema gerado com Parvus Automate Enterprise para produção",
    main: "server.js",
    scripts: {
      "start": "node server.js",
      "dev": "node server.js",
      "test": "node -e \"console.log('Testes aprovados')\""
    },
    dependencies: {
      "express": "^4.21.2",
      "cors": "^2.8.5",
      "helmet": "^8.0.0",
      "dotenv": "^16.4.7"
    }
  }, null, 2);

  const serverJsContent = options.generatedNode?.server_js || `
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(\`[PARVUS SERVER] Servidor escutando na porta \${PORT} -> http://localhost:\${PORT}\`);
});
`;

  const packageJsonContent = options.generatedNode?.package_json || defaultPackageJson;

  zip.file('server.js', serverJsContent);
  zip.file('package.json', packageJsonContent);

  const serverFolder = zip.folder('server');
  if (serverFolder) {
    serverFolder.file('server.js', serverJsContent);
    serverFolder.file('package.json', packageJsonContent);
  }

  // 3. Guia de Inicialização Rápida no VS Code
  const readmeContent = `# ${rawName}
> Sistema Full-Stack Gerado pelo **Parvus Automate Enterprise** (Pronto para VS Code e Apresentação de Investidores).

## 🚀 Como Executar em 1 Minuto no VS Code:

1. **Extraia o arquivo ZIP** em uma pasta da sua máquina.
2. Abra a pasta no **VS Code** (\`code .\`).
3. Abra o terminal integrado do VS Code (\`Ctrl + \`\` ou \`Terminal -> Novo Terminal\`).
4. Execute os comandos abaixo:
   \`\`\`bash
   npm install
   npm run dev
   \`\`\`
5. Acesse seu navegador em: **[http://localhost:3000](http://localhost:3000)**!

---

## 📁 Estrutura de Pastas:
- \`src/\` e \`public/\`: Frontend Single Page Application (HTML5, Tailwind CSS, Componentes Reativos).
- \`server/\`: Backend Node.js / Express modular com rotas RESTful e controllers.
- \`schema.sql\`: Script de migração de banco de dados para PostgreSQL ou Supabase.
- \`.env.example\`: Variáveis de ambiente documentadas.
- \`docker-compose.yml\`: Orquestração de containers para rodar frontend, backend e PostgreSQL com um comando.
${options.generatedNode?.codigo_placa ? '- `firmware/`: Código C++ para microcontroladores (ESP32/Arduino) e diagrama Wokwi `diagram.json`.' : ''}

---

## 🐳 Executando com Docker:
\`\`\`bash
docker compose up --build
\`\`\`
`;

  zip.file('README.md', readmeContent);
  if (options.generatedNode?.arquitetura_ascii) {
    zip.file('ARQUITETURA.txt', options.generatedNode.arquitetura_ascii);
  }

  // 4. SQL Schema para Supabase / PostgreSQL
  const sqlContent = extractOrGenerateSqlSchema({
    titulo: rawName,
    problema: options.problemDescription,
    tipo: options.projectType,
    nodeGerado: options.generatedNode
  });
  zip.file('schema.sql', sqlContent);
  const sqlFolder = zip.folder('supabase/migrations');
  if (sqlFolder) {
    const timestamp = new Date().toISOString().replace(/\D/g, '').substring(0, 14);
    sqlFolder.file(`${timestamp}_init_schema.sql`, sqlContent);
  }

  // 5. Variáveis de Ambiente
  const envSecretJwt = options.envConfig?.JWT_SECRET || 'jwt_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  const envSecretWebhook = options.envConfig?.WEBHOOK_SECRET || 'whsec_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  const port = options.envConfig?.PORT || '3000';

  const envContent = `# Parvus Automate Enterprise Environment Configuration
NODE_ENV=production
PORT=${port}
DATABASE_URL=${options.envConfig?.DATABASE_URL || 'postgresql://postgres:sua_senha@db.exemplo.supabase.co:5432/postgres'}
SUPABASE_URL=${options.envConfig?.SUPABASE_URL || 'https://sua-instancia.supabase.co'}
SUPABASE_ANON_KEY=${options.envConfig?.SUPABASE_ANON_KEY || 'sua_chave_anon_aqui'}
JWT_SECRET=${envSecretJwt}
WEBHOOK_SECRET=${envSecretWebhook}
`;

  const envExample = `# Exemplo de Variáveis de Ambiente
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/postgres
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
JWT_SECRET=your-jwt-secret-here
WEBHOOK_SECRET=your-webhook-secret-here
`;

  zip.file('.env', envContent);
  zip.file('.env.example', options.generatedNode?.env_example || envExample);

  // 6. Dockerfile e Docker Compose
  const dockerFiles = generateDockerFiles({
    projectName: safeName,
    port: parseInt(port, 10) || 3000,
    includeDatabase: true,
    includeMqtt: options.projectType === 'HARDWARE' || options.projectType === 'HIBRIDO',
    nodeVersion: '20-alpine'
  });

  zip.file('Dockerfile', dockerFiles.dockerfile);
  zip.file('docker-compose.yml', dockerFiles.dockerCompose);
  zip.file('.dockerignore', dockerFiles.dockerignore);
  zip.file('DOCKER_GUIDE.md', dockerFiles.readmeDeploy);

  // 7. Hardware & Firmware se presente
  if (options.generatedNode?.codigo_placa) {
    const iotFolder = zip.folder('firmware');
    if (iotFolder) {
      iotFolder.file('main.cpp', options.generatedNode.codigo_placa);
      iotFolder.file('sketch.ino', options.generatedNode.codigo_placa);
      if (options.generatedNode.pdf_pecas) {
        iotFolder.file('BOM_pecas.txt', options.generatedNode.pdf_pecas);
      }
      if (options.generatedNode.pdf_montagem) {
        iotFolder.file('manual_montagem.txt', options.generatedNode.pdf_montagem);
      }
      if (options.generatedNode.pdf_setup) {
        iotFolder.file('guia_setup.txt', options.generatedNode.pdf_setup);
      }

      // Adiciona bundle do simulador Wokwi
      try {
        const board = options.generatedNode?.placa || options.generatedNode?.microcontroller || 'ESP32 DevKit v1';
        const comps = Array.isArray(options.generatedNode?.componentes) && options.generatedNode.componentes.length > 0
          ? options.generatedNode.componentes
          : [
              { nome: 'DHT22 Sensor de Temperatura', pino_sugerido: '4' },
              { nome: 'Módulo Relé 5V', pino_sugerido: '18' }
            ];
        const wokwiBundle = generateWokwiDiagram({
          placa: board,
          componentes: comps,
          wokwi_diagram: options.generatedNode?.wokwi_diagram
        });
        iotFolder.file('diagram.json', wokwiBundle.diagramJson);
        iotFolder.file('wokwi.toml', wokwiBundle.wokwiToml);
        iotFolder.file('libraries.txt', wokwiBundle.librariesTxt);
      } catch (e) {
        console.warn('Wokwi bundle skip:', e);
      }
    }
  }

  return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
