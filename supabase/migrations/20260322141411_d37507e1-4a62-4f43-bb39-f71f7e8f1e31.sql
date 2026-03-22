-- Retroactively tag known Aroma-related accounts with source_template_id
-- These accounts have names clearly indicating they came from the Aroma activation link
-- but were created before the code fix was deployed

UPDATE profiles SET
  source_template_id = '592f757f-c8b5-4a25-99b9-1795f3f11e16',
  template_apply_status = 'pending'
WHERE id IN (
  'd17d24ef-86db-46d4-b993-37f5f0681e15',  -- Aroma - produtores naturais - Humaitá
  '428ef708-b724-48ee-a6f0-3bf53a88a74d',  -- Aroma Ativo
  '0c9657d6-9367-409b-96ff-5cd66a587624',  -- Aroma produtos naturais da Amazônia
  '7a38b411-b812-4b2d-8c52-ea5a06a8305d',  -- AROMA BELÉM
  'd8489e3e-6089-4710-8e63-369280b36e98',  -- Aroma ativo
  '9c6704a7-5b9a-433c-ab20-06cdaa224f0a',  -- Aroma Ativo (older)
  '49495fa3-ad7d-4605-9ec7-70b12330bdbe',  -- Doce essências produtos naturais
  '2e2d8946-a29c-4a3b-9adf-d1328e0872c6',  -- Riquezas da Amazonia
  '9bb6d7a0-5153-4342-bc75-f5bf4ffadf57',  -- Mel produtos naturais
  '18aa7dad-bc89-4b06-a731-a28d079b9d6b',  -- Flor de Girassol
  '635e5a89-6c19-48b8-af00-dca20d7dd098',  -- Vivy lemes beleza
  '7118a953-1988-409a-8d05-f10c777d6cff',  -- Cantinho_da_bia2000
  '6cebf8fd-12fc-472a-ac36-1803167cda0f',  -- D.C
  '10810bc9-b3db-44c4-9733-f70a316fa4c2',  -- Minha loja virtual S.B
  'f72739ea-c130-4dfc-9b27-b40c62a3b434',  -- Klauscosmético
  'a2ec9e26-b534-4a4f-938a-f820c1a30bd2',  -- Anna's Store
  '1c8845e2-6798-417b-99d1-1396585aef8b'   -- Esquerdo
)
AND source_template_id IS NULL
AND is_template_profile IS NOT TRUE;

-- Also update handle_new_user to capture template_id from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_store_name TEXT;
  v_store_slug TEXT;
  v_template_id UUID;
BEGIN
  v_store_name := COALESCE(NEW.raw_user_meta_data->>'store_name', '');
  
  IF v_store_name != '' THEN
    v_store_slug := public.generate_store_slug(v_store_name);
  ELSE
    v_store_slug := NULL;
  END IF;
  
  -- Capture template_id from signup metadata if present
  IF NEW.raw_user_meta_data->>'template_id' IS NOT NULL THEN
    v_template_id := (NEW.raw_user_meta_data->>'template_id')::UUID;
  ELSE
    v_template_id := NULL;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, store_name, store_slug, source_template_id, template_apply_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_store_name,
    v_store_slug,
    v_template_id,
    CASE WHEN v_template_id IS NOT NULL THEN 'pending' ELSE NULL END
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$function$;