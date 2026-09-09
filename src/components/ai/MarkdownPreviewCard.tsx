import React, { useState } from 'react';

interface MarkdownPreviewCardProps {
  fileName: string;
  markdown: string;
  onCopy?: () => void;
}

export const MarkdownPreviewCard: React.FC<MarkdownPreviewCardProps> = ({
  fileName,
  markdown,
  onCopy,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      if (onCopy) onCopy();
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Falha ao baixar arquivo Markdown:', err);
    }
  };

  return (
    <div
      style={{
        marginTop: '1.5rem',
        padding: '1.25rem',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              📄 {fileName}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                color: '#16a34a',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              ✓ Validado e compatível com o website S23
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Arquivo Markdown gerado de forma determinística a partir do conteúdo revisado. Pronto para upload manual no Manager.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={handleCopy}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem' }}
          >
            {copied ? '✓ Copiado!' : '📋 Copiar Markdown'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem' }}
          >
            ⬇️ Baixar .md
          </button>
        </div>
      </div>

      <div>
        <label
          htmlFor="markdown-preview-textarea"
          style={{
            display: 'block',
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            marginBottom: '0.35rem',
          }}
        >
          Visualização do Arquivo (.md)
        </label>
        <textarea
          id="markdown-preview-textarea"
          readOnly
          value={markdown}
          rows={14}
          style={{
            width: '100%',
            fontFamily: 'monospace',
            fontSize: '0.8125rem',
            lineHeight: 1.45,
            padding: '0.75rem',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-main)',
            color: 'var(--text-primary)',
            resize: 'vertical',
            whiteSpace: 'pre',
          }}
        />
      </div>
    </div>
  );
};
