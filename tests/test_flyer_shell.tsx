import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FlyerControls } from '../src/components/flyers/FlyerControls';
import { FlyerItemsEditor } from '../src/components/flyers/FlyerItemsEditor';
import { FlyerServerPreview } from '../src/components/flyers/FlyerServerPreview';
import { FlyerSavedDownloads } from '../src/components/flyers/FlyerSavedDownloads';
import { FLYER_ITEMS_MAX } from '../supabase/functions/_shared/flyerItemsContract';

// Rótulos e estrutura comuns às lâminas de pacote e de cotação.
const controls = renderToStaticMarkup(<FlyerControls
  destination="Açores"
  hint="Trem Bernina"
  onHintChange={() => undefined}
  onGenerate={() => undefined}
  generating={false}
  disabled={false}
  suggestion={null}
  subtitleDraft=""
  onSubtitleChange={() => undefined}
  subtitleError={null}
  imageFailed={false}
  onImageFailed={() => undefined}
/>);
assert.match(controls, /Indicação para a imagem \(opcional\)/);
assert.match(controls, /aria-label="Indicação para a imagem"/);
assert.match(controls, /maxLength="200"/);
assert.match(controls, /Até 200 caracteres/);
assert.match(controls, /Gerar imagem e subtítulo/);
assert.match(controls, /Cada geração pode gerar cobrança/);
assert.doesNotMatch(controls, /Gerar nova sugestão|Subtítulo comercial sugerido/);

const suggested = renderToStaticMarkup(<FlyerControls
  destination="Açores"
  hint=""
  onHintChange={() => undefined}
  onGenerate={() => undefined}
  generating
  disabled
  suggestion={{ imageUrl: 'data:image/png;base64,AA==', subtitle: 'Lagoas' }}
  subtitleDraft="Descubra lagoas"
  onSubtitleChange={() => undefined}
  subtitleError="Use de 3 a 100 caracteres, sem afirmações de preço ou serviços."
  imageFailed
  onImageFailed={() => undefined}
/>);
assert.match(suggested, /Gerando imagem e subtítulo…/);
assert.match(suggested, /disabled=""/);
assert.match(suggested, /aria-busy="true"/);
assert.match(suggested, /alt="Imagem gerada para Açores"/);
assert.match(suggested, /Não foi possível carregar a imagem sugerida/);
assert.match(suggested, /Subtítulo comercial sugerido/);
assert.match(suggested, /Descubra lagoas/);
assert.match(suggested, /Use de 3 a 100 caracteres/);

const retry = renderToStaticMarkup(<FlyerControls
  destination="Açores"
  hint=""
  onHintChange={() => undefined}
  onGenerate={() => undefined}
  generating={false}
  disabled={false}
  suggestion={{ imageUrl: 'data:image/png;base64,AA==', subtitle: 'Lagoas' }}
  subtitleDraft="Descubra lagoas"
  onSubtitleChange={() => undefined}
  subtitleError={null}
  imageFailed={false}
  onImageFailed={() => undefined}
/>);
assert.match(retry, /Gerar nova sugestão/);
console.log('Controlos comuns: OK');

const items = renderToStaticMarkup(<FlyerItemsEditor
  items={[{ kind: 'air', label: 'Aéreo com bagagem' }, { kind: 'additional', label: 'Passeio' }]}
  problems={[null, 'Use até 40 caracteres (tem 41).']}
  itemsTooMany={false}
  itemsError={null}
  onChange={() => undefined}
  onRemove={() => undefined}
  onAdd={() => undefined}
/>);
assert.match(items, /<legend>Serviços apresentados<\/legend>/);
assert.match(items, new RegExp(`Até ${FLYER_ITEMS_MAX} itens e 40 caracteres cada`));
assert.match(items, /<option value="air">Aéreo<\/option>/);
assert.match(items, /<option value="transport">Transporte<\/option>/);
assert.match(items, /<option value="accommodation">Hospedagem<\/option>/);
assert.match(items, /<option value="transfer">Transfer<\/option>/);
assert.match(items, /<option value="insurance">Seguro<\/option>/);
assert.match(items, /<option value="additional">Extra<\/option>/);
assert.match(items, /Aéreo com bagagem/);
assert.match(items, /17\/40/);
assert.match(items, /Use até 40 caracteres \(tem 41\)\./);
assert.match(items, /\+ Adicionar serviço/);

const full = Array.from({ length: FLYER_ITEMS_MAX }, (_, index) => ({ kind: 'additional' as const, label: `Serviço ${index}` }));
const fullItems = renderToStaticMarkup(<FlyerItemsEditor
  items={full}
  problems={full.map(() => null)}
  itemsTooMany
  itemsError={`A lâmina comporta ${FLYER_ITEMS_MAX} serviços; remova 1.`}
  onChange={() => undefined}
  onRemove={() => undefined}
  onAdd={() => undefined}
/>);
assert.match(fullItems, /A lâmina comporta 6 serviços; remova 1\./);
assert.match(fullItems, /disabled=""/);
console.log('Editor de serviços: OK');

const preview = renderToStaticMarkup(<FlyerServerPreview
  matches={false}
  previewing={false}
  canPreview
  onPreview={() => undefined}
  canSave={false}
  saving={false}
  saved={false}
  onSave={() => undefined}
/>);
assert.match(preview, /aria-label="Salvar lâmina no pacote"/);
assert.match(preview, /Gerar lâmina/);

const busy = renderToStaticMarkup(<FlyerServerPreview
  matches={false}
  previewing
  canPreview={false}
  onPreview={() => undefined}
  canSave={false}
  saving={false}
  saved={false}
  onSave={() => undefined}
/>);
assert.match(busy, /Gerando a lâmina…/);
assert.match(busy, /aria-busy="true"/);

const review = renderToStaticMarkup(<FlyerServerPreview
  matches
  previewUrl="blob:preview"
  previewing={false}
  canPreview
  onPreview={() => undefined}
  canSave
  saving={false}
  saved={false}
  onSave={() => undefined}
/>);
assert.match(review, /src="blob:preview"/);
assert.match(review, /Prévia final da lâmina gerada no servidor/);
assert.match(review, /Salvar lâmina no pacote/);

const replace = renderToStaticMarkup(<FlyerServerPreview
  matches
  previewUrl="blob:preview"
  previewing={false}
  canPreview
  onPreview={() => undefined}
  canSave
  saving={false}
  saved
  onSave={() => undefined}
/>);
assert.match(replace, /Substituir a lâmina salva/);

const saving = renderToStaticMarkup(<FlyerServerPreview
  matches
  previewUrl="blob:preview"
  previewing={false}
  canPreview
  onPreview={() => undefined}
  canSave
  saving
  saved
  onSave={() => undefined}
/>);
assert.match(saving, /Salvando no pacote…/);
assert.match(saving, /aria-busy="true"/);
console.log('Prévia do servidor: OK');

const downloads = renderToStaticMarkup(<FlyerSavedDownloads downloading={null} onDownload={() => undefined} />);
assert.match(downloads, /aria-label="Baixar a última lâmina salva"/);
assert.match(downloads, />HTML</);
assert.match(downloads, />IMAGEM</);
assert.doesNotMatch(downloads, /disabled=""/);

const downloading = renderToStaticMarkup(<FlyerSavedDownloads downloading="png" onDownload={() => undefined} />);
assert.match(downloading, /disabled=""/);
console.log('Downloads da versão salva: OK');

