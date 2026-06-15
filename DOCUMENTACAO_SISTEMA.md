# DOCUMENTAÇÃO DO SISTEMA: PARVUS AUTOMATE

Esta documentação fornece uma visão técnica e funcional abrangente do **Parvus Automate**, uma plataforma inteligente e disruptiva para design, geração e simulação de automações, workflows visuais e sistemas baseados em Internet das Coisas (IoT) integrados à inteligência artificial de última geração.

---

## 1. Visão Geral & Proposta de Valor

O **Parvus Automate** é um ecossistema desenvolvido para acelerar a idealização e a engenharia de automações. Ele atua como um ponte entre engenheiros, agências, desenvolvedores de hardware/software e os modelos cognitivos de IA (utilizando a arquitetura `gemini-3.5-flash` via SDK oficial `@google/genai`).

### Os Três Pilares Funcionais:
1. **Engine de Classificação e Viabilidade**: Processa descrições livres de negócios ou dores industriais, qualificando o problema entre **Software**, **Hardware**, **Sistema Híbrido** ou **Enterprise**, analisando a viabilidade técnica e sugerindo as melhores soluções de forma imediata.
2. **Briefing Guiado e Modelagem**: Reduz a complexidade da especificação de sistemas através de um assistente de 5 etapas (briefing inteligente) ou pela escolha de templates estruturados de alta performance.
3. **Módulo IoT Avançado (Monitor & Creator)**: Gera diagramas de blocos, esquemas de ligação (ASCII), código-fonte firmware embarcado real (C++/Arduino ou MicroPython) e simula o comportamento dinâmico de circuitos virtuais diretamente em tela.

---

## 2. Arquitetura Técnica & Stack Tecnológica

O sistema segue as melhores práticas de engenharia de software full-stack moderna, combinando alta fidelidade visual no cliente com segurança e eficiência no servidor.

### Interface & Cliente (Frontend SPA)
* **Framework**: React 19 executado sob o compilador Vite de ultra performance.
* **Linguagem**: TypeScript com tipagem estática e interfaces robustas para segurança em tempo de compilação.
* **Estilização**: Tailwind CSS com foco em design futurista, legibilidade cibernética de alta fidelidade e paleta escura estruturada com elementos de neon e glassmorphism refinados.
* **Componentes & Fluxo Visual**:
  * **React Flow**: Construtor visual de relações e nós de dependência de integração.
  * **Recharts**: Renderização fluida de telemetria histórica e dados em tempo real.
  * **Motion (`motion/react`)**: Transições animadas suaves entre as telas, modais e estágios de briefing.
  * **Lucide React**: Biblioteca unificada para consistência iconográfica em todas as ações e representações de hardware.

### Servidor & Proxy (Backend Full-Stack)
* **Runtime**: Node.js com servidor robusto desenvolvido em **Express**.
* **Compilação de Servidor**: Empacotado usando o pipeline de alto desempenho do **esbuild** no estágio de build (`npm run build`), injetando imports de módulos nativos e resolvendo imports relativos no formato CommonJS (`.cjs`) para garantir inicialização limpa em ambiente Cloud Run.
* **Segurança de API (Server-Side Proxy)**: Todas as requisições que envolvem chaves da API Gemini são protegidas pelo backend. Nenhuma credencial de infraestrutura é exposta ao navegador do usuário.
* **SDK de IA**: Utilização nativa e moderna do SDK `@google/genai` (v1.29.0+), o framework mais recente do Google que facilita a especificação de tipos, geração de conteúdo confiável e suporte nativo ao modelo `gemini-3.5-flash`.

---

## 3. Fluxos de Entrada de Projeto (Onboarding & Geração)

Ao iniciar uma sessão no Parvus Automate, o usuário tem a flexibilidade de escolher entre três caminhos de modelagem inteligente, cada um desenhado para otimizar o nível de clareza do projeto:

### A. Gerar com IA (IA Pura)
Ideal para especificações vagas, inovadoras ou casos exclusivos.
1. O usuário digita uma descrição de texto aberto sobre seu problema.
2. O servidor envia o prompt para o modelo cognitivo Gemini.
3. O modelo processa e executa um mapeamento da **Solução Proposta**, retornando:
   * **Plano de Viabilidade**: Analisa se o projeto é viável, parcialmente viável ou inviável, justificando os motivos técnicos.
   * **Matriz de Categoria**: Categoriza o projeto no tipo perfeito (Software, Hardware, Híbrido, etc.) e a complexidade estimada para a escala operacional.
   * **Cronograma Estimado**: Sugere os minutos de esforço necessários para o setup físico ou de desenvolvimento.
   * **Passivos de Customização**: O sistema identifica lacunas na descrição e formula novas perguntas específicas necessárias para consolidar a geração.

