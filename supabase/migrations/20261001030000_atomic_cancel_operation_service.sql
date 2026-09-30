-- Migration: 20261001030000_atomic_cancel_operation_service.sql
-- Descrição: Função atômica cancel_operation_service para cancelamento em transação única:
-- 1. Bloqueia o serviço e seus pagamentos previstos (FOR UPDATE)
-- 2. Recusa o cancelamento se existir pagamento parcial, liquidado ou movimentação real
-- 3. Altera o serviço para 'cancelled'
-- 4. Altera todos os pagamentos previstos abertos vinculados para 'cancelled'
-- 5. Rollback total garantido caso qualquer etapa falhe

CREATE OR REPLACE FUNCTION cancel_operation_service(
  p_service_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_service RECORD;
  v_cancelled_commitments_count INT := 0;
BEGIN
  -- 1. Bloquear o serviço para atualização e verificar existência
  SELECT * INTO v_service
  FROM financial_operation_services
  WHERE id = p_service_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço financeiro com ID % não foi encontrado.', p_service_id;
  END IF;

  -- 2. Bloquear todos os pagamentos vinculados ao serviço
  PERFORM id
  FROM financial_commitments
  WHERE operation_service_id = p_service_id
  FOR UPDATE;

  -- 3. Recusar se existir pagamento parcial ou liquidado
  IF EXISTS (
    SELECT 1
    FROM financial_commitments
    WHERE operation_service_id = p_service_id
      AND status IN ('partially_settled', 'settled')
  ) THEN
    RAISE EXCEPTION 'Não é possível cancelar um serviço que possui pagamentos já realizados ou parcialmente liquidados sem tratar reembolso ou multa.';
  END IF;

  -- 4. Recusar se existir movimentação real (transações registradas)
  IF EXISTS (
    SELECT 1
    FROM financial_transactions ft
    INNER JOIN financial_commitments fc ON fc.id = ft.commitment_id
    WHERE fc.operation_service_id = p_service_id
  ) THEN
    RAISE EXCEPTION 'Não é possível cancelar um serviço cujos pagamentos já possuem movimentações financeiras registradas sem tratar reembolso ou multa.';
  END IF;

  -- 5. Alterar o serviço para 'cancelled'
  UPDATE financial_operation_services
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = p_service_id;

  -- 6. Alterar todos os pagamentos previstos abertos vinculados ('planned') para 'cancelled'
  WITH updated_rows AS (
    UPDATE financial_commitments
    SET status = 'cancelled',
        updated_at = now()
    WHERE operation_service_id = p_service_id
      AND status = 'planned'
    RETURNING id
  )
  SELECT count(*) INTO v_cancelled_commitments_count
  FROM updated_rows;

  -- 7. Retornar dados consolidados
  RETURN jsonb_build_object(
    'service_id', p_service_id,
    'status', 'cancelled',
    'cancelled_commitments_count', v_cancelled_commitments_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_operation_service(UUID) TO anon, authenticated;

COMMENT ON FUNCTION cancel_operation_service(UUID) IS
'Cancela atomicamente um serviço financeiro e todos os seus pagamentos abertos vinculados, bloqueando registros e impedindo cancelamento em caso de liquidações ou movimentações reais.';
