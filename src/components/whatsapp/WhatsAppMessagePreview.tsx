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
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Cabeçalho da Seção WhatsApp */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Mensagem para WhatsApp
            </h3>
            <span className="badge badge-success">
              Template oficial S23
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Texto comercial preparado a partir dos dados desta cotação.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="btn btn-sm btn-action-primary"
        >
          {copied ? 'Copiado com sucesso!' : 'Copiar mensagem'}
        </button>
      </div>

      {copyError && (
        <div style={{ padding: '0.5rem 1rem', background: 'var(--warning-soft)', borderBottom: '1px solid rgba(217, 119, 6, 0.2)', fontSize: '12px', color: 'var(--warning)' }}>
          {copyError}
        </div>
      )}

      {/* Caixa de Pré-visualização */}
      <div style={{ padding: '1rem', background: 'var(--bg-surface-elevated)' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '1rem', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '0.5rem', right: '0.75rem', fontSize: '11px', color: 'var(--text-muted)' }}>
              Pré-visualização
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
              {message}
            </pre>
          </div>
          <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <span>Custos internos, margens e fornecedores são confidenciais.</span>
            <span>{message.length} caracteres</span>
          </div>
        </div>
      </div>
    </div>
  );
};
