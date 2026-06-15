import React from 'react';
import { X, MessageCircle, Info } from 'lucide-react';
import { UPGRADE_WHATSAPP_URL } from '../../lib/plans.config';

interface UpgradeModalProps {
  onClose: () => void;
}

export function UpgradeModal({ onClose }: UpgradeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#111111] border border-[#ff3366]/40 rounded-xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-[#ff3366]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#ff3366]/30">
            <Info className="text-[#ff3366]" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Limite Atingido ⚠️</h2>
          <p className="text-gray-400 leading-relaxed text-sm">
            Você atingiu o limite de gerações de automações do seu plano deste mês.
          </p>
        </div>

        <div className="bg-[#0a0a0a] rounded-lg p-5 border border-white/5 mb-6">
          <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Planos disponíveis:</h3>
          <ul className="space-y-3">
            <li className="flex justify-between items-center text-sm">
              <span className="text-[#00ff88] font-medium">• Starter</span>
              <span className="text-gray-500">R$99/mês</span>
              <span className="text-gray-300">→ 5 gerações</span>
            </li>
            <li className="flex justify-between items-center text-sm">
              <span className="text-purple-400 font-medium">• Pro</span>
              <span className="text-gray-500">R$247/mês</span>
              <span className="text-gray-300">→ 20 gerações</span>
            </li>
            <li className="flex justify-between items-center text-sm">
              <span className="text-blue-400 font-medium">• Enterprise</span>
              <span className="text-gray-500">R$497/mês</span>
              <span className="text-gray-300">→ 100 gerações</span>
            </li>
          </ul>
        </div>

        <div className="text-center">
          <p className="text-gray-400 text-sm mb-4">
            Para continuar gerando estruturas no Parvus Automate, fale conosco:
          </p>
          <a
            href={UPGRADE_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1ebd58] text-white font-bold py-3 px-4 rounded-lg transition-colors cursor-pointer"
          >
            <MessageCircle size={20} />
            Falar pelo WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
