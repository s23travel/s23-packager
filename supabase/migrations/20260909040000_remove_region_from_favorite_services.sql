-- Migration: 20260909040000_remove_region_from_favorite_services.sql
-- Descrição: Remove o campo 'region' do catálogo de serviços favoritos (favorite_services)
-- A localização agora é composta exclusivamente por 'country' (obrigatório) e 'city' (opcional).

ALTER TABLE favorite_services DROP COLUMN IF EXISTS region;
