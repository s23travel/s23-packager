import {
  FLYER_ITEM_KINDS,
  FLYER_ITEM_LABEL_MAX,
  FLYER_ITEMS_MAX,
  normalizeItemLabel,
  type FlyerItem,
  type FlyerItemKind,
} from '../../../supabase/functions/_shared/flyerItemsContract';

const FLYER_ITEM_KIND_LABELS: Record<FlyerItemKind, string> = {
  air: 'Aéreo',
  transport: 'Transporte',
  accommodation: 'Hospedagem',
  transfer: 'Transfer',
  insurance: 'Seguro',
  additional: 'Extra',
};

interface FlyerItemsEditorProps {
  items: FlyerItem[];
  problems: Array<string | null>;
  itemsTooMany: boolean;
  itemsError: string | null;
  onChange: (index: number, patch: Partial<FlyerItem>) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}

/** Lista "Serviços apresentados" editável, partilhada pelas duas lâminas. */
export function FlyerItemsEditor({ items, problems, itemsTooMany, itemsError, onChange, onRemove, onAdd }: FlyerItemsEditorProps) {
  return <fieldset className="package-flyer-items-editor">
    <legend>Serviços apresentados</legend>
    <span className="package-flyer-help">Até {FLYER_ITEMS_MAX} itens e {FLYER_ITEM_LABEL_MAX} caracteres cada. É esta a lista que sai na lâmina; sem itens, a caixa é omitida.</span>
    {items.map((item, index) => {
      const problem = problems[index];
      const problemId = `flyer-item-problem-${index}`;
      return <div className="package-flyer-item-block" key={index}>
        <div className="package-flyer-item-row">
          <label className="form-group">
            <span className="form-label">Tipo</span>
            <select className="form-select" aria-label={`Tipo do serviço ${index + 1}`} value={item.kind}
              onChange={event => onChange(index, { kind: event.target.value as FlyerItemKind })}>
              {FLYER_ITEM_KINDS.map(kind => <option key={kind} value={kind}>{FLYER_ITEM_KIND_LABELS[kind]}</option>)}
            </select>
          </label>
          <label className="form-group">
            <span className="form-label package-flyer-item-label">
              <span>Texto</span>
              <span className="package-flyer-item-count">{normalizeItemLabel(item.label).length}/{FLYER_ITEM_LABEL_MAX}</span>
            </span>
            <input className="form-input" type="text" aria-label={`Serviço ${index + 1}`} value={item.label}
              maxLength={FLYER_ITEM_LABEL_MAX} aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? problemId : undefined}
              onChange={event => onChange(index, { label: event.target.value })} />
          </label>
          <button type="button" className="btn btn-secondary" onClick={() => onRemove(index)} aria-label={`Remover serviço ${index + 1}`}>Remover</button>
        </div>
        {problem && <p className="package-flyer-item-problem" id={problemId}>{problem}</p>}
      </div>;
    })}
    {itemsTooMany && <p className="package-flyer-item-problem" role="alert">{itemsError}</p>}
    <button type="button" className="btn btn-secondary" onClick={onAdd} disabled={items.length >= FLYER_ITEMS_MAX}>
      + Adicionar serviço
    </button>
  </fieldset>;
}
