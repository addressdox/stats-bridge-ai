import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, FileText, Globe2, Loader2, Radar, Search, UploadCloud } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Empty, Panel, Pill, StatCard } from "@/components/statbridge/desk-ui";
import { StaffShell } from "@/components/statbridge/StaffShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { runKnowledgeCrawl } from "@/lib/statbridge/crawl.functions";
import { decideKnowledgeSource, ingestKnowledgeFile, ingestKnowledgeUrl, listKnowledgeSources, openKnowledgeOriginal, reviewKnowledgeSource, verifyFigures } from "@/lib/statbridge/knowledge.functions";
import { useStaff } from "@/lib/staff/useStaff";

const title="Knowledge library — StatBridge staff";
export const Route=createFileRoute("/staff/knowledge/sources")({head:()=>({meta:[{title},{name:"robots",content:"noindex"}]}),component:SourcesPage});
const input="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm";
type Meta={sourceId?:string;audience:"public"|"staff";versionLabel:string;title:string;publisher:string;sourceType:"statistical_release"|"media_release"|"methodology"|"organisational_page"|"faq_page"|"other";topic:string;publishedOn:string;referencePeriod:string};
const blank:Meta={audience:"public",versionLabel:"",title:"",publisher:"Statistics South Africa",sourceType:"statistical_release",topic:"",publishedOn:"",referencePeriod:""};

