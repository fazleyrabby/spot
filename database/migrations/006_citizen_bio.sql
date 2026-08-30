-- C1: a compact pinned mini-home bio for each citizen.
ALTER TABLE citizens
  ADD COLUMN IF NOT EXISTS bio VARCHAR(280);
