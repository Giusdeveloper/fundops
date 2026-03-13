ALTER TABLE public.fundops_rounds
  ADD COLUMN IF NOT EXISTS drive_folder_id text,
  ADD COLUMN IF NOT EXISTS drive_subfolders jsonb;
