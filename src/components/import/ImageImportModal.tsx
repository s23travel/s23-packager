import React, { useState, useRef, useEffect } from 'react';
import { ImportedPackageData } from '../../types';
import {
  validateImageFilesBatch,
  importPackageDataFromImages,
  MAX_IMAGES_PER_ANALYSIS,
} from '../../services/imageImportService';

interface ImageImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: ImportedPackageData) => void;
  targetType?: 'package' | 'quote';
}

type Step = 'select' | 'analyzing' | 'review';

interface SelectedImageItem {
  id: string;
  file: File;
  previewUrl: string;
}

export const ImageImportModal: React.FC<ImageImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  targetType = 'package',
}) => {
  const [step, setStep] = useState<Step>('select');
  const [selectedImages, setSelectedImages] = useState<SelectedImageItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ImportedPackageData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Limpa estado ao fechar
  useEffect(() => {
    if (!isOpen) {
      setStep('select');
      selectedImages.forEach((img) => {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      });
      setSelectedImages([]);
      setErrorMsg(null);
      setExtractedData(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFilesAdd = (filesToAdd: FileList | File[]) => {
    setErrorMsg(null);
    const filesArray = Array.from(filesToAdd);
    if (filesArray.length === 0) return;

    const validation = validateImageFilesBatch(filesArray, selectedImages.length);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Erro na seleção de arquivos.');
      return;
    }

    const newItems: SelectedImageItem[] = validation.validFiles.map((file) => ({
      id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setSelectedImages((prev) => [...prev, ...newItems]);
  };

  const handleRemoveImage = (id: string) => {
    setErrorMsg(null);
    setSelectedImages((prev) => {
      const itemToRemove = prev.find((item) => item.id === id);
      if (itemToRemove?.previewUrl) {
        URL.revokeObjectURL(itemToRemove.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdd(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleAnalyze = async () => {
    if (selectedImages.length === 0) return;

    setStep('analyzing');
    setErrorMsg(null);

    const files = selectedImages.map((img) => img.file);
    const result = await importPackageDataFromImages(files);

    if (!result.success || !result.data) {
      setErrorMsg(result.error || 'Falha ao analisar as imagens.');
      setStep('select');
      return;
    }

    setExtractedData(result.data);
    setStep('review');
  };

  const handleApply = () => {
    if (!extractedData) return;
    onImport(extractedData);
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: step === 'review' ? '780px' : '620px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div className="modal-header">
          <div>
            <h3 className="modal-title">
              {step === 'review'
                ? 'Revisão dos Dados Extraídos das Imagens'
                : 'Importar Dados de Imagem (Análise Conjunta)'}
            </h3>
            <p className="modal-subtitle">
              {step === 'review'
                ? 'Confira as informações consolidadas identificadas antes de aplicar ao formulário.'
                : `Carregue até 10 imagens de cotações para consolidar e preencher o ${
                    targetType === 'package' ? 'Novo Pacote' : 'Nova Cotação'
                  } com IA.`}
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>

        {/* Mensagem de Erro se houver */}
        {errorMsg && (
          <div className="modal-alert-danger">
            <span>⚠️ {errorMsg}</span>
          </div>
        )}

        {/* Conteúdo do Modal conforme o Step */}
        <div className="modal-body">
          {/* STEP 1: Seleção de Múltiplas Imagens */}
          {step === 'select' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png, image/jpeg, image/jpg"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files) {
                    handleFilesAdd(e.target.files);
                    e.target.value = '';
                  }
                }}
              />

              {selectedImages.length === 0 ? (
                /* Dropzone inicial vazio */
                <div
                  className={`image-dropzone ${isDragging ? 'dragging' : ''}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="dropzone-prompt">
                    <div className="dropzone-icon">📷</div>
                    <h4>Arraste uma ou mais imagens aqui ou clique para selecionar</h4>
                    <p>Formatos aceitos: PNG, JPG ou JPEG (máximo 8MB por imagem, até 10 imagens)</p>
                  </div>
                </div>
              ) : (
                /* Galeria com imagens selecionadas */
                <div className="dropzone-gallery-container">
                  <div className="dropzone-gallery-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {selectedImages.length === 1
                          ? '1 imagem selecionada'
                          : `${selectedImages.length} imagens selecionadas`}
                      </span>
                      <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                        Limite: {MAX_IMAGES_PER_ANALYSIS}
                      </span>
                    </div>
                    {selectedImages.length < MAX_IMAGES_PER_ANALYSIS && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="btn btn-sm btn-secondary"
                        style={{ fontSize: '12px', padding: '0.25rem 0.65rem' }}
                      >
                        + Adicionar mais imagens
                      </button>
                    )}
                  </div>

                  <div
                    className={`dropzone-gallery-wrapper ${isDragging ? 'dragging' : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    style={{
                      border: isDragging
                        ? '2px dashed var(--accent-primary)'
                        : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '0.5rem',
                      backgroundColor: isDragging
                        ? 'var(--accent-soft)'
                        : 'var(--bg-surface-elevated)',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <div className="dropzone-gallery-grid">
                      {selectedImages.map((img) => (
                        <div key={img.id} className="image-preview-card">
                          <button
                            type="button"
                            className="image-card-remove"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveImage(img.id);
                            }}
                            title="Remover imagem"
                            aria-label={`Remover ${img.file.name}`}
                          >
                            ✕
                          </button>
                          <img
                            src={img.previewUrl}
                            alt={img.file.name}
                            className="image-card-thumb"
                          />
                          <span className="image-card-name" title={img.file.name}>
                            {img.file.name}
                          </span>
                          <span className="image-card-size">{formatFileSize(img.file.size)}</span>
                        </div>
                      ))}

                      {selectedImages.length < MAX_IMAGES_PER_ANALYSIS && (
                        <div
                          className="dropzone-add-card"
                          onClick={() => fileInputRef.current?.click()}
                          title="Adicionar mais imagens"
                        >
                          <span>+</span>
                          <small>Adicionar</small>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="modal-notice" style={{ marginTop: '0.75rem' }}>
                <small>
                  🔒 <strong>Privacidade e Segurança</strong>: As imagens são enviadas exclusivamente
                  ao backend para análise contextual consolidada e não são armazenadas permanentemente.
                </small>
              </div>
            </div>
          )}

          {/* STEP 2: Processamento Conjunto com IA */}
          {step === 'analyzing' && (
            <div className="modal-loading-container">
              <div className="spinner-large" />
              <h4 style={{ marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                Analisando {selectedImages.length} imagem(ns) com IA...
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Consolidando informações de voos, hospedagem, transfers, datas, passageiros e custos em uma análise única.
              </p>
            </div>
          )}

          {/* STEP 3: Tela de Revisão dos Dados Consolidados */}
          {step === 'review' && extractedData && (
            <div className="review-container">
              {/* Alerta de Conflitos se identificado entre imagens */}
              {extractedData.conflicts && extractedData.conflicts.length > 0 && (
                <div className="review-conflicts-box">
                  <div className="review-conflicts-header">
                    <span>⚠️</span>
                    <span>Avisos de Conflitos Detectados (Revise antes de salvar)</span>
                  </div>
                  <ul className="review-conflicts-list">
                    {extractedData.conflicts.map((conf, idx) => (
                      <li key={idx}>{conf}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Título do Pacote se identificado */}
              {extractedData.packageName && (
                <div className="review-section-box highlight">
                  <span className="review-box-label">Nome / Destino Identificado</span>
                  <p className="review-box-val" style={{ fontSize: '1.05rem', fontWeight: 600 }}>
                    {extractedData.packageName}
                  </p>
                </div>
              )}

              <div className="review-grid-2">
                {/* 1. Datas e Duração */}
                <div className="review-section-box">
                  <span className="review-box-label">📅 Datas da Viagem</span>
                  <div className="review-row">
                    <span>Partida:</span>
                    <strong>{extractedData.dates.start || 'Não informado'}</strong>
                  </div>
                  <div className="review-row">
                    <span>Retorno:</span>
                    <strong>{extractedData.dates.end || 'Não informado'}</strong>
                  </div>
                </div>

                {/* 2. Passageiros */}
                <div className="review-section-box">
                  <span className="review-box-label">👥 Passageiros</span>
                  <div className="review-row">
                    <span>Adultos:</span>
                    <strong>
                      {extractedData.passengers.adults !== null
                        ? extractedData.passengers.adults
                        : 'Não informado'}
                    </strong>
                  </div>
                  <div className="review-row">
                    <span>Crianças:</span>
                    <strong>
                      {extractedData.passengers.children.length > 0
                        ? `${extractedData.passengers.children.length} (${extractedData.passengers.children
                            .map((c) => (c.age !== null ? `${c.age}a` : 'idade n/i'))
                            .join(', ')})`
                        : '0'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* 3. Transportes */}
              <div className="review-section-box" style={{ marginTop: '0.75rem' }}>
                <span className="review-box-label">✈️ Transporte Base</span>
                <div className="review-grid-2" style={{ marginTop: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ida</span>
                    <p style={{ fontWeight: 500, margin: '2px 0' }}>
                      {extractedData.outbound.route || 'Não informado'}
                    </p>
                    <small style={{ color: 'var(--text-secondary)' }}>
                      {[
                        extractedData.outbound.company,
                        extractedData.outbound.flight,
                        extractedData.outbound.departureTime &&
                          `Saída: ${extractedData.outbound.departureTime}`,
                      ]
                        .filter(Boolean)
                        .join(' | ') || 'Sem detalhes de voo'}
                    </small>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Volta</span>
                    <p style={{ fontWeight: 500, margin: '2px 0' }}>
                      {extractedData.inbound.route || 'Não informado'}
                    </p>
                    <small style={{ color: 'var(--text-secondary)' }}>
                      {[
                        extractedData.inbound.company,
                        extractedData.inbound.flight,
                        extractedData.inbound.departureTime &&
                          `Saída: ${extractedData.inbound.departureTime}`,
                      ]
                        .filter(Boolean)
                        .join(' | ') || 'Sem detalhes de voo'}
                    </small>
                  </div>
                </div>
              </div>

              {/* 4. Hospedagem */}
              <div className="review-section-box" style={{ marginTop: '0.75rem' }}>
                <span className="review-box-label">🏨 Hospedagem Principal</span>
                <div className="review-row" style={{ marginTop: '0.25rem' }}>
                  <span>Hotel:</span>
                  <strong>{extractedData.lodging.name || 'Não informado'}</strong>
                </div>
                <div className="review-row">
                  <span>Destino / Local:</span>
                  <strong>
                    {[extractedData.lodging.city, extractedData.lodging.country]
                      .filter(Boolean)
                      .join(', ') || 'Não informado'}
                  </strong>
                </div>
                <div className="review-row">
                  <span>Regime de Alimentação:</span>
                  <strong>{extractedData.lodging.mealPlan || 'Não informado'}</strong>
                </div>
                {extractedData.lodging.room && (
                  <div className="review-row">
                    <span>Acomodação / Quarto:</span>
                    <strong>{extractedData.lodging.room}</strong>
                  </div>
                )}
              </div>

              {/* 5. Serviços Adicionais (se houver) */}
              {extractedData.additionalServices.length > 0 && (
                <div className="review-section-box" style={{ marginTop: '0.75rem' }}>
                  <span className="review-box-label">
                    🎒 Serviços Adicionais ({extractedData.additionalServices.length})
                  </span>
                  <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                    {extractedData.additionalServices.map((srv, idx) => (
                      <li key={idx} style={{ marginBottom: '2px' }}>
                        <strong>{srv.name}</strong>
                        {srv.amount !== null && (
                          <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>
                            ({srv.currency || ''} {srv.amount})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 6. Financeiro (Tratado estritamente como custo) */}
              <div className="review-section-box" style={{ marginTop: '0.75rem' }}>
                <span className="review-box-label">💰 Custos Comerciais Identificados</span>
                <div className="review-grid-3" style={{ marginTop: '0.25rem' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Moeda</span>
                    <p style={{ fontWeight: 600 }}>
                      {extractedData.financial.currency || 'Não informada'}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Taxas / Impostos
                    </span>
                    <p style={{ fontWeight: 600 }}>
                      {extractedData.financial.taxesAndFees !== null
                        ? extractedData.financial.taxesAndFees
                        : 'Não discriminadas'}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Custo Total Identificado
                    </span>
                    <p style={{ fontWeight: 700, color: 'var(--accent-text)' }}>
                      {extractedData.financial.total !== null
                        ? `${extractedData.financial.currency || ''} ${extractedData.financial.total}`
                        : 'Não identificado'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="modal-footer">
          {step === 'select' && (
            <>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={selectedImages.length === 0}
                onClick={handleAnalyze}
              >
                Analisar imagens com IA
              </button>
            </>
          )}

          {step === 'review' && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep('select')}
              >
                ← Modificar imagens
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary" onClick={handleApply}>
                  Importar dados no formulário ✓
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
