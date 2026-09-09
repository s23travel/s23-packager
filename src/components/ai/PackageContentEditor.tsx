import React, { useState, useEffect } from 'react';
import { Package, StructuredPackageContent, InclusoItem, RoteiroItem } from '../../types';
import { S23_FIXED_INCLUSO_ITEM, S23_OBLIGATORY_PAYMENT_NOTE } from '../../services/markdownService';

interface PackageContentEditorProps {
  content: StructuredPackageContent;
  onChange: (updated: StructuredPackageContent) => void;
  basePackage: Package;
  isDirty: boolean;
  onSave: () => void;
  onRegenerate: () => void;
  isSaving?: boolean;
  isGenerating?: boolean;
}

/**
 * Função utilitária para converter título em slug válido: letras minúsculas, números e hífens
 */
function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '-') // substitui caracteres especiais por hífen
    .replace(/^-+|-+$/g, ''); // remove hífens do início e fim
}

/**
 * Componente interno para exibição de thumbnail de imagem com fallback visual
 */
const ImageThumbnail: React.FC<{ url?: string; label: string; aspectRatio?: string }> = ({
  url,
  label,
  aspectRatio = '16/9',
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [url]);

  if (!url || !url.trim()) {
    return (
      <div
        style={{
          width: '100%',
          aspectRatio,
          backgroundColor: 'var(--bg-main)',
          border: '1px dashed var(--border-color)',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.75rem',
          padding: '0.5rem',
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>🖼️</span>
        <span>Sem imagem ({label})</span>
      </div>
    );
  }

  if (hasError) {
    return (
      <div
        style={{
          width: '100%',
          aspectRatio,
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          border: '1px dashed rgba(239, 68, 68, 0.4)',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ef4444',
          fontSize: '0.75rem',
          padding: '0.5rem',
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>⚠️</span>
        <span>Imagem não carregou</span>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        aspectRatio,
        borderRadius: '6px',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-main)',
        position: 'relative',
      }}
    >
      <img
        src={url}
        alt={label}
        onError={() => setHasError(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
};

export const PackageContentEditor: React.FC<PackageContentEditorProps> = ({
  content,
  onChange,
  basePackage,
  isDirty,
  onSave,
  onRegenerate,
  isSaving = false,
  isGenerating = false,
}) => {
  // Controle de slug automático vs manual
  const [isSlugManual, setIsSlugManual] = useState(false);

  // Atualizador genérico de campos de primeiro nível
  const updateField = <K extends keyof StructuredPackageContent>(
    key: K,
    value: StructuredPackageContent[K]
  ) => {
    onChange({
      ...content,
      [key]: value,
    });
  };

  // Atualização do título com atualização inteligente do slug
  const handleTitleChange = (newTitle: string) => {
    const updated = { ...content, title: newTitle };
    if (!isSlugManual) {
      updated.slug = titleToSlug(newTitle);
    }
    onChange(updated);
  };

  // Edição manual do slug desativa sincronização automática
  const handleSlugChange = (newSlug: string) => {
    setIsSlugManual(true);
    updateField('slug', newSlug);
  };

  // Reset do slug para modo automático
  const handleResetSlugToAuto = () => {
    setIsSlugManual(false);
    updateField('slug', titleToSlug(content.title));
  };

  // ----------------------------------------------------
  // MANIPULAÇÃO DE ROTEIRO
  // ----------------------------------------------------
  const handleAddRoteiroDay = () => {
    const currentRoteiro = content.roteiro || [];
    const nextDayNum = currentRoteiro.length + 1;
    const updatedRoteiro: RoteiroItem[] = [
      ...currentRoteiro,
      {
        title: `Dia ${nextDayNum} — Programação`,
        desc: '',
      },
    ];
    updateField('roteiro', updatedRoteiro);
  };

  const handleUpdateRoteiroDay = (index: number, field: 'title' | 'desc', value: string) => {
    const currentRoteiro = [...(content.roteiro || [])];
    if (currentRoteiro[index]) {
      currentRoteiro[index] = {
        ...currentRoteiro[index],
        [field]: value,
      };
      updateField('roteiro', currentRoteiro);
    }
  };

  const handleRemoveRoteiroDay = (index: number) => {
    const currentRoteiro = [...(content.roteiro || [])];
    currentRoteiro.splice(index, 1);
    updateField('roteiro', currentRoteiro);
  };

  // ----------------------------------------------------
  // MANIPULAÇÃO DE ITENS INCLUSOS
  // ----------------------------------------------------
  const handleAddInclusoItem = () => {
    const currentIncluso = content.incluso || [];
    const updatedIncluso: InclusoItem[] = [
      ...currentIncluso,
      {
        icon: 'bed',
        title: '',
        desc: '',
      },
    ];
    updateField('incluso', updatedIncluso);
  };

  const handleUpdateInclusoItem = (index: number, field: keyof InclusoItem, value: string) => {
    const currentIncluso = [...(content.incluso || [])];
    if (currentIncluso[index]) {
      currentIncluso[index] = {
        ...currentIncluso[index],
        [field]: value,
      };
      updateField('incluso', currentIncluso);
    }
  };

  const handleRemoveInclusoItem = (index: number) => {
    const currentIncluso = [...(content.incluso || [])];
    const item = currentIncluso[index];
    // Se tentar remover o item fixo S23, avisar ou restaurar
    if (item && item.title.trim() === S23_FIXED_INCLUSO_ITEM.title) {
      alert('O item "Guia exclusivo S23" é obrigatório e será mantido no pacote.');
      return;
    }
    currentIncluso.splice(index, 1);
    updateField('incluso', currentIncluso);
  };

  // ----------------------------------------------------
  // MANIPULAÇÃO DE NÃO INCLUI
  // ----------------------------------------------------
  const handleAddNaoInclusoItem = () => {
    const currentNaoIncluso = content.naoIncluso || [];
    updateField('naoIncluso', [...currentNaoIncluso, '']);
  };

  const handleUpdateNaoInclusoItem = (index: number, value: string) => {
    const currentNaoIncluso = [...(content.naoIncluso || [])];
    currentNaoIncluso[index] = value;
    updateField('naoIncluso', currentNaoIncluso);
  };

  const handleRemoveNaoInclusoItem = (index: number) => {
    const currentNaoIncluso = [...(content.naoIncluso || [])];
    currentNaoIncluso.splice(index, 1);
    updateField('naoIncluso', currentNaoIncluso);
  };

  // ----------------------------------------------------
  // MANIPULAÇÃO DE FORMAS DE PAGAMENTO
  // ----------------------------------------------------
  const handleAddFormaPagamento = () => {
    const currentFormas = content.pagamento?.formas || [];
    updateField('pagamento', {
      ...content.pagamento,
      formas: [...currentFormas, ''],
    });
  };

  const handleUpdateFormaPagamento = (index: number, value: string) => {
    const currentFormas = [...(content.pagamento?.formas || [])];
    currentFormas[index] = value;
    updateField('pagamento', {
      ...content.pagamento,
      formas: currentFormas,
    });
  };

  const handleRemoveFormaPagamento = (index: number) => {
    const currentFormas = [...(content.pagamento?.formas || [])];
    currentFormas.splice(index, 1);
    updateField('pagamento', {
      ...content.pagamento,
      formas: currentFormas,
    });
  };

  // Dados soberanos do pacote base
  const pData = basePackage.data || {};
  const basePriceFormatted =
    typeof content.price === 'number'
      ? `${basePackage.base_currency} ${content.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      : `${content.price}`;

  const hotelBase = pData.lodging?.[0]?.name || 'Não especificado';
  const datesBase = pData.dates?.startDate
    ? `${pData.dates.startDate} a ${pData.dates.endDate || '—'}`
    : 'Datas sob consulta';

  const isPaymentNoteConform =
    content.pagamento?.observacao?.trim() === S23_OBLIGATORY_PAYMENT_NOTE.trim();

  return (
    <div
      className="package-content-editor"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        marginTop: '1rem',
      }}
    >
      {/* BARRA SUPERIOR DE AÇÕES & STATUS */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1rem 1.25rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            📝 Editor de Conteúdo para Website
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
            }}
          >
            Ref: {basePackage.reference}
          </span>
          {isDirty ? (
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#d97706',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              ● Alterações pendentes de salvamento
            </span>
          ) : (
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              ✓ Conteúdo sincronizado
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isGenerating || isSaving}
            className="btn btn-secondary"
            style={{ fontSize: '0.8125rem', padding: '0.45rem 0.85rem' }}
          >
            {isGenerating ? 'Regenerando...' : '🔄 Regenerar com IA'}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || isGenerating}
            className="btn btn-primary"
            style={{ fontSize: '0.8125rem', padding: '0.45rem 1.15rem' }}
          >
            {isSaving ? 'Validando e Salvando...' : '💾 Salvar conteúdo'}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 1: INFORMAÇÕES PRINCIPAIS & PUBLICAÇÃO */}
      {/* ========================================================================= */}
      <div
        className="form-section"
        style={{
          padding: '1.25rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
          1. Informações Principais &amp; Publicação
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="content-title">
              Título do Pacote *
            </label>
            <input
              id="content-title"
              type="text"
              className="form-input"
              value={content.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Ex.: Safári no Serengeti &amp; Zanzibar"
              required
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <label className="form-label" htmlFor="content-slug" style={{ margin: 0 }}>
                Slug (URL no Website) *
              </label>
              {isSlugManual && (
                <button
                  type="button"
                  onClick={handleResetSlugToAuto}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '0.6875rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  Sincronizar com Título
                </button>
              )}
            </div>
            <input
              id="content-slug"
              type="text"
              className="form-input"
              value={content.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="safari-serengeti-zanzibar"
              required
            />
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
              URL final: /pacotes/{content.slug}.md
            </span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="content-category">
              Categoria *
            </label>
            <input
              id="content-category"
              type="text"
              className="form-input"
              value={content.category}
              onChange={(e) => updateField('category', e.target.value)}
              placeholder="Ex.: África, Europa, Cruzeiros..."
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="content-subtitle">
              Subtítulo (Frase de Efeito)
            </label>
            <input
              id="content-subtitle"
              type="text"
              className="form-input"
              value={content.subtitle || ''}
              onChange={(e) => updateField('subtitle', e.target.value)}
              placeholder="Ex.: Uma jornada inesquecível entre as savanas e praias paradisíacas."
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="content-cta">
              Rótulo do Botão CTA
            </label>
            <input
              id="content-cta"
              type="text"
              className="form-input"
              value={content.ctaLabel || ''}
              onChange={(e) => updateField('ctaLabel', e.target.value)}
              placeholder="Quero garantir minha vaga"
            />
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" htmlFor="content-excerpt">
              Excerpt (Resumo Curto para o Card da Listagem) *
            </label>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {content.excerpt?.length || 0} caracteres
            </span>
          </div>
          <textarea
            id="content-excerpt"
            rows={2}
            className="form-textarea"
            value={content.excerpt}
            onChange={(e) => updateField('excerpt', e.target.value)}
            placeholder="Frase concisa e chamativa para exibição no card de listagem..."
            required
          />
        </div>

        <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={content.published}
              onChange={(e) => updateField('published', e.target.checked)}
            />
            <span>Publicado no Website</span>
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={content.featured}
              onChange={(e) => updateField('featured', e.target.checked)}
            />
            <span>Pacote em Destaque</span>
          </label>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 2: IMAGENS DO WEBSITE (4 IMAGENS SUPORTADAS PELO WEBSITE/MANAGER) */}
      {/* ========================================================================= */}
      <div
        className="form-section"
        style={{
          padding: '1.25rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
            2. Imagens do Website
          </h4>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Campos de imagem suportados pelo modelo do website S23. Insira URLs absolutas (https://...) ou caminhos relativos (/imagem.jpg).
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {/* 1. Hero Image */}
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--bg-main)',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label className="form-label" htmlFor="heroImage" style={{ margin: 0, fontWeight: 600 }}>
                Hero Image (Capa da Página) *
              </label>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>1920×1080 (16:9)</span>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <ImageThumbnail url={content.heroImage} label="Hero Image" aspectRatio="16/9" />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="heroImage"
                type="text"
                className="form-input"
                style={{ fontSize: '0.8125rem' }}
                value={content.heroImage || ''}
                onChange={(e) => updateField('heroImage', e.target.value)}
                placeholder="https://.../capa.jpg"
              />
              {content.heroImage && (
                <button
                  type="button"
                  onClick={() => updateField('heroImage', '')}
                  className="btn btn-secondary"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  title="Limpar imagem"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 2. Card Image */}
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--bg-main)',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label className="form-label" htmlFor="cardImage" style={{ margin: 0, fontWeight: 600 }}>
                Card Image (Card da Listagem) *
              </label>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>1200×900 (4:3)</span>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <ImageThumbnail url={content.cardImage} label="Card Image" aspectRatio="4/3" />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="cardImage"
                type="text"
                className="form-input"
                style={{ fontSize: '0.8125rem' }}
                value={content.cardImage || ''}
                onChange={(e) => updateField('cardImage', e.target.value)}
                placeholder="https://.../card.jpg"
              />
              {content.cardImage && (
                <button
                  type="button"
                  onClick={() => updateField('cardImage', '')}
                  className="btn btn-secondary"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  title="Limpar imagem"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 3. Imagem Destaque */}
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--bg-main)',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label className="form-label" htmlFor="imagemDestaque" style={{ margin: 0, fontWeight: 600 }}>
                Imagem de Destaque (Meio da Página)
              </label>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Panorâmica</span>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <ImageThumbnail url={content.imagemDestaque} label="Destaque" aspectRatio="16/9" />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="imagemDestaque"
                type="text"
                className="form-input"
                style={{ fontSize: '0.8125rem' }}
                value={content.imagemDestaque || ''}
                onChange={(e) => updateField('imagemDestaque', e.target.value)}
                placeholder="https://.../destaque.jpg"
              />
              {content.imagemDestaque && (
                <button
                  type="button"
                  onClick={() => updateField('imagemDestaque', '')}
                  className="btn btn-secondary"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  title="Limpar imagem"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 4. Imagem Sobre o Destino */}
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--bg-main)',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label className="form-label" htmlFor="sobreImage" style={{ margin: 0, fontWeight: 600 }}>
                Imagem "Sobre o Destino"
              </label>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Bloco Sobre</span>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <ImageThumbnail url={content.sobre?.image} label="Sobre o Destino" aspectRatio="4/3" />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="sobreImage"
                type="text"
                className="form-input"
                style={{ fontSize: '0.8125rem' }}
                value={content.sobre?.image || ''}
                onChange={(e) =>
                  updateField('sobre', {
                    ...content.sobre,
                    image: e.target.value,
                  })
                }
                placeholder="https://.../destino.jpg"
              />
              {content.sobre?.image && (
                <button
                  type="button"
                  onClick={() =>
                    updateField('sobre', {
                      ...content.sobre,
                      image: '',
                    })
                  }
                  className="btn btn-secondary"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  title="Limpar imagem"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 3: DADOS OPERACIONAIS & COMERCIAIS SOBERANOS */}
      {/* ========================================================================= */}
      <div
        className="form-section"
        style={{
          padding: '1.25rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            borderRadius: '6px',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            marginBottom: '1rem',
            fontSize: '0.8125rem',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>🛡️</span>
          <span>
            <strong>Dados Comerciais Soberanos do Pacote Base:</strong> Preço, moeda, datas e hotel constituem a autoridade oficial e não são alterados silenciosamente pela IA.
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label" style={{ color: 'var(--text-muted)' }}>
              Preço de Venda do Pacote (Soberano)
            </label>
            <div
              style={{
                padding: '0.6rem 0.75rem',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {basePriceFormatted}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ color: 'var(--text-muted)' }}>
              Moeda Base
            </label>
            <div
              style={{
                padding: '0.6rem 0.75rem',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
              }}
            >
              {basePackage.base_currency}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="content-date">
              Período / Data da Viagem
            </label>
            <input
              id="content-date"
              type="text"
              className="form-input"
              value={content.date || ''}
              onChange={(e) => updateField('date', e.target.value)}
              placeholder={datesBase}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="content-duracao">
              Duração da Viagem
            </label>
            <input
              id="content-duracao"
              type="text"
              className="form-input"
              value={content.duracao || ''}
              onChange={(e) => updateField('duracao', e.target.value)}
              placeholder="Ex.: 8 dias • 7 noites"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="content-origem">
              Cidade de Origem / Saída
            </label>
            <input
              id="content-origem"
              type="text"
              className="form-input"
              value={content.origem || ''}
              onChange={(e) => updateField('origem', e.target.value)}
              placeholder="Ex.: São Paulo/SP ou Porto (OPO)"
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ color: 'var(--text-muted)' }}>
              Hotel Referência (Pacote Base)
            </label>
            <div
              style={{
                padding: '0.6rem 0.75rem',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
              }}
            >
              {hotelBase}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 4: SOBRE O DESTINO & FATOS */}
      {/* ========================================================================= */}
      <div
        className="form-section"
        style={{
          padding: '1.25rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
          4. Sobre o Destino &amp; Informações Práticas
        </h4>

        <div className="form-group">
          <label className="form-label" htmlFor="sobre-title">
            Título do Bloco Sobre *
          </label>
          <input
            id="sobre-title"
            type="text"
            className="form-input"
            value={content.sobre?.title || ''}
            onChange={(e) =>
              updateField('sobre', {
                ...content.sobre,
                title: e.target.value,
              })
            }
            placeholder="Ex.: Sobre o Serengeti e as Maravilhas da Tanzânia"
            required
          />
        </div>

        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label className="form-label" htmlFor="sobre-text">
            Texto Descritivo do Destino (Apresentação Geral) *
          </label>
          <textarea
            id="sobre-text"
            rows={5}
            className="form-textarea"
            value={content.sobre?.text || ''}
            onChange={(e) =>
              updateField('sobre', {
                ...content.sobre,
                text: e.target.value,
              })
            }
            placeholder="Apresentação aprofundada do destino..."
            required
          />
        </div>

        <div style={{ marginTop: '1.25rem' }}>
          <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
            Fatos Rápidos &amp; Informações Úteis (infoDestino)
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>
                Localização
              </label>
              <input
                type="text"
                className="form-input"
                value={content.infoDestino?.localizacao || ''}
                onChange={(e) =>
                  updateField('infoDestino', {
                    ...content.infoDestino,
                    localizacao: e.target.value,
                  })
                }
                placeholder="Ex.: Leste da África"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>
                Clima / Melhor Época
              </label>
              <input
                type="text"
                className="form-input"
                value={content.infoDestino?.clima || ''}
                onChange={(e) =>
                  updateField('infoDestino', {
                    ...content.infoDestino,
                    clima: e.target.value,
                  })
                }
                placeholder="Ex.: Tropical ameno"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>
                Idioma &amp; Cultura
              </label>
              <input
                type="text"
                className="form-input"
                value={content.infoDestino?.idiomaCultura || ''}
                onChange={(e) =>
                  updateField('infoDestino', {
                    ...content.infoDestino,
                    idiomaCultura: e.target.value,
                  })
                }
                placeholder="Ex.: Suaíli e Inglês"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>
                Documentação &amp; Visto
              </label>
              <input
                type="text"
                className="form-input"
                value={content.infoDestino?.documentacao || ''}
                onChange={(e) =>
                  updateField('infoDestino', {
                    ...content.infoDestino,
                    documentacao: e.target.value,
                  })
                }
                placeholder="Ex.: Passaporte válido por 6 meses e febre amarela"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 5: ROTEIRO DIA A DIA */}
      {/* ========================================================================= */}
      <div
        className="form-section"
        style={{
          padding: '1.25rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
              5. Roteiro Dia a Dia
            </h4>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Detalhamento de cada dia da viagem. Omitir se o pacote não tiver programação diária.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddRoteiroDay}
            className="btn btn-secondary"
            style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}
          >
            + Adicionar Dia
          </button>
        </div>

        {(!content.roteiro || content.roteiro.length === 0) ? (
          <div
            style={{
              padding: '1.5rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-main)',
              borderRadius: '6px',
              border: '1px dashed var(--border-color)',
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
            }}
          >
            Nenhum dia de roteiro cadastrado. Clique em "+ Adicionar Dia" para estruturar a programação.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {content.roteiro.map((dia, index) => (
              <div
                key={index}
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--bg-main)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span
                    style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: 'var(--primary)',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    #{index + 1}
                  </span>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontWeight: 600, flex: 1 }}
                    value={dia.title}
                    onChange={(e) => handleUpdateRoteiroDay(index, 'title', e.target.value)}
                    placeholder={`Dia ${index + 1} — Título`}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveRoteiroDay(index)}
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.65rem', color: '#ef4444', fontSize: '0.75rem' }}
                  >
                    Remover
                  </button>
                </div>

                <textarea
                  rows={2}
                  className="form-textarea"
                  value={dia.desc || ''}
                  onChange={(e) => handleUpdateRoteiroDay(index, 'desc', e.target.value)}
                  placeholder="Descrição das atividades e programações deste dia..."
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 6: ITENS INCLUSOS */}
      {/* ========================================================================= */}
      <div
        className="form-section"
        style={{
          padding: '1.25rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
              6. Itens Inclusos *
            </h4>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Serviços e comodidades inclusas. O item "Guia exclusivo S23" é mandatório.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddInclusoItem}
            className="btn btn-secondary"
            style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}
          >
            + Adicionar Item Incluso
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {content.incluso?.map((item, index) => {
            const isFixed = item.title?.trim() === S23_FIXED_INCLUSO_ITEM.title;
            return (
              <div
                key={index}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 1fr auto',
                  gap: '0.5rem',
                  alignItems: 'center',
                  padding: '0.75rem',
                  backgroundColor: isFixed ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-main)',
                  borderRadius: '6px',
                  border: isFixed ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-color)',
                }}
              >
                {/* Ícone */}
                <select
                  className="form-input"
                  style={{ fontSize: '0.8125rem', padding: '0.4rem' }}
                  value={item.icon || 'bed'}
                  onChange={(e) => handleUpdateInclusoItem(index, 'icon', e.target.value)}
                >
                  <option value="bed">🛏️ bed</option>
                  <option value="plane">✈️ plane</option>
                  <option value="coffee">☕ coffee</option>
                  <option value="car">🚗 car</option>
                  <option value="camera">📷 camera</option>
                  <option value="shield">🛡️ shield</option>
                  <option value="users">👥 users</option>
                  <option value="gift">🎁 gift</option>
                </select>

                {/* Título */}
                <div>
                  <input
                    type="text"
                    className="form-input"
                    value={item.title}
                    onChange={(e) => handleUpdateInclusoItem(index, 'title', e.target.value)}
                    placeholder="Título do item..."
                    readOnly={isFixed}
                    style={isFixed ? { backgroundColor: 'var(--bg-main)', fontWeight: 600 } : {}}
                  />
                  {isFixed && (
                    <span style={{ fontSize: '0.6875rem', color: 'var(--primary)', marginTop: '0.15rem', display: 'block' }}>
                      ★ Item Mandatório S23
                    </span>
                  )}
                </div>

                {/* Descrição */}
                <input
                  type="text"
                  className="form-input"
                  value={item.desc || ''}
                  onChange={(e) => handleUpdateInclusoItem(index, 'desc', e.target.value)}
                  placeholder="Descrição opcional..."
                />

                {/* Ação */}
                <button
                  type="button"
                  onClick={() => handleRemoveInclusoItem(index)}
                  className="btn btn-secondary"
                  disabled={isFixed}
                  style={{
                    padding: '0.35rem 0.65rem',
                    color: isFixed ? 'var(--text-muted)' : '#ef4444',
                    fontSize: '0.75rem',
                    cursor: isFixed ? 'not-allowed' : 'pointer',
                  }}
                  title={isFixed ? 'Item mandatório da S23' : 'Remover item'}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 7: NÃO INCLUI */}
      {/* ========================================================================= */}
      <div
        className="form-section"
        style={{
          padding: '1.25rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
              7. Não Inclui
            </h4>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Lista clara de despesas e serviços que ficam a cargo do cliente.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddNaoInclusoItem}
            className="btn btn-secondary"
            style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}
          >
            + Adicionar Item Não Incluso
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {content.naoIncluso?.map((item, index) => (
            <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                className="form-input"
                value={item}
                onChange={(e) => handleUpdateNaoInclusoItem(index, e.target.value)}
                placeholder="Ex.: Passagens aéreas internacionais, taxas locais..."
              />
              <button
                type="button"
                onClick={() => handleRemoveNaoInclusoItem(index)}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.65rem', color: '#ef4444', fontSize: '0.75rem' }}
                title="Remover"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 8: CONDIÇÕES DE PAGAMENTO */}
      {/* ========================================================================= */}
      <div
        className="form-section"
        style={{
          padding: '1.25rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
          8. Condições Comerciais &amp; Pagamento *
        </h4>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label className="form-label" htmlFor="pagamento-valor">
            Texto Descritivo de Valor
          </label>
          <input
            id="pagamento-valor"
            type="text"
            className="form-input"
            value={content.pagamento?.valor || ''}
            onChange={(e) =>
              updateField('pagamento', {
                ...content.pagamento,
                valor: e.target.value,
              })
            }
            placeholder="Ex.: R$ 42.900,00 por pessoa em quarto duplo"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label className="form-label" style={{ margin: 0 }}>
              Formas de Pagamento Sugeridas
            </label>
            <button
              type="button"
              onClick={handleAddFormaPagamento}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            >
              + Adicionar Forma
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(content.pagamento?.formas || []).map((forma, index) => (
              <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-input"
                  value={forma}
                  onChange={(e) => handleUpdateFormaPagamento(index, e.target.value)}
                  placeholder="Ex.: Entrada de 30% + saldo em até 10x sem juros"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveFormaPagamento(index)}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.65rem', color: '#ef4444', fontSize: '0.75rem' }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <label className="form-label" htmlFor="pagamento-observacao" style={{ margin: 0 }}>
              Observação Obrigatória de Pagamento *
            </label>
            {isPaymentNoteConform ? (
              <span style={{ fontSize: '0.6875rem', color: '#16a34a', fontWeight: 600 }}>
                ✓ Conforme regra oficial S23
              </span>
            ) : (
              <span style={{ fontSize: '0.6875rem', color: '#ef4444', fontWeight: 600 }}>
                ⚠️ Deve corresponder à frase oficial
              </span>
            )}
          </div>
          <textarea
            id="pagamento-observacao"
            rows={2}
            className="form-textarea"
            value={content.pagamento?.observacao || ''}
            onChange={(e) =>
              updateField('pagamento', {
                ...content.pagamento,
                observacao: e.target.value,
              })
            }
            required
          />
          {!isPaymentNoteConform && (
            <button
              type="button"
              onClick={() =>
                updateField('pagamento', {
                  ...content.pagamento,
                  observacao: S23_OBLIGATORY_PAYMENT_NOTE,
                })
              }
              style={{
                marginTop: '0.25rem',
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Restaurar frase padrão da S23
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 9: INFORMAÇÕES PERSONALIZADAS (CUSTOM INFO) */}
      {/* ========================================================================= */}
      <div
        className="form-section"
        style={{
          padding: '1.25rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
          9. Informações Personalizadas (Custom Info)
        </h4>
        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Texto livre em Markdown para observações operacionais específicas que não se encaixam nas outras seções (ex: particularidades de traslado, notas sobre seguro).
        </p>
        <textarea
          rows={3}
          className="form-textarea"
          value={content.customInfo || ''}
          onChange={(e) => updateField('customInfo', e.target.value)}
          placeholder="Texto livre formatado em Markdown..."
        />
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 10: SEO */}
      {/* ========================================================================= */}
      <div
        className="form-section"
        style={{
          padding: '1.25rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
          10. Otimização para Buscadores (SEO) *
        </h4>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" htmlFor="seo-title">
              SEO Title (Título da Aba / Google) *
            </label>
            <span
              style={{
                fontSize: '0.75rem',
                color: (content.seoTitle?.length || 0) > 60 ? '#ef4444' : 'var(--text-muted)',
                fontWeight: (content.seoTitle?.length || 0) > 60 ? 600 : 400,
              }}
            >
              {content.seoTitle?.length || 0} / 60 caracteres recomendados
            </span>
          </div>
          <input
            id="seo-title"
            type="text"
            className="form-input"
            value={content.seoTitle || ''}
            onChange={(e) => updateField('seoTitle', e.target.value)}
            placeholder="Título otimizado para o Google..."
            required
          />
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" htmlFor="seo-description">
              SEO Description (Meta Descrição) *
            </label>
            <span
              style={{
                fontSize: '0.75rem',
                color: (content.seoDescription?.length || 0) > 160 ? '#ef4444' : 'var(--text-muted)',
                fontWeight: (content.seoDescription?.length || 0) > 160 ? 600 : 400,
              }}
            >
              {content.seoDescription?.length || 0} / 160 caracteres recomendados
            </span>
          </div>
          <textarea
            id="seo-description"
            rows={2}
            className="form-textarea"
            value={content.seoDescription || ''}
            onChange={(e) => updateField('seoDescription', e.target.value)}
            placeholder="Resumo envolvente que atrai cliques nas buscas..."
            required
          />
        </div>
      </div>

      {/* BARRA INFERIOR DE AÇÕES */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '1rem',
          padding: '1rem 1.25rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isGenerating || isSaving}
          className="btn btn-secondary"
        >
          {isGenerating ? 'Regenerando...' : '🔄 Regenerar com IA'}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || isGenerating}
          className="btn btn-primary"
          style={{ minWidth: '160px' }}
        >
          {isSaving ? 'Validando e Salvando...' : '💾 Salvar conteúdo'}
        </button>
      </div>
    </div>
  );
};