function SourcesPage(){
 const {profile,hasPermission}=useStaff(); const qc=useQueryClient(); const [tab,setTab]=useState<"file"|"url">("file"); const [meta,setMeta]=useState(blank); const [url,setUrl]=useState(""); const [file,setFile]=useState<File|null>(null); const [search,setSearch]=useState("");
 const fetchList=useServerFn(listKnowledgeSources), ingestFile=useServerFn(ingestKnowledgeFile), ingestUrl=useServerFn(ingestKnowledgeUrl), decide=useServerFn(decideKnowledgeSource);
 const list=useQuery({queryKey:["knowledge-library"],queryFn:()=>fetchList()}); const refresh=()=>qc.invalidateQueries({queryKey:["knowledge-library"]});
 const ingestion=useMutation({mutationFn:async()=>{if(tab==="url")return ingestUrl({data:{...meta,url}}); if(!file||!profile)throw new Error("Choose a file first."); if(file.size===0||file.size>25_000_000)throw new Error("Choose a non-empty file no larger than 25 MB."); const path=`${profile.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"-")}`; const up=await supabase.storage.from("knowledge-files").upload(path,file,{upsert:false}); if(up.error)throw new Error(up.error.message); return ingestFile({data:{...meta,storagePath:path,fileName:file.name,mimeType:file.type||"application/octet-stream",fileSize:file.size}});},onSuccess:r=>{if(r.duplicate){toast.info(`This exact document is already registered as ${r.sourceTitle}. Status: ${r.status}.`);setSearch(r.sourceTitle??"");}else{toast.success(`${r.passages} extracts created. Review before approval.`);setSearch("");}setMeta(blank);setUrl("");setFile(null);void refresh();},onError:(e:Error)=>{toast.error(e.message);void refresh();}});
 const action=useMutation({mutationFn:(d:{versionId:string;action:"approve"|"reject"|"withdraw";reason?:string;approval_basis?:"demonstration"|"official"})=>decide({data:d}),onSuccess:()=>{toast.success("Source register updated.");void refresh();},onError:(e:Error)=>toast.error(e.message)});
 const crawl=useMutation({mutationFn:()=>runKnowledgeCrawl(),onSuccess:r=>{toast.success(`Crawler proposed ${r.inserted.length} new publications.`);void refresh();},onError:(e:Error)=>toast.error(e.message)});
 const replaceSource=(v:any)=>{setMeta({sourceId:v.source_id,audience:v.sources?.audience??"public",versionLabel:"",title:v.sources?.title??"",publisher:v.sources?.publisher??"Statistics South Africa",sourceType:v.sources?.source_type??"other",topic:v.sources?.topic??"",publishedOn:"",referencePeriod:v.reference_period??""});setUrl(v.original_url??"");setFile(null);document.getElementById("add-knowledge")?.scrollIntoView({behavior:"smooth",block:"start"});};
 const rows=useMemo(()=>((list.data??[]) as any[]).filter(v=>`${v.sources?.title} ${v.sources?.publisher} ${v.sources?.topic} ${v.sources?.source_type?.replaceAll("_"," ")} ${v.sources?.audience} ${v.version_label} ${v.job?.file_name??""} ${v.id}`.toLowerCase().includes(search.toLowerCase())),[list.data,search]);
 const pending=rows.filter(r=>r.status==="pending").length, failed=rows.filter(r=>r.job?.state==="failed").length;
 return <StaffShell title="Knowledge library"><div className="space-y-5">
  <div><p className="max-w-3xl text-sm text-muted-foreground">Bring official South African publications into a controlled pipeline: capture, extract, inspect, verify and approve. Extracted text stays private and cannot answer public questions until approval.</p></div>
  <div className="grid gap-3 sm:grid-cols-4"><StatCard label="Versions" value={rows.length}/><StatCard label="Awaiting review" value={pending} tone={pending?"warn":"default"}/><StatCard label="Failed jobs" value={failed} tone={failed?"warn":"default"}/><StatCard label="Searchable extracts" value={rows.reduce((n,r)=>n+(r.status==="approved"?r.counts.passages:0),0)}/></div>
  {hasPermission("sources.upload")&&<Panel title="Add knowledge" description="PDF, Word, Markdown, text, CSV, Excel, or an approved official South African URL.">
   <div className="mb-4 flex gap-2"><Button type="button" variant={tab==="file"?"default":"outline"} onClick={()=>setTab("file")}><UploadCloud/>Upload file</Button><Button type="button" variant={tab==="url"?"default":"outline"} onClick={()=>setTab("url")}><Globe2/>Official URL</Button></div>
   <form id="add-knowledge" className="grid gap-3 md:grid-cols-2" onSubmit={e=>{e.preventDefault();ingestion.mutate();}}>
    {meta.sourceId&&<div className="flex items-center justify-between gap-3 rounded border border-border p-3 text-sm md:col-span-2"><span>New version of {meta.title}. The approved version remains in use until this replacement is approved.</span><Button type="button" variant="outline" size="sm" onClick={()=>{setMeta(blank);setUrl("");setFile(null);}}>Cancel replacement</Button></div>}
    <label className="text-xs font-medium">Publication title<input required className={`${input} mt-1`} disabled={!!meta.sourceId} value={meta.title} onChange={e=>setMeta({...meta,title:e.target.value})}/></label>
    <label className="text-xs font-medium">Publisher<input required className={`${input} mt-1`} disabled={!!meta.sourceId} value={meta.publisher} onChange={e=>setMeta({...meta,publisher:e.target.value})}/></label>
    <label className="text-xs font-medium">Source type<select className={`${input} mt-1`} disabled={!!meta.sourceId} value={meta.sourceType} onChange={e=>setMeta({...meta,sourceType:e.target.value as Meta["sourceType"]})}><option value="statistical_release">Statistical release</option><option value="media_release">Media release</option><option value="methodology">Methodology</option><option value="organisational_page">Organisational page</option><option value="faq_page">FAQ page</option><option value="other">Other official source</option></select></label>
    <label className="text-xs font-medium">Topic<input className={`${input} mt-1`} placeholder="Labour market, population…" disabled={!!meta.sourceId} value={meta.topic} onChange={e=>setMeta({...meta,topic:e.target.value})}/></label>
    <label className="text-xs font-medium">Audience<select disabled={!!meta.sourceId} className={`${input} mt-1`} value={meta.audience} onChange={e=>setMeta({...meta,audience:e.target.value as Meta["audience"]})}><option value="public">Public — usable after approval</option><option value="staff">Staff only — internal drafting guidance</option></select></label>
    <label className="text-xs font-medium">Version label<input className={`${input} mt-1`} placeholder="Publication edition or correction" value={meta.versionLabel} onChange={e=>setMeta({...meta,versionLabel:e.target.value})}/></label>
    <label className="text-xs font-medium">Published date<input type="date" className={`${input} mt-1`} value={meta.publishedOn} onChange={e=>setMeta({...meta,publishedOn:e.target.value})}/></label>
    <label className="text-xs font-medium">Reference period<input className={`${input} mt-1`} placeholder="Q2 2026" value={meta.referencePeriod} onChange={e=>setMeta({...meta,referencePeriod:e.target.value})}/></label>
    <label className="text-xs font-medium md:col-span-2">{tab==="file"?"Document":"Official URL"}{tab==="file"?<input required type="file" accept=".pdf,.docx,.md,.txt,.csv,.xls,.xlsx" className={`${input} mt-1`} onChange={e=>setFile(e.target.files?.[0]??null)}/>:<input required type="url" className={`${input} mt-1`} placeholder="https://www.statssa.gov.za/..." value={url} onChange={e=>setUrl(e.target.value)}/>}</label>
    <div className="md:col-span-2"><Button disabled={ingestion.isPending}>{ingestion.isPending&&<Loader2 className="animate-spin"/>}{ingestion.isPending?"Extracting securely…":"Add and extract"}</Button></div>
   </form>
  </Panel>}
  <Panel title="Official source monitor" description="Discovery creates pending records only; it never bypasses human approval." action={hasPermission("crawler.manage")?<Button variant="outline" onClick={()=>crawl.mutate()} disabled={crawl.isPending}><Radar/>{crawl.isPending?"Running…":"Run crawler"}</Button>:null}><p className="text-sm text-muted-foreground">Monitor approved South African publishers for changed and newly published material.</p></Panel>
  <Panel title="Source register" description="Every version retains provenance, extraction health and approval state." action={<div className="relative"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground"/><input className={`${input} w-64 pl-8`} placeholder="Search sources" value={search} onChange={e=>setSearch(e.target.value)}/></div>}>
   {list.isLoading?<p className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin"/>Loading the controlled register…</p>:list.isError?<p className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">The register could not be loaded: {(list.error as Error).message}</p>:!rows.length?<Empty>No matching knowledge sources.</Empty>:<div className="space-y-3">{rows.map((v:any)=><SourceCard key={v.id} row={v} canDecide={hasPermission("sources.approve")} canVerify={hasPermission("sources.verify")} busy={action.isPending} replace={hasPermission("sources.upload")&&v.sources?.current_version_id===v.id?()=>replaceSource(v):undefined} act={(a,r,basis)=>action.mutate({versionId:v.id,action:a,...(r===undefined?{}:{reason:r}),...(basis===undefined?{}:{approval_basis:basis})})}/>)}</div>}
  </Panel>
 </div></StaffShell>;
}

type ApprovalBasis = "demonstration" | "official";

function SourceCard({row,canDecide,canVerify,busy,replace,act}:{row:any;canDecide:boolean;canVerify:boolean;busy:boolean;replace:(()=>void)|undefined;act:(a:"approve"|"reject"|"withdraw",r?:string,basis?:ApprovalBasis)=>void}) {
 const [reason,setReason]=useState("");
 const getOriginal=useServerFn(openKnowledgeOriginal);
 const original=useMutation({mutationFn:()=>getOriginal({data:{versionId:row.id}}),onError:(error:Error)=>toast.error(error.message)});
 const [reviewOpen,setReviewOpen]=useState(false);
 const [basis,setBasis]=useState<ApprovalBasis>("demonstration");
 const [reviewed,setReviewed]=useState(false);
 const tone=row.status==="approved"?"good":row.status==="rejected"||row.job?.state==="failed"?"bad":row.status==="pending"?"warn":"muted";
 const unverified=row.counts.figures-row.counts.verified;
 return <article className="rounded-lg border border-border p-4">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><FileText className="size-4 text-accent"/><h3 className="font-medium">{row.sources?.title}</h3><Pill tone={tone}>{row.status}</Pill><Pill>{row.job?.state??row.ingest_state}</Pill>{row.approval_basis&&<Pill>{row.approval_basis==="demonstration"?"Demonstration approval":"Official department approval"}</Pill>}</div><p className="mt-1 text-xs text-muted-foreground">{row.sources?.publisher} · {row.sources?.source_type?.replaceAll("_"," ")} · {row.version_label} · {row.sources?.audience==="staff"?"Staff only":"Public"}</p></div>
   <div className="grid grid-cols-3 gap-4 text-center text-xs"><div><b className="block text-base">{row.counts.passages}</b>extracts</div><div><b className="block text-base">{row.counts.figures}</b>figures</div><div><b className="block text-base">{row.counts.verified}</b>verified</div></div>
  </div>
  <p className="mt-2 text-xs text-muted-foreground">{row.status==="approved"?(row.sources?.audience==="staff"?"Available as internal drafting guidance; not public factual evidence.":"Available to public answers and internal drafting."):row.status==="pending"?"Not available to the AI until a person reviews and approves this version.":"Excluded from AI retrieval."}{row.reference_period?` Reference period: ${row.reference_period}.`:""}</p>
  {row.status==="approved"&&row.approval_basis==="demonstration"&&unverified>0&&<p className="mt-1 text-xs text-muted-foreground">This demonstration includes {unverified} figure{unverified===1?"":"s"} without a recorded human check. An authorised reviewer can check the original in the evidence panel.</p>}
  {row.job?.file_name&&<p className="mt-1 text-xs text-muted-foreground">File: {row.job.file_name}</p>}
  {row.supersedes_version_id&&<p className="mt-1 text-xs text-muted-foreground">Replacement version; earlier evidence is retained in the register.</p>}
  {row.ingest_note&&<p className="mt-3 rounded bg-secondary/60 p-2 text-xs text-muted-foreground">{row.ingest_note}</p>}
  {row.job?.error_message&&<p className="mt-3 rounded bg-destructive/5 p-2 text-xs text-destructive">{row.job.error_message}</p>}
  {row.original_url&&<a className="mt-2 inline-block text-xs text-accent underline" href={row.original_url} target="_blank" rel="noreferrer">Open original source</a>}
  {row.file_path&&<div className="mt-2 flex items-center gap-3"><Button type="button" size="sm" variant="outline" disabled={original.isPending} onClick={()=>original.mutate()}>{original.isPending?"Preparing original…":"Prepare private original"}</Button>{original.data&&<a className="text-xs text-accent underline" href={original.data.url} target="_blank" rel="noreferrer">Open uploaded original (valid 5 minutes)</a>}</div>}
  <div className="mt-3 flex flex-wrap gap-2">{replace&&<Button type="button" size="sm" variant="outline" onClick={replace}>Add replacement version</Button>}<Button type="button" size="sm" variant="outline" aria-expanded={reviewOpen} aria-controls={`evidence-${row.id}`} onClick={()=>setReviewOpen(!reviewOpen)}><BookOpen/>{reviewOpen?"Hide evidence":"Review extracts and figures"}</Button></div>
  {reviewOpen&&<SourceEvidence versionId={row.id} originalUrl={original.data?.url??row.original_url} sourceTitle={row.sources?.title??row.version_label} canVerify={canVerify&&(row.status==="pending"||(row.status==="approved"&&row.approval_basis==="demonstration"))}/>}
  {canDecide&&<div className="mt-3 space-y-3">
   {row.status==="pending"&&<div className="space-y-2 rounded border border-border p-3">
    <label className="block text-xs font-medium">Approval basis<select className={`${input} mt-1`} value={basis} onChange={e=>setBasis(e.target.value as ApprovalBasis)}><option value="demonstration">Demonstration — team review</option><option value="official">Official — department approval</option></select></label>
    <p className="text-xs text-muted-foreground">{basis==="demonstration"?"Makes this version available to the demonstration assistant after your review. It does not imply department endorsement.":"Use only when you are authorised to record department approval of this version."}</p>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={reviewed} disabled={!reviewOpen} onChange={e=>setReviewed(e.target.checked)}/><span>I reviewed the original source and extracted evidence for this version.</span></label>
    {unverified>0&&<p className="text-xs text-muted-foreground">Check the {unverified} remaining figure{unverified===1?"":"s"} in the evidence panel before approval.</p>}
    <Button type="button" size="sm" disabled={busy||!reviewed||!row.counts.passages||row.ingest_state!=="done"||unverified>0} onClick={()=>act("approve",undefined,basis)}>{basis==="demonstration"?"Approve for demonstration":"Record official approval"}</Button>
   </div>}
   <div className="flex flex-wrap gap-2"><input aria-label={`Reason for rejecting or withdrawing ${row.sources?.title??"source"}`} className={`${input} min-w-48 flex-1`} placeholder="Reason for rejection or withdrawal" value={reason} onChange={e=>setReason(e.target.value)}/>{row.status==="pending"&&<Button size="sm" variant="destructive" disabled={busy||reason.length<3} onClick={()=>act("reject",reason)}>Reject</Button>}{row.status==="approved"&&<Button size="sm" variant="outline" disabled={busy||reason.length<3} onClick={()=>act("withdraw",reason)}>Withdraw</Button>}</div>
  </div>}
 </article>;
}

function SourceEvidence({versionId,originalUrl,sourceTitle,canVerify}:{versionId:string;originalUrl:string|null;sourceTitle:string;canVerify:boolean}) {
 const [figurePage,setFigurePage]=useState(0), [passagePage,setPassagePage]=useState(0);
 const getEvidence=useServerFn(reviewKnowledgeSource), verify=useServerFn(verifyFigures);
 const qc=useQueryClient();
 const evidence=useQuery({queryKey:["knowledge-evidence",versionId,figurePage,passagePage],queryFn:()=>getEvidence({data:{versionId,figurePage,passagePage}})});
 const verification=useMutation({mutationFn:(id:string)=>verify({data:{observationIds:[id]}}),onSuccess:async()=>{toast.success("Your figure check was recorded.");await Promise.all([qc.invalidateQueries({queryKey:["knowledge-evidence",versionId]}),qc.invalidateQueries({queryKey:["knowledge-library"]})]);},onError:(error:Error)=>toast.error(error.message)});
 const sourceHref=(page:number|null)=>originalUrl?`${originalUrl.split("#")[0]}${page?`#page=${page}`:""}`:null;
 return <section id={`evidence-${versionId}`} aria-label={`Evidence for ${sourceTitle}`} className="mt-3 space-y-4 rounded border border-border bg-secondary/20 p-3">
  {evidence.isPending?<p className="text-sm text-muted-foreground">Loading source evidence…</p>:evidence.isError?<p role="alert" className="text-sm text-destructive">{evidence.error.message}</p>:<>
   <div className="space-y-3"><h4 className="text-sm font-semibold">Figures to check ({evidence.data.figureCount})</h4><p className="text-xs text-muted-foreground">Compare each figure, period and population with the original publication before recording your check.</p>
    {evidence.data.figures.length===0?<p className="text-sm text-muted-foreground">No structured figures in this version. Review the extracted text below.</p>:evidence.data.figures.map(figure=><div key={figure.id} className="space-y-2 rounded border border-border bg-surface p-3">
     <div className="flex flex-wrap items-start justify-between gap-2"><h5 className="text-sm font-medium">{figure.measure}: {figure.display_value}</h5>{figure.verified_at&&figure.verified_by&&<Pill tone="good">Human checked</Pill>}</div>
     <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2"><div><dt className="inline font-medium">Source: </dt><dd className="inline">{sourceTitle}</dd></div><div><dt className="inline font-medium">Page: </dt><dd className="inline">{figure.page_number??figure.passages?.page_number??"Not specified"}</dd></div><div><dt className="inline font-medium">Period: </dt><dd className="inline">{figure.reference_period}</dd></div><div><dt className="inline font-medium">Unit: </dt><dd className="inline">{figure.unit}</dd></div><div><dt className="inline font-medium">Population: </dt><dd className="inline">{figure.population??"Not specified"}</dd></div><div><dt className="inline font-medium">Geography: </dt><dd className="inline">{figure.geography}</dd></div></dl>
     {figure.table_label&&<p className="text-xs">Table: {figure.table_label}</p>}{figure.adjustment&&<p className="text-xs">Adjustment: {figure.adjustment}</p>}{figure.reported_change&&<p className="text-xs">Reported change: {figure.reported_change}</p>}{figure.comparability_note&&<p className="text-xs">Comparability: {figure.comparability_note}</p>}
     {figure.passages?<blockquote className="whitespace-pre-wrap border-l-2 border-accent/40 pl-3 text-xs leading-relaxed">{figure.passages.content}</blockquote>:<p className="text-xs text-destructive">No linked evidence passage. Resolve the evidence gap before verification.</p>}
     <div className="flex flex-wrap items-center gap-3">{originalUrl&&<a href={sourceHref(figure.page_number??figure.passages?.page_number??null)!} target="_blank" rel="noreferrer" className="text-xs text-accent underline">Open original at page</a>}{canVerify&&(!figure.verified_at||!figure.verified_by)&&<Button type="button" size="sm" variant="outline" disabled={verification.isPending||!figure.passages} onClick={()=>verification.mutate(figure.id)}>I checked this figure</Button>}</div>
    </div>)}
    <EvidencePages page={figurePage} total={evidence.data.figureCount} size={evidence.data.pageSize} change={setFigurePage} label="figures"/>
   </div>
   <div className="space-y-3"><h4 className="text-sm font-semibold">Extracted text ({evidence.data.passageCount})</h4>{evidence.data.passages.map(passage=><div key={passage.id} className="rounded border border-border bg-surface p-3"><p className="mb-2 text-xs font-medium">{passage.section_label??`Extract ${passage.position+1}`}{passage.page_number?` · Page ${passage.page_number}`:""}</p><p className="whitespace-pre-wrap text-xs leading-relaxed">{passage.content}</p></div>)}<EvidencePages page={passagePage} total={evidence.data.passageCount} size={evidence.data.pageSize} change={setPassagePage} label="extracts"/></div>
  </>}
 </section>;
}

function EvidencePages({page,total,size,change,label}:{page:number;total:number;size:number;change:(page:number)=>void;label:string}) {
 if(total<=size)return null;
 return <nav aria-label={`${label} pages`} className="flex items-center gap-3"><Button type="button" size="sm" variant="outline" disabled={page===0} onClick={()=>change(page-1)}>Previous {label}</Button><span className="text-xs">{page*size+1}–{Math.min((page+1)*size,total)} of {total}</span><Button type="button" size="sm" variant="outline" disabled={(page+1)*size>=total} onClick={()=>change(page+1)}>Next {label}</Button></nav>;
}
