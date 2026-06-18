export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    generations: 0,
    features: ['Visualização do sistema']
  },
  starter: {
    name: 'Starter',
    price: 99,
    generations: 5,
    features: ['5 gerações/mês', 'Suporte email']
  },
  pro: {
    name: 'Pro',
    price: 247,
    generations: 20,
    features: ['20 gerações/mês', 'NVIDIA Key própria', 'Suporte chat']
  },
  enterprise: {
    name: 'Enterprise',
    price: 497,
    generations: 100,
    features: ['100 gerações/mês', 'NVIDIA Key própria', 'Suporte prioritário']
  },
  admin: {
    name: 'Admin',
    price: 0,
    generations: 999999,
    features: ['Gerações ilimitadas', 'Painel admin completo']
  }
};

export const UPGRADE_WHATSAPP_URL = 'https://wa.me/5519994656845?text=Olá!%20Quero%20fazer%20upgrade%20do%20meu%20plano%20no%20Parvus%20Automate';
