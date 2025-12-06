-- Add weight and dimensions columns to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS length NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS height NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS width NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS variations JSONB DEFAULT '[]'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.products.weight IS 'Product weight in kg';
COMMENT ON COLUMN public.products.length IS 'Product length in cm';
COMMENT ON COLUMN public.products.height IS 'Product height in cm';
COMMENT ON COLUMN public.products.width IS 'Product width in cm';
COMMENT ON COLUMN public.products.variations IS 'Product variations as JSON array of {name, values} objects';