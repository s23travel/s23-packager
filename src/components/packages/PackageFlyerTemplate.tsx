import type { PackageFlyerModel } from '../../services/packageFlyerService';
import logo from '../../../design-system/s23-travel/assets/Logo_Circulo.png';

export function PackageFlyerTemplate({ model }: { model: PackageFlyerModel }) {
  return (
    <article className="package-flyer" aria-label="Prévia da lâmina de viagem" style={model.imageUrl ? { backgroundImage: `linear-gradient(var(--flyer-scrim), var(--flyer-scrim)), url(${JSON.stringify(model.imageUrl)})` } : undefined}>
      <div className="package-flyer__safe">
        <header className="package-flyer__header">
          <img src={logo} alt="S23 Travel" />
          <span>Sua viagem, nossa missão</span><span>www.s23.travel</span>
        </header>
        <div className="package-flyer__route">{model.origin} <FlyerIcon kind="air" /> {model.destination}</div>
        <div className="package-flyer__price"><span>Valor por pessoa</span><strong>{model.price.formatted}</strong><span>por pessoa em quarto duplo</span>{model.paymentConditions && <span>{model.paymentConditions}</span>}</div>
        <div className="package-flyer__period">{model.period}</div>
        <section className="package-flyer__items" aria-label="Serviços apresentados">
          <ul>{model.items.map((item, index) => <li key={`${item.kind}-${index}`}><FlyerIcon kind={item.kind} />{item.label}</li>)}</ul>
          {model.subtitle && <p>{model.subtitle}</p>}
        </section>
        <footer className="package-flyer__footer"><span>Valores sujeitos a alteração sem aviso. Consulte-nos sobre personalizações.</span><span><strong>Fale com um especialista</strong><br />zap: +351 960 153 290</span></footer>
      </div>
    </article>
  );
}

function FlyerIcon({ kind }: { kind: PackageFlyerModel['items'][number]['kind'] }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'air' ? <path d="M22 2 9 15M22 2l-7 20-4-9-9-4Z" /> :
      kind === 'accommodation' ? <><path d="M3 19V7m0 8h18v4M3 11h16a2 2 0 0 1 2 2v2M7 11V8h4a2 2 0 0 1 2 2v1" /></> :
      kind === 'insurance' ? <><path d="M12 2 4 5v6c0 5 3 8 8 11 5-3 8-6 8-11V5Z" /><path d="M12 7v8M8 11h8" /></> :
      kind === 'transfer' || kind === 'transport' ? <><path d="M5 16 6 9h12l1 7M4 16h16v3H4zM7 9l2-4h6l2 4" /><path d="M7 19v2m10-2v2" /></> : <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>}
  </svg>;
}
