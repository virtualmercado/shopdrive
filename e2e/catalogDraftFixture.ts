import type { BrowserContext, Route } from "@playwright/test";

// Local server double: state lives in this test process, not browser storage.
// ALL non-localhost traffic is blocked, including production storage/auth.
export async function installDraftFixture(context: BrowserContext) {
  const state = { config: null as unknown, draft_revision: 0, source_revision: 0, preview: null as any, saves: 0, generations: 0, sourceLoads: 0, failSave: false, failUpload: false, published: "A", publications: 0, files: new Map<string, number[]>() };
  let pending: any = null;
  const record = () => ({ config: state.config, schema_version: 1, draft_revision: state.draft_revision, source_revision: state.source_revision, draft_updated_at: new Date().toISOString(), preview: state.preview, stale: !!state.preview && (state.preview.draft_revision !== state.draft_revision || state.preview.source_revision !== state.source_revision) });
  await context.route("**/*", async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://localhost:8080") return route.abort();
    const js = (body: string) => route.fulfill({ contentType: "application/javascript", body });
    if (url.pathname === "/__draft-api") {
      const { name, args } = route.request().postDataJSON();
      const response = (data: unknown, error: unknown = null) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ data, error }) });
      if (name === "get_my_catalog_draft") return response(record());
      if (name === "save_my_catalog_draft") {
        if (state.failSave) return response(null, { message: "controlled offline" });
        if (args._expected_revision !== state.draft_revision) return response(null, { message: "catalog draft conflict", code: "40001" });
        state.config = args._config; state.draft_revision++; state.saves++;
        return response(record());
      }
      if (name === "begin_my_catalog_preview") {
        pending = { id: `preview-${state.generations + 1}`, path: `fixture-store-b/preview-${state.generations + 1}.pdf`, draft_revision: state.draft_revision, source_revision: state.source_revision, publication_baseline: { updatedAt: null, hasCurrent: true } };
        return response(pending);
      }
      if (name === "complete_my_catalog_preview") {
        if (!pending || pending.draft_revision !== state.draft_revision || pending.source_revision !== state.source_revision) return response(null, { message: "catalog changed during preview", code: "40001" });
        state.preview = { ...pending, generated_at: new Date().toISOString(), page_count: args._page_count };
        state.generations++; pending = null;
        return response(record());
      }
      if (name === "discard_my_catalog_preview") { pending = null; return response(null); }
      if (name === "begin_editorial_catalog_publication") { state.publications++; return response({ publication_id: "publish-1", storage_path: "public/publish-1.pdf", status: "pending" }); }
      if (name === "publish_editorial_catalog") { state.published = "B"; return response({ status: "published", share_code: "fixtureabcdefgh" }); }
      throw new Error(`unhandled fixture RPC ${name}`);
    }
    if (url.pathname === "/__draft-storage") {
      const { operation, path, bytes } = route.request().postDataJSON();
      let data: unknown = null, error: unknown = null;
      if (operation === "upload") { if (state.failUpload) error = { message: "controlled upload failure" }; else state.files.set(path, bytes); }
      if (operation === "download") { data = state.files.get(path); if (!data) error = { message: "not found" }; }
      if (operation === "list") data = [...state.files.keys()].filter((p) => p.startsWith("fixture-store-b/")).map((p) => ({ name: p.split("/").at(-1) }));
      if (operation === "remove" && path !== state.preview?.path && path !== pending?.path) state.files.delete(path);
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ data, error }) });
    }
    if (url.pathname === "/__catalog-draft-test") return route.fulfill({ contentType: "text/html", body: `
      <html><body style="margin:0"><div id="root"></div>
      <script type="module">import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>t=>t;window.__vite_plugin_react_preamble_installed__=true;</script>
      <script type="module">
        import React from '/node_modules/.vite/deps/react.js';import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
        import {TooltipProvider} from '/src/components/ui/tooltip.tsx';import C from '/src/components/catalog/editorial/EditorialCatalogConfigurator.tsx';import '/src/index.css';
        function App(){const [show,setShow]=React.useState(true);return React.createElement(React.Fragment,null,React.createElement('a',{href:show?'#other':'#catalog',onClick:()=>setShow(!show)},show?'Outro menu':'Voltar ao catálogo'),show?React.createElement(C):React.createElement('p',null,'Outro menu aberto'));}
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(TooltipProvider,null,React.createElement(App)));
      </script></body></html>` });
    if (url.pathname === "/src/hooks/useAuth.tsx") return js(`const user={id:'fixture-store-b'};export const useAuth=()=>({user});`);
    if (url.pathname === "/src/lib/catalog-v2/catalogLoader.ts") {
      state.sourceLoads++;
      return js(`import {fixtureStoreB} from '/src/lib/catalog-v2/editorial/editorialFixtures.ts';export async function loadCatalogSource(){await fetch('/__draft-source-load');const s=fixtureStoreB(216);s.profile.store_logo_url=null;s.products.forEach(p=>p.image_url='/placeholder.svg');return s;}`);
    }
    if (url.pathname === "/__draft-source-load") { state.sourceLoads++; return route.fulfill({ body: "ok" }); }
    if (url.pathname === "/src/integrations/supabase/client.ts") return js(`
      const api=async(name,args)=>{const r=await fetch('/__draft-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})});return r.json();};
      const storage=async(operation,path,bytes)=>{const r=await fetch('/__draft-storage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,path,bytes})});return r.json();};
      export const supabase={rpc:api,storage:{from:bucket=>({upload:async(path,blob)=>storage('upload',path,[...new Uint8Array(await blob.arrayBuffer())]),download:async(path)=>{const r=await storage('download',path);return {...r,data:r.data?new Blob([new Uint8Array(r.data)],{type:'application/pdf'}):null};},list:async()=>storage('list'),remove:async(paths)=>storage('remove',paths[0]),getPublicUrl:path=>({data:{publicUrl:'https://example.test/'+path}})})}};
    `);
    return route.continue();
  });
  return state;
}