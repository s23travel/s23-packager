import { createRoot } from 'react-dom/client';
import { PackageFlyerCreator } from '../src/components/packages/PackageFlyerCreator';
import type { Package } from '../src/types';
import '../design-system/s23-travel/colors_and_type.css';
import '../src/components/packages/packageFlyer.css';

const fixture: Package = {
  id: 'fixture', reference: 'EXEMPLO', name: 'Viagem fictícia', status: 'draft', base_currency: 'BRL', created_at: '', updated_at: '',
  data: {
    origin: 'Porto', destination: 'Açores', dates: { startDate: '2027-04-12', endDate: '2027-04-19' },
    passengers: { adults: 2, children: 0, infants: 0 },
    financials: { currency: 'BRL', components: [], totalCost: 0, salePrice: 1496, pricePerPerson: 748, profit: 0, profitPercent: 0, taxesAndFeesTotal: 0 },
    paymentConditions: '10x sem juros',
    services: [
      { id: '1', type: 'outbound_transport', description: 'Voo', currency: 'BRL', amount: 0, quantity: 1 },
      { id: '2', type: 'accommodation', description: 'Hospedagem', mealPlan: 'Café da manhã (BB)', currency: 'BRL', amount: 0, quantity: 1 },
      { id: '3', type: 'insurance', description: 'Seguro', currency: 'BRL', amount: 0, quantity: 1 },
      { id: '4', type: 'transfer', description: 'Transfer', currency: 'BRL', amount: 0, quantity: 1 },
    ],
  },
};

createRoot(document.getElementById('root')!).render(<PackageFlyerCreator package={fixture} />);
