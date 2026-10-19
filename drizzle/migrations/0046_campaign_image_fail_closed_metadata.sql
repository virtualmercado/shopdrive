DO $$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('public._campaign_master_image(uuid,text,text)'::regprocedure);
 d:=replace(d,'m.mime_type NOT IN','coalesce(m.mime_type,'''') NOT IN');
 d:=replace(d,'m.size NOT BETWEEN','coalesce(m.size,0) NOT BETWEEN');
 d:=replace(d,'m.file_path !~','coalesce(m.file_path,'''') !~');
 d:=replace(d,'m.url <>','coalesce(m.url,'''') <>');
 d:=replace(d,'o.metadata->>''mimetype'' NOT IN','coalesce(o.metadata->>''mimetype'','''') NOT IN');
 d:=replace(d,'(o.metadata->>''size'')::bigint NOT BETWEEN','coalesce((o.metadata->>''size'')::bigint,0) NOT BETWEEN');
 EXECUTE d;
END $$;