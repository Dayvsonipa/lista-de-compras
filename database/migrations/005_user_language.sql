-- Preferência individual de idioma: português, inglês ou espanhol.
-- Execute depois de 004_product_catalog_and_purchase_history.sql.
-- Esta migração não apaga nem modifica os demais dados dos usuários.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) NOT NULL DEFAULT 'pt-BR';

UPDATE users
SET preferred_language = 'pt-BR'
WHERE preferred_language NOT IN ('pt-BR', 'en', 'es')
   OR preferred_language IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_preferred_language_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_preferred_language_check
      CHECK (preferred_language IN ('pt-BR', 'en', 'es'));
  END IF;
END $$;

SELECT
  preferred_language,
  COUNT(*) AS users
FROM users
GROUP BY preferred_language
ORDER BY preferred_language;
