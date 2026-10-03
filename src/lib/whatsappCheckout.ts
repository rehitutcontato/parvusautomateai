/**
 * Utilitário para geração de links de checkout e upgrade direto no WhatsApp
 * Oficial Parvus Automate / Parvus Space (parvuspace.com.br)
 * Destinatário: Pablo Nunes Pereira (+55 19 99465-6845)
 */

export interface WhatsAppCheckoutOptions {
  planName: string;
  planPrice?: number;
  userName?: string;
  userEmail?: string;
  userId?: string;
  phone?: string;
}

export function buildWhatsAppCheckoutUrl({
  planName,
  planPrice,
  userName,
  userEmail,
  userId,
  phone = '5519994656845'
}: WhatsAppCheckoutOptions): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const timestamp = new Date().toLocaleString('pt-BR');
  const priceStr = planPrice !== undefined && planPrice > 0 
    ? ` (R$ ${planPrice.toFixed(2).replace('.', ',')}/mês)` 
    : '';

  const nameStr = userName && userName.trim() ? userName.trim() : 'Cliente (Novo Usuário)';
  const emailStr = userEmail && userEmail.trim() ? userEmail.trim() : 'Não informado';
  const idStr = userId ? userId : 'Pendente de Ativação';

  const message = 
`🚀 *SOLICITAÇÃO DE ASSINATURA - PARVUS AUTOMATE* 🚀
Olá Pablo! Gostaria de assinar / atualizar meu plano no *Parvus Automate* (Ecossistema Parvus Space).

📋 *DADOS DA CONTA:*
• *Nome:* ${nameStr}
• *E-mail:* ${emailStr}
• *ID de Usuário:* ${idStr}
• *Plano Escolhido:* *${planName}*${priceStr}
• *Data da Solicitação:* ${timestamp}

💳 *FORMA DE PAGAMENTO:* PIX
Por favor, me envie a chave PIX ou o QR Code para confirmação e liberação do meu plano no sistema!`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