### B. Briefing Inteligente (Fluxo Guiado de 5 Passos)
Estrutura e detalha tecnicamente os requisitos do sistema através de uma jornada visual interativa:
* **Etapa 1: Natureza**: Identifica o cerne da automação (sensores de campo, relatórios gerenciais, robôs físicos, formulários online).
* **Etapa 2: Entradas (Inputs)**: Configura como as informações entram no sistema (sensores analógicos, webhooks HTTP de terceiros, APIs REST, uploads de arquivos).
* **Etapa 3: Governança & Processamento**: Especifica as regras lógicas que regem o fluxo (banco de dados dedutivo, rotinas temporizadas, processamento de machine learning, integrações).
* **Etapa 4: Saídas (Outputs)**: Propõe como o sistema responde à tomada de decisão (mensagem no WhatsApp, atuadores físicos como relés, e-mails de incidentes ou relatórios em tempo real).
* **Etapa 5: Contexto de Negócio**: Define o segmento de indústria, o fluxo volumétrico esperado e a taxa e frequência das automações planejadas.

### C. Templates Prontos Customizados (Templates Flow)
Soluções pré-modeladas que cobrem os cenários comerciais mais recorrentes do mercado, permitindo que variáveis chaves sejam customizadas de imediato:
1. **WhatsApp Automático para Leads**:
   * **Objetivo**: Conecta formulários comerciais diretamente com disparo agendado do WhatsApp API de vendas.
   * **Variáveis**: Telefone do gestor, mensagem automatizada, plataforma de formulário (Typeform, JotForm, Formspree ou Webhook customizado).
2. **Dashboard IoT em Tempo Real**:
   * **Objetivo**: Fornece um painel completo para visualização rápida de métricas industriais (temperatura, umidade, vibração) utilizando o protocolo de telemetria leve MQTT com disparo de alertas inteligentes de estouro de limiar.
3. **Detecção de EPI com Câmera + Alertas**:
   * **Objetivo**: Processa feeds de câmeras IP de fábrica utilizando visão computacional (OpenCV/TensorFlow.js) para detectar ausência de EPIs obrigatórios (capacete, colete, luvas) e enviar fotos de monitoramento ao inspetor de segurança.
4. **Automação Inteligente de E-mails**:
   * **Objetivo**: Lê, filtra, classifica por sentimento e organiza as caixas de entrada de clientes/fornecedores automaticamente.

---

## 4. O Sistema Revolucionário de IoT (IoT Monitor & Creator)

O subsistema de Internet das Coisas do Parvus Automate é um dos módulos mais sofisticados do ecossistema, disponível para os planos **Creator**, **Agency** e **Enterprise**:

### Plataformas de Hardware Suportadas:
* **ESP32 WROOM-32** (Módulo Wi-Fi/Bluetooth SoC industrial)
* **Arduino UNO & Arduino MEGA** (Plataformas para prototipagem eletrônica imediata e periféricos)
* **Raspberry Pi 4B & Raspberry Pi Zero** (Computadores de placa única para computação de borda e gateways locais)
* **ESP8266 NodeMCU** (Mapeamento ágil para microssensoriamento via Wi-Fi econômico)
* **MQTT Brokers & HTTP Genérico** (Sistemas de barramento de mensagens e roteamento)

### Painel de Resolução de Projeto (Tabs de Visualização):
* **Visão Geral**: Resumo focado de componentes eletrônicos, requisitos ambientais, riscos físicos e arquitetura de rede recomendada.
* **Esquema Técnico (Arquitetura)**: Mapa estrutural lógico, incluindo diagramação de pinagem (Pinout de placa) e layout físico de montagem ASCII.
* **Firmware (Código)**: Geração automatizada de código-fonte profissional e compilável (linhas completas de código C++ limpas ou arquivos em Python/C) com sintaxe colorida em tempo real utilizando PrismJS integrado.
* **Manual de Peças**: Lista de componentes necessários contendo valores comerciais estimados e referências técnicas.

### Simulador Emulador IoT Integrado:
O Parvus Automate possui um **emulador de console serial autoritativo** hospedado em backend. Através de prompts altamente estruturados enviados à API `/api/ai/simulate-iot`:
1. O servidor recebe o código-fonte da placa e a plataforma selecionada.
2. O modelo cognitivo processa e executa uma simulação precisa de 10 loops de execução do interpretador de comandos.
3. Retorna leituras variáveis coerentes com o contexto técnico (como ruído de sensor analógico real, timestamps e feedback estrito de atuadores digitais ligando/desligando).
4. Fornece depuração direta em caso de loops lógicos errôneos ou sintaxe de rede inválida.

