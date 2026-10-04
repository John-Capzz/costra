ALTER TABLE browser_sessions
  ADD COLUMN IF NOT EXISTS csrf_token TEXT;

UPDATE browser_sessions
   SET csrf_token = encode(gen_random_bytes(32), 'hex')
 WHERE csrf_token IS NULL;

ALTER TABLE browser_sessions
  ALTER COLUMN csrf_token SET NOT NULL;
