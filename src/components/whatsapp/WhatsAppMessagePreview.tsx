import React, { useState, useMemo } from 'react';
import { Quotation } from '../../types';
import { generateWhatsAppMessage } from '../../services/whatsappService';

interface WhatsAppMessagePreviewProps {
  quotation: Quotation;
}

export const WhatsAppMessagePreview: React.FC<WhatsAppMessagePreviewProps> = ({ quotation }) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  // Gera a mensagem determinística em tempo real com base no snapshot da cotação
  const message = useMemo(() => {
    return generateWhatsAppMessage(quotation);
  }, [quotation]);

  const handleCopy = async () => {
    try {
      setCopyError(null);
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      } else {
        // Fallback para navegadores sem Clipboard API nativa disponível
        const textArea = document.createElement('textarea');
        textArea.value = message;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err: any) {
      console.error('Falha ao copiar mensagem:', err);
      setCopyError('Não foi possível copiar automaticamente. Selecione e copie o texto manualmente.');
    }
  };

  return (
    <div className="card shadow-sm border border-slate-200 rounded-xl overflow-hidden bg-white">
      {/* Cabeçalho da Seção WhatsApp */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
            💬
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-800">Mensagem para WhatsApp</h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Template Oficial S23
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Texto comercial gerado deterministicamente a partir do snapshot desta cotação.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${
              copied
                ? 'bg-emerald-600 text-white shadow-emerald-200 scale-105'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95'
            }`}
          >
            {copied ? (
              <>
                <span>✔</span> Copiado com Sucesso!
              </>
            ) : (
              <>
                <span>📋</span> Copiar Mensagem
              </>
            )}
          </button>
        </div>
      </div>

      {copyError && (
        <div className="p-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 font-medium">
          ⚠️ {copyError}
        </div>
      )}

      {/* Caixa de Pré-visualização no estilo WhatsApp */}
      <div className="p-4 sm:p-5 bg-gradient-to-b from-[#efeae2]/50 to-[#efeae2]/20">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg p-4 sm:p-5 shadow-sm border border-slate-200/80 relative">
            <div className="absolute top-2.5 right-3 text-[10px] font-medium text-slate-400 select-none">
              Pré-visualização
            </div>
            <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-slate-800 leading-relaxed break-words">
              {message}
            </pre>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>
              🔒 Custos internos, margens e fornecedores são mantidos 100% confidenciais.
            </span>
            <span className="font-mono">{message.length} caracteres</span>
          </div>
        </div>
      </div>
    </div>
  );
};
