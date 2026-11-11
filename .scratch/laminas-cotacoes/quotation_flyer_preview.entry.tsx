// Entrada do render de conferência (offline): monta o HTML com os mesmos
// módulos e CSS do produto e devolve o documento pronto para o screenshot.
import tokens from '../../design-system/s23-travel/colors_and_type.css';
import flyerCss from '../../src/components/quotes/quotationFlyer.css';
import logo from '../../design-system/s23-travel/assets/Logo Secundário Redondo.png';
import regular from '../../design-system/s23-travel/fonts/Poppins/Poppins-Regular.ttf';
import medium from '../../design-system/s23-travel/fonts/Poppins/Poppins-Medium.ttf';
import semibold from '../../design-system/s23-travel/fonts/Poppins/Poppins-SemiBold.ttf';
import bold from '../../design-system/s23-travel/fonts/Poppins/Poppins-Bold.ttf';
import travelPhoto from '../../design-system/s23-travel/assets/travel.jpg';
import { createQuotationFlyer } from '../../src/services/quotationFlyerService';
import { renderQuotationFlyerMarkup } from '../../src/services/quotationFlyerMarkup';
import type { Quotation } from '../../src/types';

const quote: Quotation = {
  id: 'cot-preview',
  package_id: null,
  reference: 'COT-2026-059',
  client_name: 'Sandra Colognesi',
  status: 'draft',
  currency: 'EUR',
  exchange_rate: null,
  exchange_rate_date: null,
  created_at: '2026-11-11T09:30:00Z',
  updated_at: '2026-11-11T09:30:00Z',
  archived_at: null,
  data: {
    origin: 'Porto',
    destination: 'Paris',
    proposalDate: '2026-11-11',
    dates: { startDate: '2027-04-02', endDate: '2027-04-05', durationDays: 4, durationNights: 3 },
    passengers: { adults: 2, children: 0, infants: 0 },
    depositAmount: 250,
    balanceDueDate: '2027-03-20',
    notIncluded: ['Taxa local de 34€ paga no hotel', 'Bagagem despachada'],
    financials: {
      currency: 'EUR',
      components: [],
      totalCost: 400,
      salePrice: 700,
      pricePerPerson: 350,
      profit: 300,
      profitPercent: 42.86,
      taxesAndFeesTotal: 0,
    },
    services: [
      {
        id: 'out', type: 'outbound_transport', description: 'Voo de ida Porto (OPO) para Paris (ORY)',
        carrier: 'easyJet', currency: 'EUR', amount: 0, quantity: 1,
        departureTime: '12:15', arrivalTime: '15:25', notes: 'Bagagem de mão incluída',
      },
      {
        id: 'in', type: 'inbound_transport', description: 'Voo de volta Paris (ORY) para Porto (OPO)',
        carrier: 'easyJet', currency: 'EUR', amount: 0, quantity: 1,
        departureTime: '21:40', arrivalTime: '23:05', notes: 'Bagagem de mão incluída',
      },
      {
        id: 'hotel', type: 'accommodation', description: 'Ibis Paris Alésia Montparnasse 14ème',
        currency: 'EUR', amount: 0, quantity: 1, mealPlan: 'Café da manhã (BB)',
      },
      { id: 'a1', type: 'transfer', description: 'Transfer aeroporto', currency: 'EUR', amount: 0, quantity: 1 },
      { id: 'a2', type: 'insurance', description: 'Seguro-viagem', currency: 'EUR', amount: 0, quantity: 1 },
    ],
  },
};

const result = createQuotationFlyer(quote);
if (!result.model) throw new Error(`fixture inválida: ${result.errors.join(' | ')}`);
const model = {
  ...result.model,
  subtitle: 'Paris na primavera, entre cafés e boulevards',
  imageUrl: travelPhoto as string,
};

const fontFaces = [
  [400, regular], [500, medium], [600, semibold], [700, bold],
].map(([weight, source]) => `@font-face{font-family:Poppins;src:url("${source}") format("truetype");font-weight:${weight};font-style:normal;font-display:block;}`).join('\n');
const tokenCss = tokens.replace(/@font-face\s*\{[^}]*\}/g, '');
const markup = renderQuotationFlyerMarkup(model, logo as string);

export default `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Conferência — proposta de viagem</title>
<style>${fontFaces}
${tokenCss}
${flyerCss}
html,body{margin:0;background:var(--color-inverse-bg)}
body{display:flex;align-items:center;justify-content:center;min-height:100vh}
.quotation-flyer{width:1080px;max-width:none}
</style></head><body>${markup}</body></html>`;
