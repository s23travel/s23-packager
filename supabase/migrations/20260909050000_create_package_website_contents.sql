-- Migration: 20260909050000_create_package_website_contents.sql
-- Descrição: Criação da tabela 'package_website_contents' para persistir a última versão válida do conteúdo para website do Pacote Base

CREATE TABLE IF NOT EXISTS package_website_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  markdown TEXT NOT NULL,
  filename TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_package_website_contents_package_id UNIQUE (package_id)
);

-- Índice para busca rápida por package_id
CREATE INDEX IF NOT EXISTS idx_package_website_contents_package_id ON package_website_contents(package_id);

-- Trigger para atualização automática de updated_at
DROP TRIGGER IF EXISTS tr_package_website_contents_set_updated_at ON package_website_contents;
CREATE TRIGGER tr_package_website_contents_set_updated_at
BEFORE UPDATE ON package_website_contents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Habilitar Row Level Security (RLS)
ALTER TABLE package_website_contents ENABLE ROW LEVEL SECURITY;

-- Política de RLS: permite acesso total para anon e authenticated (padrão atual da aplicação interna)
DROP POLICY IF EXISTS "Allow anon and authenticated all on package_website_contents" ON package_website_contents;
CREATE POLICY "Allow anon and authenticated all on package_website_contents"
ON package_website_contents
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Comentários descritivos do schema
COMMENT ON TABLE package_website_contents IS 'Armazena a última versão salva e validada do conteúdo editorial para website e seu respectivo Markdown determinístico para cada Pacote Base.';
COMMENT ON COLUMN package_website_contents.package_id IS 'Referência 1:1 ao Pacote Base. ON DELETE CASCADE garante que ao deletar o pacote o conteúdo associado seja removido.';
COMMENT ON COLUMN package_website_contents.content IS 'StructuredPackageContent completo em formato JSONB, permitindo reabrir o editor a qualquer momento.';
COMMENT ON COLUMN package_website_contents.markdown IS 'Último Markdown determinístico validado gerado a partir do conteúdo salvo.';
COMMENT ON COLUMN package_website_contents.filename IS 'Nome do arquivo .md derivado do slug atual para download direto.';
