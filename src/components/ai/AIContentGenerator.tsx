import React, { useState } from 'react';
import { Package, Quotation, StructuredPackageContent } from '../../types';
import { buildContentGenerationInput } from '../../services/contentValidationService';
import { generateContentForWebsite } from '../../services/aiContentService';
import { generatePackageMarkdown, getMarkdownFileName } from '../../services/markdownService';
import { validatePackageMarkdown } from '../../services/markdownValidationService';

interface AIContentGeneratorProps {
  source: {
    package?: Package;
    quotation?: Quotation;
  };
}

export const AIContentGenerator: React.FC<AIContentGeneratorProps> = ({ source }) => {
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState<StructuredPackageContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'geral' | 'sobre' | 'inclusoes' | 'seo' | 'json' | 'markdown'>('geral');

  // Estados do Markdown do Website (Fase 6B/6C)
  const [markdownString, setMarkdownString] = useState<string | null>(null);
  const [markdownFileName, setMarkdownFileName] = useState<string | null>(null);
  const [markdownErrors, setMarkdownErrors] = useState<string[]>([]);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);
      setErrorDetails(null);
      // Invalida markdown anterior ao gerar novo conteúdo estruturado
      setMarkdownString(null);
      setMarkdownFileName(null);
      setMarkdownErrors([]);

      // Constrói input sanitizado garantindo que nenhum custo interno seja enviado
      const input = buildContentGenerationInput(source);

      // Invoca backend seguro
      const res = await generateContentForWebsite(input);

      if (!res.success || !res.data) {
        setError(res.error || 'Falha na geração de conteúdo.');
        setErrorDetails(res.details || null);
        return;
      }

      setContent(res.data);
    } catch (err: any) {
      console.error('Erro na geração:', err);
      setError(err.message || 'Erro inesperado ao gerar conteúdo com IA.');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateMarkdown = () => {
    if (!content) return;

    try {
      // 1. Geração determinística
      const md = generatePackageMarkdown(content);
      const filename = getMarkdownFileName(content);

      // 2. Validação estrita do Markdown gerado
      const validation = validatePackageMarkdown(md, content);

      if (!validation.valid) {
        setMarkdownErrors(validation.errors);
        setMarkdownString(null);
        setMarkdownFileName(null);
        return;
      }

      setMarkdownErrors([]);
      setMarkdownString(md);
      setMarkdownFileName(filename);
      setActiveTab('markdown');
    } catch (err: any) {
      setMarkdownErrors([err.message || 'Erro ao gerar arquivo Markdown.']);
      setMarkdownString(null);
      setMarkdownFileName(null);
    }
  };

  const handleCopyMarkdown = async () => {
    if (!markdownString) return;
    try {
      await navigator.clipboard.writeText(markdownString);
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!markdownString || !markdownFileName) return;

    const blob = new Blob([markdownString], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = markdownFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card shadow-sm border border-slate-200 rounded-xl overflow-hidden bg-white">
      {/* Cabeçalho da Seção de IA */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg">
            ✨
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-800">Conteúdo para Website (IA)</h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
                Gemini + Google Search Grounding
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pesquisa factual sobre o destino e redação comercial estruturada baseada no{' '}
              {source.quotation ? 'snapshot da cotação' : 'pacote base'}.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50"
        >
          {generating ? (
            <>
              <span className="inline-block animate-spin">⏳</span> Pesquisando & Gerando...
            </>
          ) : (
            <>
              <span>✨</span> Gerar Conteúdo Estruturado
            </>
          )}
        </button>
      </div>

      {/* Alerta Informativo de Segurança e Soberania dos Dados */}
      <div className="px-5 py-3 bg-indigo-50/60 border-b border-indigo-100 text-xs text-indigo-900 flex items-center justify-between">
        <span>
          🛡️ <strong>Hierarquia Nível 1:</strong> Preço, datas e hotéis são soberanos e nunca são alterados pela IA. Custos internos nunca são enviados à API.
        </span>
        <span className="text-[11px] font-semibold text-indigo-700">Fase 6A — Modelo Estruturado</span>
      </div>

      {/* Mensagem de Erro (caso ocorra ou secret não esteja configurada) */}
      {error && (
        <div className="p-4 bg-rose-50 border-b border-rose-200 text-xs text-rose-800">
          <div className="flex items-start gap-2">
            <span className="text-base">⚠️</span>
            <div>
              <p className="font-bold">{error}</p>
              {errorDetails && <p className="mt-1 text-rose-700">{errorDetails}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo Estruturado Retornado */}
      {content ? (
        <div className="p-5 space-y-4">
          {/* Navegação por Abas */}
          <div className="flex border-b border-slate-200 gap-2 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('geral')}
              className={`pb-2 px-3 transition-colors border-b-2 ${
                activeTab === 'geral'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Visão Geral
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sobre')}
              className={`pb-2 px-3 transition-colors border-b-2 ${
                activeTab === 'sobre'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Sobre o Destino & Fatos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('inclusoes')}
              className={`pb-2 px-3 transition-colors border-b-2 ${
                activeTab === 'inclusoes'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Inclusões & Pagamento
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('seo')}
              className={`pb-2 px-3 transition-colors border-b-2 ${
                activeTab === 'seo'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              SEO
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('json')}
              className={`pb-2 px-3 transition-colors border-b-2 ${
                activeTab === 'json'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              JSON Estruturado
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('markdown')}
              className={`pb-2 px-3 transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === 'markdown'
                  ? 'border-indigo-600 text-indigo-700 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>📄</span> Markdown do Website
              {markdownString && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Markdown validado e pronto"></span>
              )}
            </button>
          </div>

          {/* Aba: Visão Geral */}
          {activeTab === 'geral' && (
            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  Título Comercial
                </div>
                <div className="text-base font-bold text-slate-800 mt-0.5">{content.title}</div>
                {content.subtitle && (
                  <div className="text-xs text-slate-600 italic mt-1">{content.subtitle}</div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-400 font-semibold uppercase">Categoria</span>
                  <div className="font-bold text-slate-800 mt-1">{content.category}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-400 font-semibold uppercase">Slug Oficial</span>
                  <div className="font-mono text-slate-800 mt-1">{content.slug}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-400 font-semibold uppercase">Preço Comercial</span>
                  <div className="font-bold text-emerald-700 mt-1">{content.price}</div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  Excerpt (Resumo do Card)
                </div>
                <div className="text-slate-700 mt-1 leading-relaxed">{content.excerpt}</div>
              </div>
            </div>
          )}

          {/* Aba: Sobre */}
          {activeTab === 'sobre' && (
            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="font-bold text-slate-800 text-sm">{content.sobre.title}</div>
                <p className="mt-2 text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {content.sobre.text}
                </p>
              </div>

              {content.infoDestino && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {content.infoDestino.localizacao && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-500">📍 Localização:</span>
                      <p className="mt-1 text-slate-700">{content.infoDestino.localizacao}</p>
                    </div>
                  )}
                  {content.infoDestino.clima && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-500">☀️ Clima:</span>
                      <p className="mt-1 text-slate-700">{content.infoDestino.clima}</p>
                    </div>
                  )}
                  {content.infoDestino.idiomaCultura && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-500">🗣️ Idioma e Cultura:</span>
                      <p className="mt-1 text-slate-700">{content.infoDestino.idiomaCultura}</p>
                    </div>
                  )}
                  {content.infoDestino.documentacao && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-500">🛂 Documentação:</span>
                      <p className="mt-1 text-slate-700">{content.infoDestino.documentacao}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Aba: Inclusões */}
          {activeTab === 'inclusoes' && (
            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="font-bold text-slate-800 mb-2">Itens Inclusos</div>
                <ul className="space-y-2">
                  {content.incluso.map((inc, i) => (
                    <li key={i} className="flex items-start gap-2 bg-white p-2 rounded border border-slate-100">
                      <span className="text-base">{inc.icon === 'gift' ? '🎁' : inc.icon === 'plane' ? '✈️' : inc.icon === 'bed' ? '🏨' : '✔'}</span>
                      <div>
                        <div className="font-semibold text-slate-800">{inc.title}</div>
                        {inc.desc && <div className="text-slate-500 text-[11px]">{inc.desc}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="font-bold text-slate-800 mb-1">Regra de Pagamento Obrigatória</div>
                <div className="p-2 bg-white rounded border border-slate-100 text-slate-700 font-medium italic">
                  "{content.pagamento.observacao}"
                </div>
              </div>
            </div>
          )}

          {/* Aba: SEO */}
          {activeTab === 'seo' && (
            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-400 font-semibold uppercase">SEO Title ({content.seoTitle.length}/60 carac.)</span>
                <div className="text-sm font-bold text-slate-800 mt-1">{content.seoTitle}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-400 font-semibold uppercase">SEO Description ({content.seoDescription.length}/160 carac.)</span>
                <div className="text-slate-700 mt-1 leading-relaxed">{content.seoDescription}</div>
              </div>
            </div>
          )}

          {/* Aba: JSON */}
          {activeTab === 'json' && (
            <div className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-[11px] font-mono leading-relaxed">
              <pre>{JSON.stringify(content, null, 2)}</pre>
            </div>
          )}

          {/* Aba: Markdown do Website (Fase 6B) */}
          {activeTab === 'markdown' && (
            <div className="space-y-4 text-xs">
              {/* Barra de Ações do Markdown */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-100/80 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">Arquivo:</span>
                  <span className="font-mono bg-white px-2.5 py-1 rounded border border-slate-200 text-slate-800 font-semibold">
                    {markdownFileName || `${content.slug}.md`}
                  </span>
                  {markdownString && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ✓ Validado & Compatível com Website S23
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateMarkdown}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <span>⚡</span> {markdownString ? 'Regerar Markdown' : 'Gerar Markdown'}
                  </button>

                  {markdownString && (
                    <>
                      <button
                        type="button"
                        onClick={handleCopyMarkdown}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <span>📋</span> {copiedMarkdown ? 'Copiado!' : 'Copiar Markdown'}
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadMarkdown}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <span>⬇️</span> Baixar .md
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Erros de Validação do Markdown */}
              {markdownErrors.length > 0 && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>⚠️</span> Erros na validação do Markdown gerado:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-700 mt-1">
                    {markdownErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Indicação Oficial para o Manager (Fase 6C - Escopo MVP) */}
              {markdownString && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-900">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">📁</span>
                    <div>
                      <span className="font-bold">Arquivo pronto para publicação no Manager.</span>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        Baixe o arquivo .md e envie-o manualmente ao Manager.
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] font-semibold bg-white px-2.5 py-1 rounded border border-emerald-300 text-emerald-800">
                    content/pacotes/{markdownFileName || `${content.slug}.md`}
                  </span>
                </div>
              )}

              {/* Preview do Conteúdo Markdown */}
              {markdownString ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                    <span>Pré-visualização do arquivo Markdown final pronto para commit no repositório:</span>
                    <span>{markdownString.split('\n').length} linhas • {new Blob([markdownString]).size} bytes</span>
                  </div>
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-[11px] font-mono leading-relaxed max-h-[500px]">
                    <pre className="whitespace-pre">{markdownString}</pre>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  <p className="text-slate-600 font-medium">Nenhum Markdown gerado ainda para este conteúdo.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Clique no botão "Gerar Markdown" acima para transformar este conteúdo estruturado em um arquivo .md compatível com o website S23.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center bg-slate-50/50">
          <p className="text-xs text-slate-500 font-medium">
            Nenhum conteúdo estruturado gerado ainda.
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Clique em "Gerar Conteúdo Estruturado" para acionar o backend seguro do Gemini com Google Search Grounding.
          </p>
        </div>
      )}
    </div>
  );
};
