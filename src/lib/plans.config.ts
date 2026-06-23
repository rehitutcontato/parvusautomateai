export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    generations: 1,
    features: ['1 geração grátis de teste', 'Acesso ao Marketplace', 'Acesso a templates básicos']
  },
  starter: {
    name: 'Starter',
    price: 197,
    generations: 5,
    features: ['5 gerações completas/mês', 'Acesso ao Marketplace', 'Suporte por e-mail']
  },
  creator: {
    name: 'Creator',
    price: 397,
    generations: 10,
    features: ['10 gerações completas/mês', 'Monitor IoT Virtual', 'Modo Agência (White-label)', 'Suporte padrão']
  },
  pro: {
    name: 'Pro',
    price: 597,
    generations: 20,
    features: ['20 gerações completas/mês', 'Monitor IoT Virtual', 'Modo Agência (White-label)', 'NVIDIA Key Própria (GLM)', 'Suporte prioritário']
  },
  agency: {
    name: 'Agency',
    price: 1197,
    generations: 50,
    features: ['50 gerações completas/mês', 'Monitor IoT + Modo Agência', 'NVIDIA Key Própria (GLM)', 'Suporte via WhatsApp dedicado', 'Prioridade total de processamento']
  },
  enterprise: {
    name: 'Enterprise',
    price: 2497,
    generations: 100,
    features: ['100 gerações completas/mês', 'Tudo desbloqueado com prioridade máxima', 'Acompanhamento estratégico individual', 'Suporte premium 24/7 WhatsApp com Eng. Sênior']
  },
  admin: {
    name: 'Admin',
    price: 0,
    generations: 999999,
    features: ['Gerações ilimitadas', 'Acesso total administrativo', 'Painel admin completo']
  }
};

export const UPGRADE_WHATSAPP_URL = 'https://wa.me/5519994656845?text=Olá!%20Quero%20fazer%20upgrade%20do%20meu%20plano%20no%20Parvus%20Automate';
