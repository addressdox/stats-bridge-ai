REVOKE EXECUTE ON FUNCTION public.search_passages(text,int) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.search_observations(text,int) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.write_audit(uuid,text,text,uuid,uuid,text,text,jsonb,audit_origin) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.flag_source_change(uuid,void_reason,uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.open_case(case_kind,text,review_reason[],text,channel,uuid,text,text,text,boolean,timestamptz,text,boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.erase_contacts() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.next_case_reference() FROM authenticated, anon, PUBLIC;