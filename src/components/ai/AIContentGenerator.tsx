import React, { useState } from 'react';
import { Package, StructuredPackageContent } from '../../types';
import { buildContentGenerationInput, validateStructuredContent } from '../../services/contentValidationService';
import { generateContentForWebsite } from '../../services/aiContentService';
import { generatePackageMarkdown, getMarkdownFileName, S23_FIXED_INCLUSO_ITEM } from '../../services/markdownService';
import { validatePackageMarkdown } from '../../services/markdownValidationService';
import { PackageContentEditor } from './PackageContentEditor';
import { MarkdownPreviewCard } from './MarkdownPreviewCard';

export interface AIContentGeneratorProps {
  source: {
    package?: Package;
  };
}

export const AIContentGenerator: React.FC<AIContentGeneratorProps> = ({ source }) => {
  const pkg = source.package;

  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState<StructuredPackageContent | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Mensagens e erros de geração
  const [genError, setGenError] = useState<string | null>(null);
  const [genErrorDetails, setGenErrorDetails] = useState<string | null>(null);

  // Erros e status de validação / salvamento
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Estado do Markdown gerado deterministicamente
  const [markdownString, setMarkdownString] = useState<string | null>(null);
  const [markdownFileName, setMarkdownFileName] = useState<string | null>(null);

  // Modal de confirmação ao regenerar com alterações pendentes
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  if (!pkg) {
    return (
      <div
        style={{
          padding: '1rem',
          borderRadius: '8px',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          color: '#ef4444',
          fontSize: '0.875rem',
        }}
      >
        A funcionalidade "Conteúdo para website (IA)" pertence exclusivamente ao Pacote Base.
      </div>
    );
  }

  const pData = pkg.data || {};
  const sovereignSalePrice =
    typeof pData.financials?.salePrice === 'number'
      ? pData.financials.salePrice
      : typeof pData.financials?.priceTotal?.amount === 'number'
      ? pData.financials.priceTotal.amount
      : 0;

  // ----------------------------------------------------
  // GERAÇÃO COM IA (GEMINI 2.5 FLASH + GROUNDING)
  // ----------------------------------------------------
  const executeGeneration = async () => {
    try {
      setGenerating(true);
      setGenError(null);
      setGenErrorDetails(null);
      setValidationErrors([]);
      setSaveSuccess(false);
      setMarkdownString(null);
      setMarkdownFileName(null);

      // Constrói payload seguro (sanitizado contra custos internos/lucro/fornecedor)
      const input = buildContentGenerationInput({ package: pkg });

      const res = await generateContentForWebsite(input);

      if (!res.success || !res.data) {
        setGenError(res.error || 'Falha na geração de conteúdo com IA.');
        setGenErrorDetails(res.details || null);
        return;
      }

      // Garante a autoridade soberana dos dados comerciais do Pacote Base:
      // O preço gerado pela IA NUNCA sobrescreve o valor comercial oficial do pacote base.
      const rawGenerated = res.data;
      const enforcedContent: StructuredPackageContent = {
        ...rawGenerated,
        // Preço soberano do pacote base
        price: sovereignSalePrice > 0 ? sovereignSalePrice : rawGenerated.price,
        // Garantia do item fixo S23 em inclusões
        incluso: [
          ...(rawGenerated.incluso || []).filter(
            (item) => item.title?.trim() !== S23_FIXED_INCLUSO_ITEM.title
          ),
          S23_FIXED_INCLUSO_ITEM,
        ],
      };

      setContent(enforcedContent);
      setIsDirty(false);
      setShowRegenerateConfirm(false);
    } catch (err: any) {
      console.error('Erro na geração com IA:', err);
      setGenError(err.message || 'Erro inesperado ao comunicar com o gerador de conteúdo.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateClick = () => {
    if (isDirty) {
      setShowRegenerateConfirm(true);
    } else {
      executeGeneration();
    }
  };

  // ----------------------------------------------------
  // SALVAMENTO & VALIDAÇÃO DETERMINÍSTICA DO MARKDOWN
  // ----------------------------------------------------
  const handleSaveContent = () => {
    if (!content) return;

    setValidationErrors([]);
    setSaveSuccess(false);

    // 1. Garante que os dados soberanos continuem protegidos
    const finalizedContent: StructuredPackageContent = {
      ...content,
      price: sovereignSalePrice > 0 ? sovereignSalePrice : content.price,
    };

    // 2. Validação determinística do modelo estruturado
    const input = buildContentGenerationInput({ package: pkg });
    const contentValidation = validateStructuredContent(finalizedContent, input);

    if (!contentValidation.valid) {
      setValidationErrors(contentValidation.errors);
      setMarkdownString(null);
      setMarkdownFileName(null);
      return;
    }

    try {
      // 3. Geração determinística de Markdown via markdownService
      const validContent = contentValidation.data || finalizedContent;
      const md = generatePackageMarkdown(validContent);
      const filename = getMarkdownFileName(validContent);

      // 4. Validação estrita do arquivo Markdown via markdownValidationService
      const mdValidation = validatePackageMarkdown(md, validContent);

      if (!mdValidation.valid) {
        setValidationErrors(mdValidation.errors);
        setMarkdownString(null);
        setMarkdownFileName(null);
        return;
      }

      // Sucesso completo: atualiza estado, reseta dirty e disponibiliza download
      setContent(validContent);
      setMarkdownString(md);
      setMarkdownFileName(filename);
      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err: any) {
      console.error('Erro ao gerar/validar Markdown:', err);
      setValidationErrors([err.message || 'Erro inesperado ao gerar arquivo Markdown.']);
      setMarkdownString(null);
      setMarkdownFileName(null);
    }
  };

  return (
    <div
      className="ai-content-generator-container"
      style={{
        backgroundColor: 'var(--bg-main)',
        borderRadius: '8px',
        padding: '0.5rem 0',
      }}
    >
      {/* CABEÇALHO DO BLOCO */}
      <div
        style={{
          padding: '1.25rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '1.25rem' }}>✨</span>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Conteúdo para website (IA)
              </h3>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  color: 'var(--primary)',
                  textTransform: 'uppercase',
                }}
              >
                Pacote Base
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Crie e revise o conteúdo público deste pacote antes de gerar o arquivo Markdown para publicação no Manager.
            </p>
          </div>

          {!content && (
            <button
              type="button"
              onClick={executeGeneration}
              disabled={generating}
              className="btn btn-primary"
              style={{ padding: '0.6rem 1.25rem', fontWeight: 600 }}
            >
              {generating ? '✨ Gerando com IA...' : '✨ Gerar conteúdo estruturado'}
            </button>
          )}
        </div>

        {/* FEEDBACK DE ERRO NA GERAÇÃO */}
        {genError && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: '0.8125rem',
            }}
          >
            <strong>Erro na geração:</strong> {genError}
            {genErrorDetails && (
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', opacity: 0.9 }}>
                {genErrorDetails}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ESTADO INICIAL (SEM CONTEÚDO AINDA) */}
      {!content && (
        <div
          style={{
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '8px',
            border: '1px dashed var(--border-color)',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🌐</div>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', color: 'var(--text-primary)' }}>
            Nenhum conteúdo editorial gerado ainda
          </h4>
          <p
            style={{
              maxWidth: '520px',
              margin: '0 auto 1.5rem auto',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            Clique no botão abaixo para que o Gemini elabore a proposta comercial de conteúdo público
            (roteiro, apresentação do destino, inclusões e SEO) baseando-se estritamente nos dados cadastrados
            neste Pacote Base.
          </p>
          <button
            type="button"
            onClick={executeGeneration}
            disabled={generating}
            className="btn btn-primary"
            style={{ padding: '0.65rem 1.5rem', fontSize: '0.9375rem' }}
          >
            {generating ? '✨ Gerando conteúdo com IA...' : '✨ Gerar conteúdo estruturado'}
          </button>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO PARA REGENERAR QUANDO HOUVER ALTERAÇÕES MANUAIS */}
      {showRegenerateConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              maxWidth: '480px',
              width: '100%',
              padding: '1.5rem',
            }}
          >
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1.125rem', color: 'var(--text-primary)' }}>
              Confirmar regeneração com IA?
            </h4>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Este conteúdo possui alterações manuais. Regenerar substituirá todo o conteúdo atual pelo novo texto da IA. Deseja continuar?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowRegenerateConfirm(false)}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeGeneration}
                className="btn btn-primary"
                style={{ backgroundColor: '#dc2626' }}
              >
                Sim, regenerar conteúdo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK DE SUCESSO AO SALVAR */}
      {saveSuccess && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderRadius: '6px',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            color: '#16a34a',
            fontSize: '0.875rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <span>✓</span>
          <span>Conteúdo salvo e validado com sucesso! Arquivo Markdown gerado determinísticamente abaixo.</span>
        </div>
      )}

      {/* FEEDBACK DE ERROS DE VALIDAÇÃO */}
      {validationErrors.length > 0 && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            borderRadius: '6px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            marginBottom: '1rem',
          }}
        >
          <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            Não foi possível salvar e validar o conteúdo:
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#ef4444', fontSize: '0.8125rem' }}>
            {validationErrors.map((err, i) => (
              <li key={i} style={{ marginBottom: '0.25rem' }}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* EDITOR ESTRUTURADO CONTÍNUO (SEM ABAS) */}
      {content && (
        <>
          <PackageContentEditor
            content={content}
            onChange={(updated) => {
              setContent(updated);
              setIsDirty(true);
            }}
            basePackage={pkg}
            isDirty={isDirty}
            onSave={handleSaveContent}
            onRegenerate={handleRegenerateClick}
            isGenerating={generating}
          />

          {/* PREVIEW DETERMINÍSTICO DO MARKDOWN (APÓS SALVAMENTO BEM-SUCEDIDO) */}
          {markdownString && markdownFileName && (
            <MarkdownPreviewCard
              fileName={markdownFileName}
              markdown={markdownString}
            />
          )}
        </>
      )}
    </div>
  );
};
