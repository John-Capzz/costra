ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS wallet_address TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'agents_wallet_address_format'
       AND conrelid = 'agents'::regclass
  ) THEN
    ALTER TABLE agents
      ADD CONSTRAINT agents_wallet_address_format
      CHECK (wallet_address IS NULL OR wallet_address ~ '^0x[0-9a-fA-F]{40}$');
  END IF;
END $$;
