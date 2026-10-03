import JSZip from 'jszip';
import { generateDockerFiles } from './dockerGenerator';
import { extractOrGenerateSqlSchema } from './sqlSchemaHelper';

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

  // 1. Frontend SPA
  if (options.generatedHtml) {
    zip.file('index.html', options.generatedHtml);
    const publicFolder = zip.folder('public');
    if (publicFolder) {
      publicFolder.file('index.html', options.generatedHtml);
    }
  }

  // 2. Backend Node.js
  if (options.generatedNode) {
    if (options.generatedNode.server_js) {
      zip.file('server.js', options.generatedNode.server_js);
    }
    if (options.generatedNode.package_json) {
      zip.file('package.json', options.generatedNode.package_json);
    }
    if (options.generatedNode.readme_md) {
      zip.file('README.md', options.generatedNode.readme_md);
    }
    if (options.generatedNode.arquitetura_ascii) {
      zip.file('ARQUITETURA.txt', options.generatedNode.arquitetura_ascii);
    }
  }

  // 3. SQL Schema for Supabase / PostgreSQL
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

  // 4. Environment Variables
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

  // 5. Dockerfile, Docker Compose, DevContainer
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

  const devcontainer = zip.folder('.devcontainer');
  if (devcontainer) {
    devcontainer.file('devcontainer.json', dockerFiles.devcontainerJson);
  }

  // 6. Hardware / IoT Artifacts if present
  if (options.generatedNode?.codigo_placa) {
    const iotFolder = zip.folder('firmware');
    if (iotFolder) {
      iotFolder.file('main.cpp', options.generatedNode.codigo_placa);
      iotFolder.file('firmware.ino', options.generatedNode.codigo_placa);
      if (options.generatedNode.pdf_pecas) {
        iotFolder.file('BOM_pecas.txt', options.generatedNode.pdf_pecas);
      }
      if (options.generatedNode.pdf_montagem) {
        iotFolder.file('manual_montagem.txt', options.generatedNode.pdf_montagem);
      }
      if (options.generatedNode.pdf_setup) {
        iotFolder.file('guia_setup.txt', options.generatedNode.pdf_setup);
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
