-- Repõe comentários de catálogo que existem nas migrations locais mas faltam
-- ou estão abreviados no PROD. Não altera dados, regras, grants ou RLS.
DO $migration$
BEGIN
  EXECUTE format('COMMENT ON TABLE public.favorite_services IS %L', 'Catálogo de serviços reutilizáveis (hotéis, aéreas, transfers, etc.) para preenchimento de novos pacotes. Fonte de dados apenas — packages mantêm snapshot próprio.');
  EXECUTE format('COMMENT ON TABLE public.package_website_contents IS %L', 'Armazena a última versão salva e validada do conteúdo editorial para website e seu respectivo Markdown determinístico para cada Pacote Base.');
  EXECUTE format('COMMENT ON COLUMN public.package_website_contents.package_id IS %L', 'Referência 1:1 ao Pacote Base. ON DELETE CASCADE garante que ao deletar o pacote o conteúdo associado seja removido.');
  EXECUTE format('COMMENT ON COLUMN public.package_website_contents.content IS %L', 'StructuredPackageContent completo em formato JSONB, permitindo reabrir o editor a qualquer momento.');
  EXECUTE format('COMMENT ON COLUMN public.package_website_contents.markdown IS %L', 'Último Markdown determinístico validado gerado a partir do conteúdo salvo.');
  EXECUTE format('COMMENT ON COLUMN public.package_website_contents.filename IS %L', 'Nome do arquivo .md derivado do slug atual para download direto.');

  EXECUTE format('COMMENT ON TABLE public.financial_commitments IS %L', 'Compromissos previstos a receber (cliente) ou a pagar (fornecedor) com conta e data configuráveis');
  EXECUTE format('COMMENT ON COLUMN public.financial_transactions.destination_amount IS %L', 'Valor que entra na conta destino em caso de transferência');
  EXECUTE format('COMMENT ON COLUMN public.financial_transactions.destination_currency IS %L', 'Moeda de destino da transferência (EUR ou BRL)');
  EXECUTE format('COMMENT ON COLUMN public.financial_transactions.exchange_rate IS %L', 'Taxa de câmbio aplicada na conversão da transferência');
  EXECUTE format('COMMENT ON COLUMN public.financial_transactions.transfer_fee IS %L', 'Custo ou taxa de remessa/bancária cobrada na transferência');
  EXECUTE format('COMMENT ON COLUMN public.financial_commitments.origin_commitment_id IS %L', 'ID do compromisso original do fornecedor pago via cartão de crédito');
  EXECUTE format('COMMENT ON COLUMN public.financial_commitments.credit_card_account_id IS %L', 'Conta do cartão de crédito que originou a fatura');
  EXECUTE format('COMMENT ON COLUMN public.financial_transactions.type IS %L', E'Tipo da movimentação: inflow (entrada), outflow (saída), transfer (transferência entre contas),\n    refund (reembolso associado a cancelamento de operação),\n    balance_adjustment (ajuste manual de saldo positivo/negativo sem vínculo a cotação)');

  EXECUTE format('COMMENT ON FUNCTION public.approve_quotation_and_create_operation(uuid, text) IS %L', 'Aprova atomicamente uma cotação e inicializa sua operação financeira com serviços e previsões');
  EXECUTE format('COMMENT ON FUNCTION public.cancel_operation_service(uuid) IS %L', 'Cancela atomicamente um serviço financeiro e todos os seus pagamentos abertos vinculados, bloqueando registros e impedindo cancelamento em caso de liquidações ou movimentações reais.');
  EXECUTE format('COMMENT ON FUNCTION public.record_commitment_settlement(uuid, uuid, numeric, timestamptz, text, text, date) IS %L', 'Registra de forma atômica uma movimentação financeira real de liquidação de compromisso e atualiza seu status para partially_settled ou settled.');
  EXECUTE format('COMMENT ON FUNCTION public.record_account_transfer(uuid, uuid, numeric, numeric, numeric, numeric, text, timestamptz, text, text, uuid) IS %L', 'Registra de forma atômica uma transferência entre contas financeiras ativas com validação cambial e bloqueio estrito de cartões de crédito.');
END;
$migration$;
