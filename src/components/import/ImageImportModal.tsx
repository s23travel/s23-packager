import React, { useState, useRef, useEffect } from 'react';
import { ImportedPackageData } from '../../types';
import {
  validateImageFile,
  importPackageDataFromImage,
} from '../../services/imageImportService';


interface ImageImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: ImportedPackageData) => void;
  targetType?: 'package' | 'quote';
}

type Step = 'select' | 'analyzing' | 'review';

export const ImageImportModal: React.FC<ImageImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  targetType = 'package',
}) => {
  const [step, setStep] = useState<Step>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ImportedPackageData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Limpa estado ao fechar ou reabrir
  useEffect(() => {
    if (!isOpen) {
      setStep('select');
      setSelectedFile(null);
      setErrorMsg(null);
      setExtractedData(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileSelect = (file: File) => {
    setErrorMsg(null);
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Arquivo inválido.');
      return;
    }

    setSelectedFile(file);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
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
    if (!selectedFile) return;

    setStep('analyzing');
    setErrorMsg(null);

    const result = await importPackageDataFromImage(selectedFile);

    if (!result.success || !result.data) {
      setErrorMsg(result.error || 'Falha ao analisar a imagem.');
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
        style={{ maxWidth: step === 'review' ? '760px' : '560px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div className="modal-header">
          <div>
            <h3 className="modal-title">
              {step === 'review'
                ? 'Revisão dos Dados Extraídos da Imagem'
                : 'Importar Dados de Imagem'}
            </h3>
            <p className="modal-subtitle">
              {step === 'review'
                ? 'Confira as informações identificadas antes de aplicar ao formulário.'
                : `Carregue a cotação de fornecedor para preencher o ${
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
          {/* STEP 1: Seleção / Drag and Drop */}
          {step === 'select' && (
            <div>
              <div
                className={`image-dropzone ${isDragging ? 'dragging' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />

                {previewUrl ? (
                  <div className="dropzone-preview">
                    <img
                      src={previewUrl}
                      alt="Prévia da cotação"
                      className="dropzone-thumbnail"
                    />
                    <div className="dropzone-fileinfo">
                      <strong>{selectedFile?.name}</strong>
                      <span>{selectedFile && formatFileSize(selectedFile.size)}</span>
                      <span className="dropzone-change-hint">
                        Clique ou arraste para substituir
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="dropzone-prompt">
                    <div className="dropzone-icon">📷</div>
                    <h4>Arraste uma imagem aqui ou clique para selecionar</h4>
                    <p>Formatos aceitos: PNG, JPG ou JPEG (máximo 8MB)</p>
                  </div>
                )}
              </div>

              <div className="modal-notice">
                <small>
                  🔒 <strong>Privacidade e Segurança</strong>: A imagem é processada
                  exclusivamente no servidor para interpretação da cotação e não é armazenada
                  permanentemente.
                </small>
              </div>
            </div>
          )}

          {/* STEP 2: Processamento com IA */}
          {step === 'analyzing' && (
            <div className="modal-loading-container">
              <div className="spinner-large" />
              <h4 style={{ marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                Analisando cotação com IA...
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Identificando voos, hospedagem, datas, passageiros e valores na imagem.
              </p>
            </div>
          )}

          {/* STEP 3: Tela de Revisão */}
          {step === 'review' && extractedData && (
            <div className="review-container">
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

              {/* 6. Financeiro */}
              <div className="review-section-box" style={{ marginTop: '0.75rem' }}>
                <span className="review-box-label">💰 Valores Comerciais Identificados</span>
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
                      Preço Total
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
                disabled={!selectedFile}
                onClick={handleAnalyze}
              >
                Analisar Imagem com IA ↗
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
                ← Trocar Imagem
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
