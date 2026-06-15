export const DEFAULT_TEMPLATES = [
  {
    id: "tpl_whatsapp_leads",
    nome: "WhatsApp Automático para Leads",
    descricao: "Integra formulário com WhatsApp. Cada novo lead recebe mensagem automática.",
    tipo: "SOFTWARE",
    complexidade: "BÁSICO",
    icone: "💬",
    tecnologias: ["Node.js", "WhatsApp API", "Supabase"],
    tempo_minutos: 3,
    perguntas_customizacao: [
      {
        id: "q1",
        tipo: "text",
        pergunta: "Qual é o seu número WhatsApp Business? (com código país +55)",
        placeholder: "+55 19 99999-9999",
        campo_template: "OWNER_WHATSAPP"
      },
      {
        id: "q2",
        tipo: "textarea",
        pergunta: "Qual é a mensagem que será enviada automaticamente?",
        placeholder: "Ex: Oi {{nome}}, recebemos sua solicitação. Entraremos em contato em breve!",
        campo_template: "AUTO_MESSAGE"
      },
      {
        id: "q3",
        tipo: "select",
        pergunta: "Qual é sua plataforma de formulário?",
        opcoes: [
          { value: "typeform", label: "Typeform" },
          { value: "jotform", label: "JotForm" },
          { value: "formspree", label: "Formspree" },
          { value: "custom_webhook", label: "Webhook customizado" }
        ],
        campo_template: "FORM_PLATFORM"
      }
    ],
    arquivos_template: {
      server_js: "// Template Node.js for {{FORM_PLATFORM}}\nconst whatsapp = require('whatsapp');\nconst num = '{{OWNER_WHATSAPP}}';\nconst msg = '{{AUTO_MESSAGE}}';\n\n// TODO: Implement logic",
      package_json: "{\n  \"name\": \"whatsapp-leads\",\n  \"version\": \"1.0.0\"\n}",
      frontend_html: "<!-- HTML interface -->\n<div>Webhook settings</div>",
      readme_md: "# WhatsApp Leads Setup\nFollow these instructions."
    }
  },
  {
    id: "tpl_iot_dashboard",
    nome: "Dashboard IoT em Tempo Real",
    descricao: "Monitore sensores (temperatura, umidade, produção) em tempo real com alertas automáticos.",
    tipo: "HÍBRIDO",
    complexidade: "MÉDIO",
    icone: "📊",
    tecnologias: ["Node.js", "MQTT", "Supabase", "Chart.js", "Arduino/ESP32"],
    tempo_minutos: 5,
    perguntas_customizacao: [
      {
        id: "q1",
        tipo: "text",
        pergunta: "Qual é o nome do seu projeto? (vai aparecer no dashboard)",
        placeholder: "Ex: Fábrica SP - Linha A",
        campo_template: "PROJECT_NAME"
      },
      {
        id: "q2",
        tipo: "text", // changed from json for simplicity
        pergunta: "Quais sensores você tem? (Ex: temperatura, umidade)",
        placeholder: 'temperatura, umidade',
        campo_template: "SENSORS_CONFIG"
      },
      {
        id: "q3",
        tipo: "number",
        pergunta: "Qual é o limite máximo de temperatura para alerta?",
        placeholder: "80",
        campo_template: "TEMP_LIMIT"
      },
      {
        id: "q4",
        tipo: "email",
        pergunta: "Para qual e-mail enviar alertas?",
        placeholder: "gestor@empresa.com",
        campo_template: "ALERT_EMAIL"
      }
    ],
    arquivos_template: {
      server_js: "// IoT Backend for {{PROJECT_NAME}}\nconst email = '{{ALERT_EMAIL}}';\nconst limit = {{TEMP_LIMIT}};",
      arduino_code: "// Arduino Code for {{SENSORS_CONFIG}}",
      frontend_html: "<!-- Dashboard HTML -->",
      readme_md: "# Guide for {{PROJECT_NAME}}"
    }
  },
  {
    id: "tpl_epi_detection",
    nome: "Detecção de EPI com Câmera + Alertas",
    descricao: "Câmera com IA detecta funcionário sem EPI (capacete, colete, luva). Envia alerta automático.",
    tipo: "HÍBRIDO",
    complexidade: "AVANÇADO",
    icone: "🎥",
    tecnologias: ["Node.js", "OpenCV/TensorFlow.js", "Telegram/WhatsApp API"],
    tempo_minutos: 8,
    perguntas_customizacao: [
      {
        id: "q1",
        tipo: "text",
        pergunta: "Qual é a ID da câmera IP ou URL?",
        placeholder: "192.168.1.100:8080 ou https://camera-url.com/stream",
        campo_template: "CAMERA_URL"
      },
      {
        id: "q2",
        tipo: "select",
        pergunta: "Quais EPIs são obrigatórios no seu setor?",
        opcoes: [
          { value: "helmet", label: "Capacete" },
          { value: "vest", label: "Colete" },
          { value: "gloves", label: "Luvas" },
          { value: "mask", label: "Máscara" }
        ],
        campo_template: "REQUIRED_EPIS"
      },
      {
        id: "q3",
        tipo: "select",
        pergunta: "Para onde enviar alertas?",
        opcoes: [
          { value: "telegram", label: "Telegram" },
          { value: "whatsapp", label: "WhatsApp" },
          { value: "email", label: "E-mail" }
        ],
        campo_template: "ALERT_METHOD"
      },
      {
        id: "q4",
        tipo: "text",
        pergunta: "ID/Número/E-mail do responsável pela segurança",
        placeholder: "Ex: +55 19 99999-9999",
        campo_template: "ALERT_RECIPIENT"
      }
    ],
    arquivos_template: {
      server_js: "// EPI Detection Base\nconst cameraUrl = '{{CAMERA_URL}}';\nconst requiredObj = '{{REQUIRED_EPIS}}';\nconst notifyMethod = '{{ALERT_METHOD}}';\nconst notifyTo = '{{ALERT_RECIPIENT}}';",
      model_tflite: "binary",
      frontend_html: "<!-- Monitor -->",
      readme_md: "# EPI Camera Setup"
    }
  },
  {
    id: "tpl_email_automation",
    nome: "Automação Inteligente de E-mails",
    descricao: "Lê e-mails de fornecedores/clientes, classifica automaticamente, organiza em pastas.",
    tipo: "SOFTWARE",
    complexidade: "BÁSICO",
    icone: "📧",
    tecnologias: ["Node.js", "Gmail API", "Supabase"],
    tempo_minutos: 4,
    perguntas_customizacao: [
      {
        id: "q1",
        tipo: "text",
        pergunta: "Qual é o seu e-mail Gmail para conectar?",
        placeholder: "seu_email@gmail.com",
        campo_template: "GMAIL_ADDRESS"
      },
      {
        id: "q2",
        tipo: "text",
        pergunta: "Quais categorias de e-mail você quer criar? (separado por vírgula)",
        placeholder: "Pedidos, Suporte",
        campo_template: "EMAIL_CATEGORIES"
      },
      {
        id: "q3",
        tipo: "text",
        pergunta: "Qual é o seu número para receber notificações SMS? (opcional)",
        placeholder: "+55 19 99999-9999",
        campo_template: "NOTIFY_PHONE"
      }
    ],
    arquivos_template: {
      server_js: "// Gmail automator for {{GMAIL_ADDRESS}}\nconst categories = '{{EMAIL_CATEGORIES}}';\nconst phone = '{{NOTIFY_PHONE}}';",
      classifier_js: "// Logic class",
      frontend_html: "<!-- Dashboard html -->",
      readme_md: "# Setup instructions"
    }
  }
];
