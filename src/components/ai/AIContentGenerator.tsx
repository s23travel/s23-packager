import React, { useState, useEffect, useCallback } from 'react';
import { Package, StructuredPackageContent, PackageWebsiteContent } from '../../types';
import { buildContentGenerationInput, validateStructuredContent } from '../../services/contentValidationService';
import { generateContentForWebsite } from '../../services/aiContentService';
import { generatePackageMarkdown, getMarkdownFileName, S23_FIXED_INCLUSO_ITEM, S23_OBLIGATORY_PAYMENT_NOTE, appendDestinationDisclaimer } from '../../services/markdownService';
import { validatePackageMarkdown } from '../../services/markdownValidationService';
import { packageWebsiteContentService } from '../../services/packageWebsiteContentService';
import { PackageContentEditor } from './PackageContentEditor';
import { MarkdownPreviewCard } from './MarkdownPreviewCard';

export interface AIContentGeneratorProps {
  source: {
    package?: Package;
  };
}

function formatDateTime(isoString?: string): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export const AIContentGenerator: React.FC<AIContentGeneratorProps> = ({ source }) => {
  const pkg = source.package;

  // Estado de carregamento do conteúdo persistido
  const [loadingPersisted, setLoadingPersisted] = useState(true);
  const [savedRecord, setSavedRecord] = useState<PackageWebsiteContent | null>(null);

  // Modo de edição: se true, exibe o editor estruturado
  const [isEditingContent, setIsEditingContent] = useState(false);

  // Visualização rápida do Markdown na tela de conteúdo salvo
  const [showMarkdownViewer, setShowMarkdownViewer] = useState(false);

  // Estados de IA e formulário
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState<StructuredPackageContent | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Mensagens e erros
  const [genError, setGenError] = useState<string | null>(null);
  const [genErrorDetails, setGenErrorDetails] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Estado do Markdown gerado
  const [markdownString, setMarkdownString] = useState<string | null>(null);
  const [markdownFileName, setMarkdownFileName] = useState<string | null>(null);

  // Modal de confirmação ao regenerar com alterações pendentes
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  // ----------------------------------------------------
  // CARREGAR CONTEÚDO SALVO NO MOUNT / MUDANÇA DE PACOTE
  // ----------------------------------------------------
  const loadPersistedContent = useCallback(async () => {
    if (!pkg?.id) {
      setLoadingPersisted(false);
      return;
    }

    try {
      setLoadingPersisted(true);
      const record = await packageWebsiteContentService.getPackageWebsiteContent(pkg.id);
      if (record) {
        setSavedRecord(record);
        setContent(record.content);
        setMarkdownString(record.markdown);
        setMarkdownFileName(record.filename);
        setIsEditingContent(false);
      } else {
        setSavedRecord(null);
        setContent(null);
        setMarkdownString(null);
        setMarkdownFileName(null);
        setIsEditingContent(false);
      }
    } catch (err: any) {
      console.error('Erro ao carregar conteúdo persistido do website:', err);
    } finally {
      setLoadingPersisted(false);
    }
  }, [pkg?.id]);

  useEffect(() => {
    loadPersistedContent();
  }, [loadPersistedContent]);

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
    typeof pData.financials?.pricePerPerson === 'number'
      ? pData.financials.pricePerPerson
      : typeof pData.financials?.salePrice === 'number'
      ? pData.financials.salePrice
      : typeof pData.financials?.priceTotal?.amount === 'number'
      ? pData.financials.priceTotal.amount
      : 0;

  // ----------------------------------------------------
  // DOWNLOAD DIRETO DO MARKDOWN SALVO (SEM CHAMAR IA)
  // ----------------------------------------------------
  const handleDirectDownload = (md: string, filename: string) => {
    try {
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Falha ao baixar arquivo Markdown:', err);
    }
  };

  // ----------------------------------------------------
  // GERAÇÃO COM IA (GEMINI 2.5 FLASH + GROUNDING)
  // ----------------------------------------------------
  const executeGeneration = async () => {
    try {
      setGenerating(true);
      setGenError(null);
      setGenErrorDetails(null);
      setValidationErrors([]);
      setSaveSuccessMessage(null);

      // Constrói payload seguro sanitizado
      const input = buildContentGenerationInput({ package: pkg });

      const res = await generateContentForWebsite(input);

      if (!res.success || !res.data) {
        setGenError(res.error || 'Falha na geração de conteúdo com IA.');
        setGenErrorDetails(res.details || null);
        return;
      }

      // Aplica dados soberanos do Pacote Base e preserva edição manual de pagamento
      const rawGenerated = res.data;

      // Preserva observação de pagamento previamente editada ou salva
      const existingPaymentNote =
        content?.pagamento?.observacao || savedRecord?.content?.pagamento?.observacao;
      const paymentNoteToUse =
        existingPaymentNote && existingPaymentNote.trim()
          ? existingPaymentNote.trim()
          : (rawGenerated.pagamento?.observacao?.trim() || S23_OBLIGATORY_PAYMENT_NOTE);

      // Anexa o aviso padrão na descrição do destino sem duplicar
      const rawSobreText = rawGenerated.sobre?.text || '';
      const sobreTextWithDisclaimer = appendDestinationDisclaimer(rawSobreText);

      const enforcedContent: StructuredPackageContent = {
        ...rawGenerated,
        price: sovereignSalePrice > 0 ? sovereignSalePrice : rawGenerated.price,
        sobre: {
          ...rawGenerated.sobre,
          text: sobreTextWithDisclaimer,
        },
        pagamento: {
          ...rawGenerated.pagamento,
          observacao: paymentNoteToUse,
        },
        incluso: [
          ...(rawGenerated.incluso || []).filter(
            (item) => item.title?.trim() !== S23_FIXED_INCLUSO_ITEM.title
          ),
          S23_FIXED_INCLUSO_ITEM,
        ],
      };

      // Abre no editor para revisão humana
      setContent(enforcedContent);
      setIsEditingContent(true);
      setIsDirty(true);
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
  // SALVAMENTO ATÔMICO & PERSISTÊNCIA NO SUPABASE
  // ----------------------------------------------------
  const handleSaveContent = async () => {
    if (!content) return;

    setValidationErrors([]);
    setSaveSuccessMessage(null);
    setSaving(true);

    // 1. Garante que os dados soberanos continuem protegidos e aviso anexado
    const finalizedContent: StructuredPackageContent = {
      ...content,
      price: sovereignSalePrice > 0 ? sovereignSalePrice : content.price,
      sobre: {
        ...content.sobre,
        text: appendDestinationDisclaimer(content.sobre?.text),
      },
    };

    // 2. Validação determinística do modelo estruturado (permite observação editada pelo operador)
    const input = buildContentGenerationInput({ package: pkg });
    const contentValidation = validateStructuredContent(finalizedContent, input, {
      allowCustomPaymentNote: true,
    });

    if (!contentValidation.valid) {
      setValidationErrors(contentValidation.errors);
      setSaving(false);
      return;
    }

    try {
      // 3. Geração determinística de Markdown via markdownService com opções de generalização
      const validContent = contentValidation.data || finalizedContent;
      const md = generatePackageMarkdown(validContent, { packageData: pkg.data });
      const filename = getMarkdownFileName(validContent);

      // 4. Validação estrita do arquivo Markdown via markdownValidationService
      const mdValidation = validatePackageMarkdown(md, validContent);

      if (!mdValidation.valid) {
        setValidationErrors(mdValidation.errors);
        setSaving(false);
        return;
      }

      // 5. Persistência atômica no Supabase (somente se ambas validações passarem)
      const persistedRecord = await packageWebsiteContentService.savePackageWebsiteContent(
        pkg.id,
        validContent,
        md,
        filename
      );

      // Atualiza estado local
      setSavedRecord(persistedRecord);
      setContent(validContent);
      setMarkdownString(md);
      setMarkdownFileName(filename);
      setIsDirty(false);
      setSaveSuccessMessage('Conteúdo validado e salvo com sucesso no Pacote Base!');
      setTimeout(() => setSaveSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Erro ao salvar/validar Markdown:', err);
      setValidationErrors([err.message || 'Erro inesperado ao salvar conteúdo no Supabase.']);
    } finally {
      setSaving(false);
    }
  };

  // Carregamento inicial em andamento
  if (loadingPersisted) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)',
          fontSize: '0.875rem',
        }}
      >
        <span style={{ display: 'inline-block', marginRight: '0.5rem' }}>⏳</span>
        Carregando conteúdo do website para o Pacote Base...
      </div>
    );
  }

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
              {savedRecord && !isEditingContent && (
                <span
                  style={{
                    fontSize: '0.6875rem',
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
                  ✓ Conteúdo salvo
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Crie e revise o conteúdo público deste pacote antes de gerar o arquivo Markdown para publicação no Manager.
            </p>
          </div>

          {!savedRecord && !content && (
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

      {/* ========================================================================= */}
      {/* CENÁRIO 1: PACOTE BASE COM CONTEÚDO SALVO (VISUALIZAÇÃO / SOBREVIVE AO RELOAD) */}
      {/* ========================================================================= */}
      {savedRecord && !isEditingContent && (
        <div
          style={{
            padding: '1.5rem',
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
              gap: '1.25rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '1.125rem' }}>📄</span>
                <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {savedRecord.filename}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(34, 197, 94, 0.15)',
                    color: '#16a34a',
                  }}
                >
                  ✓ Validado e salvo
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                <span>
                  <strong>Título:</strong> {savedRecord.content.title}
                </span>
                <span>
                  <strong>Categoria:</strong> {savedRecord.content.category}
                </span>
                <span>
                  <strong>Última atualização:</strong> {formatDateTime(savedRecord.updated_at)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => {
                  setContent(savedRecord.content);
                  setMarkdownString(savedRecord.markdown);
                  setMarkdownFileName(savedRecord.filename);
                  setIsEditingContent(true);
                  setIsDirty(false);
                }}
                className="btn btn-secondary"
                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
              >
                ✏️ Editar conteúdo
              </button>
              <button
                type="button"
                onClick={() => handleDirectDownload(savedRecord.markdown, savedRecord.filename)}
                className="btn btn-primary"
                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
              >
                ⬇️ Baixar .md
              </button>
              <button
                type="button"
                onClick={() => setShowMarkdownViewer(!showMarkdownViewer)}
                className="btn btn-secondary"
                style={{ fontSize: '0.8125rem', padding: '0.5rem 0.75rem' }}
              >
                {showMarkdownViewer ? 'Ocultar Markdown' : '👁️ Ver Markdown'}
              </button>
              <button
                type="button"
                onClick={executeGeneration}
                disabled={generating}
                className="btn btn-secondary"
                style={{ fontSize: '0.8125rem', padding: '0.5rem 0.75rem', color: 'var(--text-secondary)' }}
                title="Gera uma nova proposta usando Gemini para revisão"
              >
                {generating ? 'Regenerando...' : '🔄 Regenerar com IA'}
              </button>
            </div>
          </div>

          {/* VISUALIZAÇÃO DO MARKDOWN GRAVADO (TOGGLE) */}
          {showMarkdownViewer && (
            <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Conteúdo do arquivo ({savedRecord.filename})
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(savedRecord.markdown)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                >
                  Copiar
                </button>
              </div>
              <textarea
                readOnly
                value={savedRecord.markdown}
                rows={12}
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
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CENÁRIO 2: ESTADO INICIAL (SEM CONTEÚDO SALVO AINDA) */}
      {/* ========================================================================= */}
      {!savedRecord && !content && (
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
            Nenhum conteúdo editorial salvo ainda
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
            Crie e revise o conteúdo público deste pacote antes de gerar o arquivo Markdown.
            O Gemini elaborará a proposta comercial baseando-se estritamente nos dados cadastrados
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

      {/* ========================================================================= */}
      {/* CENÁRIO 3: MODO DE EDIÇÃO DO FORMULÁRIO (PackageContentEditor) */}
      {/* ========================================================================= */}
      {content && (isEditingContent || !savedRecord) && (
        <>
          {/* BARRA SUPERIOR DE CANCELAR EDIÇÃO SE HOUVER VERSÃO SALVA */}
          {savedRecord && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
              }}
            >
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Editando versão salva em {formatDateTime(savedRecord.updated_at)}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (isDirty && !window.confirm('Existem alterações não salvas. Deseja cancelar e voltar à versão salva?')) {
                    return;
                  }
                  setContent(savedRecord.content);
                  setMarkdownString(savedRecord.markdown);
                  setMarkdownFileName(savedRecord.filename);
                  setIsEditingContent(false);
                  setIsDirty(false);
                  setValidationErrors([]);
                }}
                className="btn btn-secondary"
                style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}
              >
                ✕ Cancelar edição e voltar
              </button>
            </div>
          )}

          {/* FEEDBACK DE SUCESSO AO SALVAR */}
          {saveSuccessMessage && (
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
              <span>{saveSuccessMessage}</span>
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
            isSaving={saving}
            isGenerating={generating}
          />

          {/* PREVIEW DETERMINÍSTICO DO MARKDOWN (APÓS SALVAMENTO) */}
          {markdownString && markdownFileName && (
            <MarkdownPreviewCard
              fileName={markdownFileName}
              markdown={markdownString}
            />
          )}
        </>
      )}

      {/* MODAL DE CONFIRMAÇÃO PARA REGENERAR COM IA */}
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
              Este conteúdo possui alterações manuais. Regenerar substituirá o conteúdo atual em edição por uma nova proposta da IA. Deseja continuar?
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
    </div>
  );
};
