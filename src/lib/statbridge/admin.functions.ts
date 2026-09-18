import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { DeskSettings } from "./settings.server";

type Ctx = { userId: string; supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> } };
async function permission(context: Ctx, key: string) {
  const result = await context.supabase.rpc("has_permission", { _uid: context.userId, _permission: key });
  if (result.error || result.data !== true) throw new Error(`Your account does not have ${key} access.`);
  return context.userId;
}

export const getDeskSettings = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<DeskSettings> => {
  await permission(context as never, "dashboard.view");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { readDeskSettings } = await import("./settings.server");
  return readDeskSettings(supabaseAdmin);
});

const settingsPatchSchema = z.object({
  desk_name:z.string().trim().min(3).max(160).optional(), support_email:z.string().trim().email().or(z.literal("")).optional(),
  officer_phone:z.string().trim().max(40).optional(), officer_phone_label:z.string().trim().min(2).max(80).optional(), phone_handover_enabled:z.boolean().optional(),
  office_hours:z.string().trim().min(3).max(120).optional(), time_zone:z.string().trim().min(3).max(60).optional(), notify_email:z.string().trim().email().or(z.literal("")).optional(),
  handover_response_minutes:z.number().int().min(1).max(240).optional(), visitor_retention_days:z.number().int().min(30).max(3650).optional(),
  voice_enabled:z.boolean().optional(), widget_enabled:z.boolean().optional(), public_api_enabled:z.boolean().optional(), crawler_enabled:z.boolean().optional(), media_auto_escalate:z.boolean().optional(),
});
export type DeskSettingsPatch = z.infer<typeof settingsPatchSchema>;
export const saveDeskSettings = createServerFn({ method:"POST" }).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>settingsPatchSchema.parse(i)).handler(async({context,data}):Promise<DeskSettings>=>{
  await permission(context as never,"settings.manage"); const result=await (context as unknown as Ctx).supabase.rpc("save_desk_settings",{_patch:data});
  if(result.error) throw new Error("The settings could not be saved."); return result.data as DeskSettings;
});

export type AccessRole={id:string;key:string;name:string;description:string;isSystem:boolean;isActive:boolean;permissions:string[]};
export type Permission={key:string;groupName:string;name:string;description:string};
export type StaffMember={id:string;fullName:string;isActive:boolean;isDemo:boolean;email:string|null;lastSignInAt:string|null;createdAt:string;roles:AccessRole[]};

export const getStaffAdministration=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  await permission(context as never,"staff.view"); const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
  const [profiles,accounts,roles,permissions,assignments,invitations]=await Promise.all([
    db.from("profiles").select("id,full_name,is_active,is_demo,created_at").order("created_at"), db.auth.admin.listUsers({page:1,perPage:500}),
    db.from("roles").select("id,key,name,description,is_system,is_active,role_permissions(permission_key)").order("name"),
    db.from("permissions").select("key,group_name,name,description").order("group_name").order("name"),
    db.from("user_roles").select("user_id,role_id"), db.from("staff_invitations").select("id,email,full_name,role_ids,status,expires_at,accepted_at,created_at").order("created_at",{ascending:false}),
  ]);
  const roleRows=(roles.data??[]).map((r:any)=>({id:r.id,key:r.key,name:r.name,description:r.description,isSystem:r.is_system,isActive:r.is_active,permissions:(r.role_permissions??[]).map((p:any)=>p.permission_key)}));
  const roleMap=new Map(roleRows.map((r)=>[r.id,r])); const accountMap=new Map((accounts.data?.users??[]).map(u=>[u.id,u]));
  const assigned=new Map<string,string[]>(); for(const row of assignments.data??[])assigned.set(row.user_id,[...(assigned.get(row.user_id)??[]),row.role_id]);
  return { roles:roleRows, permissions:(permissions.data??[]).map(p=>({key:p.key,groupName:p.group_name,name:p.name,description:p.description})),
    staff:(profiles.data??[]).map(p=>({id:p.id,fullName:p.full_name,isActive:p.is_active,isDemo:p.is_demo,email:accountMap.get(p.id)?.email??null,lastSignInAt:accountMap.get(p.id)?.last_sign_in_at??null,createdAt:p.created_at,roles:(assigned.get(p.id)??[]).map(id=>roleMap.get(id)).filter(Boolean)})),
    invitations:invitations.data??[] };
});