---

## 5. Níveis de Acesso & Modelo de Planos (Roles & Permissions)

O acesso aos recursos da plataforma é dinamicamente modulado pela biblioteca de permissões `permissions.ts`, garantindo governança rígida sobre fluxos e custos de geração:

| Plano | Badge CSS | Permissões do Sistema | Propósito de Uso |
| :--- | :--- | :--- | :--- |
| **FREE / STARTER** | Gray / Green | Gerador de ideias simples, busca no marketplace público, visualização e histórico de gerações básicas. | Prototipagem e exploração inicial de ideias de software. |
| **PRO** | Orange | Permite o uso de IA com limite extendido, geração de códigos de software avançados e automação comum. | Profissionais liberais e desenvolvedores individuais. |
| **CREATOR** | Purple | Acesso Completo ao **Gerador de Hardware IoT**, **Simulador Dinâmico**, **Creative Studio**, Agency Mode e Landing Pages IA. | Desenvolvedores de IoT, integradores industriais e projetistas físicos. |
| **AGENCY** | Yellow | Tudo do plano Creator, com maior volume e velocidade de geração de leads/automações complexas, e painel de controle otimizado. | Agências digitais especializadas em vendas e automação de rotinas de clientes. |
| **ENTERPRISE** | Light Blue | Acesso livre total, suporte premium especializado via canal exclusivo do WhatsApp, SLA corporativo garantido, onboarding assistido e arquiteturas customizadas para grande escala de produção. | Corporações de grande porte que demandam hardware seguro e processos proprietários. |
| **ADMIN** | Red | Acesso irrestrito a todas as visões de sistema, controle financeiro de compras, tabelas dinâmicas de usuários, auditoria técnica e manipulação de perfis. | Administração e infraestrutura de suporte da plataforma Parvus. |

---

## 6. Persistência & Modelagem de Dados (Supabase Integration)

O sistema de banco de dados utiliza a confiabilidade elástica do PostgreSQL gerenciado via **Supabase**. O modelo relacional é mapeado em duas entidades primárias cruciais de segurança:

### Tabela: `profiles`
Gerencia informações de conta e controle financeiro de consumo de IA dos clientes.
* `id` (uuid, Chave Primária vinculada ao Auth Core do Supabase)
* `nome` (text, Nome de exibição)
* `empresa` (text, Nome da organização e setor)
* `whatsapp_contato` (text, Canal de suporte e alertas)
* `plano` (text, Plano contratado: free, pro, creator, agency, enterprise, admin)
* `gemini_key_propria` (text, Coluna segura para usuários que preferirem usar credenciais próprias de IA)
* `created_at` (timestamptz, Data de criação)

### Tabela: `iot_devices`
Gerencia a telemetria, configurações e tokens físicos de segurança dos dispositivos IoT gerados.
* `id` (uuid, Chave Primária auto-gerada)
* `user_id` (uuid, Referência interna ao usuário proprietário da conta, com proteção cascade)
* `nome` (text, Identificação legível do dispositivo)
* `tipo` (text, Categoria física da placa ou atuador)
* `hardware` (text, Identificador da placa ex: esp32, arduino)
* `descricao` (text, Escopo de aplicação do nó de campo)
* `status` (text, Status em tempo real ex: online, offline, altert)
* `ultimo_ping` (timestamptz, Tempo desde o último contato estável)
* `dados_atuais` (jsonb, Representação chave/valor dos canais de sensores)
* `threshold_alerta` (jsonb, Limites dinâmicos configurados para envio de emergência)
* `historico_resumo` (jsonb, Array otimizado para gráficos históricos instantâneos)
* `token_dispositivo` (uuid, Chave criptográfica única utilizada pelo firmware físico para postar telemetria de forma segura via API)

### Segurança e Governança RLS (Row Level Security):
A tabela `iot_devices` é governada por políticas rigorosas baseadas na função `auth.uid() = user_id`, que impedem de forma absoluta que um cliente leia, atualize, ou modifique dados e logs de sensores pertencentes a outros usuários ou empresas.

---

## 7. Pipeline de Execução & Conclusão Técnica

O **Parvus Automate** constitui o ápice do design inteligente de engenharia de sistemas modernos. Ao orquestrar a flexibilidade semântica de grandes modelos de linguagem natural com a precisão mecânica do interpretador de hardware e do simulador virtual, o ecossistema reduz o tempo médio de ideação e desenvolvimento industrial de semanas para breves segundos. 

Seu ecossistema modular possui alto grau de reusabilidade de código e conformidade com regras estritas de segurança de rede, proporcionando escalabilidade e confiabilidade em qualquer nível de plano corporativo.
