ALTER TABLE public.domain_verification_logs DROP CONSTRAINT domain_verification_logs_verification_type_check;
ALTER TABLE public.domain_verification_logs ADD CONSTRAINT domain_verification_logs_verification_type_check
  CHECK (verification_type IN ('dns','ssl','claim','ns','ownership_txt','dns_target','routing','disconnect','revalidation'));