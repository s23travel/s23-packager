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

  const handleRemoveService = (serviceId: string) => {
    if (!extractedData) return;
    setExtractedData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        services: prev.services.filter((s) => s.id !== serviceId),
      };
    });
  };

  const SERVICE_TYPE_ICONS: Record<string, string> = {
    outbound_transport: '🛫',
    inbound_transport: '🛬',
    accommodation: '🏨',
    transfer: '🚐',
    insurance: '🛡️',
    additional: '🎫',
    taxes: '🏛️',
    other: '📦',
  };

  const SERVICE_TYPE_LABELS: Record<string, string> = {
    outbound_transport: 'Transporte de Ida',
    inbound_transport: 'Transporte de Volta',
    accommodation: 'Hospedagem',
    transfer: 'Transfer',
    insurance: 'Seguro-viagem',
    additional: 'Serviço Adicional',
    taxes: 'Impostos / Taxas',
    other: 'Outros Custos',
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
                    <span>Avisos de Conflitos Detectados entre Imagens (Revise antes de salvar)</span>
                  </div>
                  <ul className="review-conflicts-list">
                    {extractedData.conflicts.map((conf, idx) => (
                      <li key={idx}>
                        {typeof conf === 'string'
                          ? conf
                          : `${conf.field ? `[${conf.field}] ` : ''}${conf.description}${
                              conf.values && conf.values.length > 0 ? ` (${conf.values.join(' vs ')})` : ''
                            }`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Destino Comercial da Viagem */}
              <div className="review-section-box highlight">
                <span className="review-box-label">Destino Comercial da Viagem</span>
                <input
                  type="text"
                  className="input input-sm"
                  style={{ marginTop: '4px', width: '100%', fontWeight: 600 }}
                  value={extractedData.destination || ''}
                  placeholder="Ex.: Paris, Roma, Porto de Galinhas..."
                  onChange={(e) =>
                    setExtractedData((prev) => (prev ? { ...prev, destination: e.target.value } : prev))
                  }
                />
              </div>

              {/* Nome do Pacote (se identificado) */}
              {extractedData.packageName && (
                <div className="review-section-box" style={{ marginTop: '0.5rem' }}>
                  <span className="review-box-label">Nome Comercial Sugerido</span>
                  <p className="review-box-val" style={{ fontSize: '0.95rem', fontWeight: 500, margin: '2px 0' }}>
                    {extractedData.packageName}
                  </p>
                </div>
              )}

              <div className="review-grid-2" style={{ marginTop: '0.5rem' }}>
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

              {/* 3. Serviços Unificados Identificados (services[]) */}
              <div className="review-section-box" style={{ marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span className="review-box-label" style={{ marginBottom: 0 }}>
                    🎒 Serviços Extraídos ({extractedData.services.length})
                  </span>
                  <small style={{ color: 'var(--text-muted)' }}>Você pode remover itens indesejados antes de aplicar</small>
                </div>

                {extractedData.services.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>
                    Nenhum serviço discriminado foi identificado.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {extractedData.services.map((srv) => {
                      const icon = SERVICE_TYPE_ICONS[srv.type] || '📦';
                      const label = SERVICE_TYPE_LABELS[srv.type] || 'Serviço';

                      return (
                        <div
                          key={srv.id}
                          style={{
                            background: 'var(--bg-surface-elevated)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.65rem 0.85rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '14px' }}>{icon}</span>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                                  {label}
                                </span>
                              </div>
                              <p style={{ fontWeight: 600, fontSize: '13px', margin: '3px 0', color: 'var(--text-primary)' }}>
                                {srv.description}
                              </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                                {srv.amount > 0 ? (
                                  `${srv.currency} ${srv.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${
                                    srv.quantity > 1 ? ` (${srv.quantity}x)` : ''
                                  }`
                                ) : (
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Incluso</span>
                                )}
                              </span>
                              <button
                                type="button"
                                className="btn btn-sm btn-ghost"
                                style={{ padding: '2px 6px', color: 'var(--danger)', fontSize: '12px' }}
                                onClick={() => handleRemoveService(srv.id)}
                                title="Remover este serviço"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* Metadados específicos do serviço */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '11px', color: 'var(--text-muted)' }}>
                            {srv.carrier && <span>Cia: <strong>{srv.carrier}</strong></span>}
                            {(srv.departureTime || srv.arrivalTime) && (
                              <span>
                                ⏰ {srv.departureTime && srv.arrivalTime ? `${srv.departureTime} → ${srv.arrivalTime}` : srv.departureTime || srv.arrivalTime}
                              </span>
                            )}
                            {srv.destination && <span>📍 {srv.destination}</span>}
                            {srv.mealPlan && <span>🍽️ {srv.mealPlan}</span>}
                            {srv.notes && <span>💬 {srv.notes}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 4. Preço de Venda Comercial Identificado */}
              {extractedData.salePrice !== null && extractedData.salePrice !== undefined && extractedData.salePrice > 0 && (
                <div className="review-section-box" style={{ marginTop: '0.75rem' }}>
                  <span className="review-box-label">💰 Preço Total Comercial Identificado</span>
                  <p style={{ fontWeight: 700, fontSize: '15px', color: 'var(--accent-text)', margin: '2px 0' }}>
                    {extractedData.currency || 'EUR'} {extractedData.salePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <small style={{ color: 'var(--text-muted)' }}>
                    O motor financeiro calculará automaticamente o custo total dos serviços e a margem após aplicação.
                  </small>
                </div>
              )}
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
