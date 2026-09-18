REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_staff_role(uuid, public.staff_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_role_of(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_staff_role(uuid, public.staff_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_role_of(uuid) TO authenticated, service_role;