-- Indice per lookup inviti per token_hash
CREATE INDEX IF NOT EXISTS idx_fundops_invites_token_hash ON public.fundops_invites(token_hash);
