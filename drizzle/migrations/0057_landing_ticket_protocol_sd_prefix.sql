-- New landing ticket protocols use SD-LP-YYYYMMDD-NNNN; historical VM-LP-* values are untouched.
-- ROLLBACK: recreate this function replacing 'SD-LP-' with 'VM-LP-' in both places.
CREATE OR REPLACE FUNCTION public.generate_landing_ticket_protocol()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  today_date TEXT;
  ticket_count INTEGER;
  new_protocol TEXT;
BEGIN
  today_date := to_char(now(), 'YYYYMMDD');
  
  SELECT COUNT(*) + 1 INTO ticket_count
  FROM public.tickets_landing_page
  WHERE protocolo LIKE 'SD-LP-' || today_date || '%';
  
  new_protocol := 'SD-LP-' || today_date || '-' || lpad(ticket_count::TEXT, 4, '0');
  NEW.protocolo := new_protocol;
  
  RETURN NEW;
END;
$function$;