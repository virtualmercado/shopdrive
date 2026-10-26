import type { Page } from "@playwright/test";

export const STORE_A = "11111111-1111-4111-8111-111111111111";
export const STORE_B = "22222222-2222-4222-8222-222222222222";
export const PRODUCT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const PRODUCT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const ORDER_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

// Browser-only fixtures: no accounts, DNS, hosted backend, payment, emails or writes.
const clientFixture = `
const A='${STORE_A}',B='${STORE_B}',P='${PRODUCT_A}',PB='${PRODUCT_B}',O='${ORDER_A}';
window.__calls=[];window.__forbidden=[];window.__blockedTelemetry=[];
const profile=(id,slug,name)=>({id,store_slug:slug,store_name:name,store_description:'Loja fictícia para teste controlado',primary_color:'#227744',secondary_color:'#ffffff',footer_text_color:'#222222',footer_bg_color:'#eeeeee',button_bg_color:'#227744',button_text_color:'#ffffff',store_layout:'classic',store_model:'catalogo_digital',delivery_option:'pickup_only',pickup_address:'Endereço fictício',whatsapp_number:'',banner_desktop_urls:[],banner_mobile_urls:[],selected_benefit_banners:[],about_us_title:'Sobre Loja A',about_us_text:'Institucional Loja A',return_policy_text:'Política Loja A'});
const profiles=[profile(A,'loja-a','Loja A'),profile(B,'loja-b','Loja B')];
const products=[{id:P,user_id:A,store_slug:'loja-a',name:'Produto A',description:'Produto fictício A',price:10,promotional_price:null,stock:5,images:[],image_url:'/placeholder.svg',variations:[],is_active:true,category_id:null,brand_id:null},{id:PB,user_id:B,store_slug:'loja-b',name:'Produto B',description:'Produto fictício B',price:20,promotional_price:null,stock:5,images:[],image_url:'/placeholder.svg',variations:[],is_active:true,category_id:null}];
const order={id:O,store_owner_id:A,customer_id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',order_number:'TESTE-001',status:'pendente',created_at:'2026-10-26T00:00:00Z',customer_name:'Cliente Fictício',customer_phone:'00000000000',customer_address:'Retirada fictícia',delivery_method:'retirada',payment_method:'whatsapp',subtotal:10,delivery_fee:0,total_amount:10};
const fixtureUser={id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',email:'fixture@example.invalid'};
let user=sessionStorage.getItem('fixture-signed-in')?fixtureUser:null;const listeners=new Set();
class Query {
 constructor(table){this.table=table;this.filters=[];this.one=false;this.head=false;}
 select(fields,opts){this.head=opts?.head??false;return this;}
 eq(k,v){this.filters.push([k,v]);return this;}
 neq(){return this;}gt(){return this;}not(){return this;}in(){return this;}is(){return this;}order(){return this;}limit(){return this;}range(){return this;}
 single(){this.one=true;return this;}maybeSingle(){this.one=true;return this;}
 insert(){if(this.table==='store_product_views'){window.__blockedTelemetry.push(this.table);return Promise.resolve({error:null});}window.__forbidden.push(this.table);throw new Error('Fixture forbids table writes');}update(){return this.insert();}delete(){return this.insert();}upsert(){return this.insert();}
 then(resolve,reject){
  window.__calls.push({table:this.table,filters:this.filters});
  let data=this.table==='public_store_profiles'?profiles:['products','public_store_products'].includes(this.table)?products:this.table==='orders'?[order]:this.table==='order_items'?[{order_id:O,product_name:'Produto A',quantity:1,product_price:10,subtotal:10}]:this.table==='payment_settings_public'?[{user_id:A,pix_enabled:false,credit_card_enabled:false,boleto_enabled:false}]:this.table==='customer_profiles'&&user?[{id:user.id,full_name:'Cliente Fictício',email:'fixture@example.invalid'}]:[];
  data=data.filter(row=>this.filters.every(([k,v])=>row[k]===v));
  return Promise.resolve({data:this.one?data[0]??null:data,error:null,count:data.length}).then(resolve,reject);
 }
}
export const supabase={
 from:table=>new Query(table),
 channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:()=>{},
 rpc:async(name,args)=>{
  window.__calls.push({rpc:name,args});
  if(name==='resolve_public_store_by_domain'){
   const mode=window.__resolution??'valid';
   if(mode==='delay')await new Promise(r=>setTimeout(r,600));
   if(mode==='zero')return {data:[],error:null};
   if(mode==='error')return {data:null,error:{message:'private infrastructure details'}};
   if(mode==='malformed')return {data:[{store_id:B}],error:null};
   return {data:[{store_id:A,store_slug:'loja-a'}],error:null};
  }
  if(name==='search_store_products')return {data:products.filter(p=>p.user_id===(args.p_store_slug==='loja-a'?A:B)),error:null};
  if(name==='get_melhor_envio_status')return {data:[{is_active:false}],error:null};
  if(name==='create_checkout_order'){window.__createdOrder=args;return {data:order,error:null};}
  return {data:[],error:null};
 },
 auth:{
  getSession:async()=>({data:{session:user?{user}:null},error:null}),
  onAuthStateChange:callback=>{listeners.add(callback);return {data:{subscription:{unsubscribe:()=>listeners.delete(callback)}}};},
  signInWithPassword:async()=>{user=fixtureUser;sessionStorage.setItem('fixture-signed-in','true');listeners.forEach(cb=>cb('SIGNED_IN',{user}));return {data:{user,session:{user}},error:null};},
  signOut:async()=>{user=null;sessionStorage.removeItem('fixture-signed-in');listeners.forEach(cb=>cb('SIGNED_OUT',null));return {error:null};},
 },
 functions:{invoke:async()=>{throw new Error('Fixture forbids external functions');}},
};`;

export async function mountRuntimeFixture(page: Page, origin: string, resolution = "valid") {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) { await route.abort(); return; }
    if (request.method() !== "GET" && request.method() !== "HEAD") { await route.abort(); return; }
    if (url.pathname === "/src/integrations/supabase/client.ts") {
      await route.fulfill({ contentType: "application/javascript", body: clientFixture }); return;
    }
    if (url.pathname === "/src/hooks/useStoreEvents.tsx") {
      await route.fulfill({ contentType: "application/javascript", body: "export const trackStoreEvent=()=>{}; export const useStoreEvents=()=>({});" }); return;
    }
    if (url.pathname === "/src/lib/auditLog.ts") {
      await route.fulfill({ contentType: "application/javascript", body: "export const logAuditEvent=()=>{};" }); return;
    }
    const response = await page.request.get(`http://localhost:8080${url.pathname}${url.search}`);
    if (request.isNavigationRequest()) {
      const body = (await response.text()).replace("<head>", `<head><script>window.__resolution=${JSON.stringify(resolution)};localStorage.setItem('vm_cookie_consent','true');</script>`);
      await route.fulfill({ response, body }); return;
    }
    await route.fulfill({ response });
  });
}