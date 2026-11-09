import { useState } from 'react';
import type { Package } from '../../types';
import { createPackageFlyer } from '../../services/packageFlyerService';
import { PackageFlyerTemplate } from './PackageFlyerTemplate';

/** Entrada pública da criação; recebe somente o pacote já carregado. */
export function PackageFlyerCreator({ package: pkg }: { package: Package }) {
  const [open, setOpen] = useState(false);
  const flyer = open ? createPackageFlyer(pkg) : null;
  return <div>
    <button type="button" className="btn btn-secondary" aria-expanded={open} aria-controls="package-flyer-preview" onClick={() => setOpen(value => !value)}>
      {open ? 'Fechar prévia da lâmina' : 'Criar lâmina'}
    </button>
    {flyer && <section id="package-flyer-preview" className="card" aria-labelledby="package-flyer-title" style={{ marginTop: '1.25rem' }}>
      <h2 id="package-flyer-title" className="card-title">Prévia da lâmina</h2>
      <p>Imagem provisória ilustrativa. Revise todos os dados comerciais antes de divulgar.</p>
      {flyer.errors.length > 0 && <div role="alert"><p>Não foi possível montar a prévia:</p><ul>{flyer.errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
      {flyer.warnings.length > 0 && <div role="status"><p>Atenção:</p><ul>{Array.from(new Set(flyer.warnings)).map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
      {flyer.model && <>
        <PackageFlyerTemplate model={flyer.model} />
        <div aria-label="Dados da lâmina em texto">
          <p><strong>Rota:</strong> {flyer.model.origin} para {flyer.model.destination}</p>
          <p><strong>Período:</strong> {flyer.model.period}</p>
          <p><strong>Valor total:</strong> {flyer.model.price.formatted} por pessoa em quarto duplo</p>
          {flyer.model.paymentConditions && <p><strong>Pagamento:</strong> {flyer.model.paymentConditions}</p>}
          {flyer.model.items.length > 0 ? <><p><strong>Serviços apresentados:</strong></p><ul>{flyer.model.items.map((item, i) => <li key={i}>{item.label}</li>)}</ul></> : <p>Nenhum serviço apresentado.</p>}
        </div>
      </>}
    </section>}
  </div>;
}
