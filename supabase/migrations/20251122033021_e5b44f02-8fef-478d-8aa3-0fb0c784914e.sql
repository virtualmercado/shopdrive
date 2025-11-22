-- Expandir roles do sistema (migration separada)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'financeiro') THEN
    ALTER TYPE app_role ADD VALUE 'financeiro';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'suporte') THEN
    ALTER TYPE app_role ADD VALUE 'suporte';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'tecnico') THEN
    ALTER TYPE app_role ADD VALUE 'tecnico';
  END IF;
END $$;