export const setStaffRoles=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({staffId:z.string().uuid(),roleIds:z.array(z.string().uuid()).min(1)}).parse(i)).handler(async({context,data})=>{
  await permission(context as never,"roles.manage"); const result=await (context as unknown as Ctx).supabase.rpc("set_user_roles",{_target:data.staffId,_role_ids:data.roleIds});
  if(result.error) throw new Error((result.error as {message?:string}).message??"Roles could not be changed."); return {ok:true};
});

export const setStaffActive=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({staffId:z.string().uuid(),isActive:z.boolean(),reason:z.string().trim().min(3).max(500)}).parse(i)).handler(async({context,data})=>{
  await permission(context as never,"staff.manage"); const result=await (context as unknown as Ctx).supabase.rpc("set_staff_active",{_target:data.staffId,_active:data.isActive,_reason:data.reason});
  if(result.error) throw new Error((result.error as {message?:string}).message??"Account status could not be changed.");
  if(!data.isActive){const {supabaseAdmin}=await import("@/integrations/supabase/client.server"); await supabaseAdmin.auth.admin.signOut(data.staffId,"global");} return {ok:true};
});

export const inviteStaff=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({email:z.string().trim().email(),fullName:z.string().trim().min(2).max(120),roleIds:z.array(z.string().uuid()).min(1)}).parse(i)).handler(async({context,data})=>{
  const actor=await permission(context as never,"staff.manage"); await permission(context as never,"roles.manage");
  const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
  const {data:validRoles}=await db.from("roles").select("id").in("id",data.roleIds).eq("is_active",true); if((validRoles??[]).length!==data.roleIds.length)throw new Error("One or more roles are unavailable.");
  const {data:invited,error}=await db.auth.admin.inviteUserByEmail(data.email,{data:{full_name:data.fullName}}); if(error||!invited.user)throw new Error(error?.message??"Invitation could not be sent.");
  const legacyRole=(await db.from("roles").select("key").in("id",data.roleIds)).data?.some(r=>r.key==="super_administrator")?"administrator":"official";
  await db.from("profiles").upsert({id:invited.user.id,full_name:data.fullName,role:legacyRole,is_active:true,created_by:actor});
  await db.from("user_roles").insert(data.roleIds.map(roleId=>({user_id:invited.user.id,role_id:roleId,granted_by:actor})));
  await db.from("staff_invitations").upsert({email:data.email,full_name:data.fullName,role:legacyRole,role_ids:data.roleIds,status:"pending",invited_by:actor,expires_at:new Date(Date.now()+7*86400000).toISOString(),accepted_at:null},{onConflict:"email"});
  await db.from("audit_events").insert({actor_id:actor,actor_role:"staff",action:"staff_invited",entity_kind:"profile",entity_id:invited.user.id,detail:{roles:data.roleIds},origin:"screen"});
  return {ok:true};
});

export const createRole=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({name:z.string().trim().min(3).max(80),description:z.string().trim().max(300),permissionKeys:z.array(z.string()).min(1)}).parse(i)).handler(async({context,data})=>{
  const actor=await permission(context as never,"roles.manage"); const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
  const key=data.name.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"").slice(0,63); if(key.length<3)throw new Error("Use a more descriptive role name.");
  const {data:role,error}=await db.from("roles").insert({key,name:data.name,description:data.description,is_system:false,created_by:actor}).select("id").single(); if(error)throw new Error(error.message);
  const {error:grantError}=await db.from("role_permissions").insert(data.permissionKeys.map(permission_key=>({role_id:role.id,permission_key}))); if(grantError)throw new Error(grantError.message);
  return {ok:true,roleId:role.id};
});

export const updateMyProfile=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({fullName:z.string().trim().min(2).max(120)}).parse(i)).handler(async({context,data})=>{
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server"); const {error}=await supabaseAdmin.from("profiles").update({full_name:data.fullName}).eq("id",context.userId); if(error)throw new Error("Your name could not be saved."); return {ok:true};
});