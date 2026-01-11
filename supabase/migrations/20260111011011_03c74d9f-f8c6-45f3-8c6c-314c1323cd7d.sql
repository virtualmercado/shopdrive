-- First create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create table to store media file metadata
CREATE TABLE public.media_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admin only access (users with admin role can manage)
CREATE POLICY "Admins can view all media files"
ON public.media_files
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can insert media files"
ON public.media_files
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can update media files"
ON public.media_files
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete media files"
ON public.media_files
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Storage policies for media-library bucket
CREATE POLICY "Anyone can view media library files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'media-library');

CREATE POLICY "Admins can upload to media library"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'media-library' AND
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can update in media library"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'media-library' AND
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete from media library"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'media-library' AND
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_media_files_updated_at
BEFORE UPDATE ON public.media_files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();