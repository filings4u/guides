
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const service = createClient(URL, SERVICE, { auth: { persistSession:false, autoRefreshToken:false } });

const CORS = {
  "Access-Control-Allow-Origin":"https://guides.screenings4u.com",
  "Access-Control-Allow-Headers":"authorization,apikey,content-type",
  "Access-Control-Allow-Methods":"POST,OPTIONS"
};

const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{...CORS,"Content-Type":"application/json","Cache-Control":"no-store"}
});

async function getUser(req:Request){
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return null;
  const auth=createClient(URL,ANON,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await auth.auth.getUser(token);
  if(error||!data.user)return null;
  return data.user;
}

async function getMember(userId:string){
  const {data,error}=await service.from("guide_builder_members")
    .select("user_id,role,active")
    .eq("user_id",userId)
    .maybeSingle();
  if(error)throw error;
  return data;
}

async function signedUrl(path:string|null|undefined){
  if(!path)return null;
  const {data,error}=await service.storage.from("guide-builder").createSignedUrl(path,3600);
  if(error)return null;
  return data.signedUrl;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  if(req.method!=="POST")return reply({error:"Method not allowed."},405);

  try{
    const user=await getUser(req);
    if(!user)return reply({error:"Authentication required."},401);

    const body=await req.json().catch(()=>({}));
    const action=String(body.action||"status");

    if(action==="bootstrap"){
      const {count,error:countError}=await service.from("guide_builder_members").select("user_id",{count:"exact",head:true});
      if(countError)throw countError;
      let member=await getMember(user.id);
      if((count||0)===0){
        const {error:insertError}=await service.from("guide_builder_members").insert({user_id:user.id,role:"admin",active:true});
        if(insertError)throw insertError;
        member=await getMember(user.id);
        return reply({ok:true,member,bootstrap_result:"admin_created"});
      }
      if(!member?.active)return reply({error:"Guide Builder access has not been granted to this login."},403);
      return reply({ok:true,member,bootstrap_result:"member_exists"});
    }

    const member=await getMember(user.id);
    if(!member?.active)return reply({error:"Guide Builder access has not been granted to this login."},403);

    if(action==="status")return reply({ok:true,member});

    if(action==="list_guides"){
      const {data,error}=await service
        .from("guide_builder_guides")
        .select("*,guide_builder_steps(*)")
        .order("updated_at",{ascending:false});
      if(error)throw error;
      const guides=[];
      for(const g of data||[]){
        const steps=[...(g.guide_builder_steps||[])].sort((a:any,b:any)=>a.step_number-b.step_number);
        guides.push({...g,steps});
      }
      return reply({ok:true,guides,member});
    }

    if(action==="get_guide"){
      const id=String(body.id||"");
      if(!id)return reply({error:"Guide id is required."},400);
      const {data,error}=await service
        .from("guide_builder_guides")
        .select("*,guide_builder_steps(*)")
        .eq("id",id)
        .maybeSingle();
      if(error)throw error;
      if(!data)return reply({error:"Guide not found."},404);
      const steps=[...(data.guide_builder_steps||[])].sort((a:any,b:any)=>a.step_number-b.step_number);
      for(const step of steps){
        step.screenshot_url=await signedUrl(step.screenshot_path);
      }
      return reply({ok:true,guide:{...data,steps},member});
    }

    if(action==="upload_screenshot"){
      if(!["admin","editor"].includes(member.role))return reply({error:"Editor access is required."},403);
      const guideId=String(body.guide_id||"");
      const stepId=String(body.step_id||crypto.randomUUID());
      const dataUrl=String(body.data_url||"");
      const match=dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
      if(!guideId||!match)return reply({error:"A valid screenshot is required."},400);
      const bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));
      if(bytes.byteLength>10485760)return reply({error:"Screenshot exceeds the 10 MB limit."},413);
      const ext=match[1]==="image/jpeg"?"jpg":match[1].split("/")[1];
      const path=`screenshots/${guideId}/${stepId}-${Date.now()}.${ext}`;
      const {error}=await service.storage.from("guide-builder").upload(path,bytes,{contentType:match[1],upsert:false});
      if(error)throw error;
      return reply({ok:true,path,url:await signedUrl(path)});
    }

    if(action==="save_guide"){
      if(!["admin","editor"].includes(member.role))return reply({error:"Editor access is required."},403);
      const g=body.guide||{};
      const id=String(g.id||crypto.randomUUID());
      const now=new Date().toISOString();

      const {data:prior,error:priorError}=await service
        .from("guide_builder_guides")
        .select("*,guide_builder_steps(*)")
        .eq("id",id)
        .maybeSingle();
      if(priorError)throw priorError;

      const createVersion=body.create_version===true;
      if(prior&&createVersion){
        const snapshot={...prior,steps:prior.guide_builder_steps||[]};
        const {error:verError}=await service.from("guide_builder_versions").upsert({
          guide_id:id,
          version:Number(prior.version||1),
          snapshot,
          created_by:user.id
        },{onConflict:"guide_id,version"});
        if(verError)throw verError;
      }

      const guideRow={
        id,
        title:String(g.title||"Untitled Guide"),
        slug:g.slug?String(g.slug):null,
        portal_code:String(g.portal_code||g.portal||"ctpa-dot"),
        audience:String(g.audience||"Customer"),
        category:g.category?String(g.category):null,
        intro:String(g.intro||""),
        status:["draft","published","archived"].includes(String(g.status))?String(g.status):"draft",
        brand_mode:g.brand_mode==="customer"?"customer":"screenings4u",
        brand_name:g.brand_name?String(g.brand_name):null,
        version:prior?(Number(prior.version||1)+(createVersion?1:0)):1,
        created_by:prior?.created_by||user.id,
        updated_by:user.id,
        published_at:String(g.status)==="published"?(prior?.published_at||now):null,
        created_at:prior?.created_at||now,
        updated_at:now
      };

      const {data:saved,error:saveError}=await service
        .from("guide_builder_guides")
        .upsert(guideRow)
        .select("*")
        .single();
      if(saveError)throw saveError;

      const {error:deleteStepsError}=await service
        .from("guide_builder_steps")
        .delete()
        .eq("guide_id",id);
      if(deleteStepsError)throw deleteStepsError;

      const steps=(Array.isArray(g.steps)?g.steps:[]).map((s:any,i:number)=>({
        id:String(s.id||crypto.randomUUID()),
        guide_id:id,
        step_number:i+1,
        title:String(s.title||(`Step ${i+1}`)),
        instruction:String(s.instruction||""),
        page_url:s.page_url||s.url||null,
        page_title:s.page_title||null,
        clicked_element:s.clicked_element||s.selector||null,
        screenshot_path:s.screenshot_path||null,
        click_x:Number(s.click_x??s.click?.x_pct??s.click?.xPercent??50),
        click_y:Number(s.click_y??s.click?.y_pct??s.click?.yPercent??50),
        annotation_data:s.annotation_data||{},
        metadata:s.metadata||{},
        updated_at:now
      }));

      if(steps.length){
        const {error:stepsError}=await service.from("guide_builder_steps").insert(steps);
        if(stepsError)throw stepsError;
      }

      for(const step of steps){
        (step as any).screenshot_url=await signedUrl(step.screenshot_path);
      }

      return reply({ok:true,guide:{...saved,steps},member});
    }

    if(action==="delete_guide"){
      if(!["admin","editor"].includes(member.role))return reply({error:"Editor access is required."},403);
      const id=String(body.id||"");
      if(!id)return reply({error:"Guide id is required."},400);

      const {data:steps}=await service
        .from("guide_builder_steps")
        .select("screenshot_path")
        .eq("guide_id",id);

      const paths=(steps||[]).map((s:any)=>s.screenshot_path).filter(Boolean);
      if(paths.length)await service.storage.from("guide-builder").remove(paths);

      const {error}=await service.from("guide_builder_guides").delete().eq("id",id);
      if(error)throw error;
      return reply({ok:true});
    }

    if(action==="list_members"){
      if(member.role!=="admin")return reply({error:"Administrator access is required."},403);
      const {data,error}=await service.from("guide_builder_members")
        .select("user_id,role,active,created_at,updated_at")
        .order("created_at");
      if(error)throw error;
      const members=[];
      for(const row of data||[]){
        const {data:u}=await service.auth.admin.getUserById(row.user_id);
        members.push({...row,email:u.user?.email||null});
      }
      return reply({ok:true,members});
    }

    if(action==="add_member"){
      if(member.role!=="admin")return reply({error:"Administrator access is required."},403);
      const email=String(body.email||"").trim().toLowerCase();
      const role=["admin","editor","viewer"].includes(String(body.role))?String(body.role):"editor";
      if(!email)return reply({error:"Email is required."},400);

      let page=1,target:any=null;
      while(page<=10&&!target){
        const {data,error}=await service.auth.admin.listUsers({page,perPage:100});
        if(error)throw error;
        target=data.users.find((u:any)=>String(u.email||"").toLowerCase()===email)||null;
        if(data.users.length<100)break;
        page++;
      }
      if(!target)return reply({error:"That email does not have a Supabase login yet."},404);

      const {error}=await service.from("guide_builder_members").upsert({
        user_id:target.id,role,active:true,updated_at:new Date().toISOString()
      });
      if(error)throw error;
      return reply({ok:true});
    }

    if(action==="remove_member"){
      if(member.role!=="admin")return reply({error:"Administrator access is required."},403);
      const targetId=String(body.user_id||"");
      if(targetId===user.id)return reply({error:"You cannot remove your own administrator access."},409);
      const {error}=await service.from("guide_builder_members").delete().eq("user_id",targetId);
      if(error)throw error;
      return reply({ok:true});
    }

    return reply({error:"Unknown action."},400);
  }catch(error){
    console.error("guide-builder",error);
    return reply({error:error instanceof Error?error.message:String(error)},500);
  }
});
