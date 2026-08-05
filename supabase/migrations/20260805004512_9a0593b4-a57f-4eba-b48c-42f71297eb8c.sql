DO $$
DECLARE
  v_expected integer;
  v_updated integer;
  v_remaining integer;
BEGIN
  SELECT count(*) INTO v_expected
  FROM public.profiles
  WHERE store_layout IN ('modelo-1', 'modelo-2', 'modelo-3');

  RAISE NOTICE 'legacy store_layout rows found: %', v_expected;

  UPDATE public.profiles
  SET store_layout = CASE store_layout
        WHEN 'modelo-1' THEN 'layout_01'
        WHEN 'modelo-2' THEN 'layout_02'
        WHEN 'modelo-3' THEN 'layout_03'
      END
  WHERE store_layout IN ('modelo-1', 'modelo-2', 'modelo-3');

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  SELECT count(*) INTO v_remaining
  FROM public.profiles
  WHERE store_layout IN ('modelo-1', 'modelo-2', 'modelo-3');

  IF v_updated <> v_expected OR v_remaining <> 0 THEN
    RAISE EXCEPTION 'store_layout backfill mismatch: expected %, updated %, remaining %',
      v_expected, v_updated, v_remaining;
  END IF;

  RAISE NOTICE 'store_layout backfill OK: % rows normalized, 0 legacy remaining', v_updated;
END $$;