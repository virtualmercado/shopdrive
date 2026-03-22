-- Reset failed status back to pending so backfill can retry
UPDATE profiles
SET template_apply_status = 'pending',
    template_apply_error = null,
    template_applied = false
WHERE source_template_id IS NOT NULL
  AND template_apply_status = 'failed';