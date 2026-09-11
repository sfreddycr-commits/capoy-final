import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Image as ImageIcon, LayoutDashboard, Loader2, LogOut, Menu, Save, ShieldCheck, SlidersHorizontal, Upload, Users, X } from 'lucide-react';

type AdminUser={id:number;displayName:string;email:string;role:string};
type CmsSettings=Record<string,{value:string;updatedAt:string}>;
const labels:Record<string,string>={hero_eyebrow:'Texto superior del hero',hero_title:'Título principal',hero_lead:'Descripción principal',hero_primary_cta:'Botón principal',hero_secondary_cta:'Botón secundario',hero_image:'Imagen principal',contact_phone:'Teléfono',contact_email:'Correo',contact_location:'Ubicación',cta_title:'Título CTA final',cta_copy:'Texto CTA final',footer_copy:'Texto del footer'};
const groups=[{title:'Hero principal',keys:['hero_eyebrow','hero_title','hero_lead','hero_primary_cta','hero_secondary_cta','hero_image']},{title:'Contacto',keys:['contact_phone','contact_email','contact_location']},{title:'Cierre y footer',keys:['cta_title','cta_copy','footer_copy']}];
function initials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]?.toUpperCase()).join('')||'CA'}

function HeroImageField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('El archivo debe ser una imagen.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadError('La imagen no debe superar 8 MB.');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const form = new FormData();
      form.append('image', file);
      const response = await fetch('/api/admin/cms/hero-image/upload', {
        method: 'POST',
        credentials: 'same-origin',
        body: form,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.url) throw new Error(body?.error || 'No fue posible subir la imagen.');
      onChange(body.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'No fue posible subir la imagen.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="cms-hero-image-field">
      <div className="cms-hero-image-preview">
        {value ? <img src={value} alt="Vista previa del hero" /> : <div className="cms-hero-image-placeholder"><ImageIcon size={32}/><small>Sin imagen</small></div>}
      </div>
      <div className="cms-hero-image-controls">
        <input name="hero_image" type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… o sube un archivo" />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleUpload} disabled={uploading} />
        <button type="button" className="cms-hero-image-upload" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <><Loader2 className="spin" size={16}/> Subiendo…</> : <><Upload size={16}/> Subir imagen</>}
        </button>
      </div>
      {uploadError && <div className="cms-hero-image-error">{uploadError}</div>}
    </div>
  );
}

export function CmsPage(){
  const [user,setUser]=useState<AdminUser|null>(null);
  const [settings,setSettings]=useState<CmsSettings>({});
  const [heroImage,setHeroImage]=useState('');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [saved,setSaved]=useState('');
  const [mobileMenu,setMobileMenu]=useState(false);
  async function load(){
    setLoading(true);setError('');
    try{
      const [s,c]=await Promise.all([
        fetch('/api/auth/session',{credentials:'same-origin'}),
        fetch('/api/admin/cms',{credentials:'same-origin'})
      ]);
      if(s.status===401||c.status===401){location.assign('/admin/login');return}
      if(!s.ok||!c.ok)throw new Error((await c.json().catch(()=>({}))).error||'No fue posible cargar el CMS.');
      setUser((await s.json()).user);
      const data=await c.json();
      setSettings(data.settings||{});
      setHeroImage(data.settings?.hero_image?.value||'');
    }catch(e){setError(e instanceof Error?e.message:'No fue posible cargar el CMS.')}finally{setLoading(false)}
  }
  useEffect(()=>{load()},[]);
  async function logout(){await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'}).catch(()=>null);location.assign('/admin/login')}
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setSaving(true);setError('');setSaved('');
    const form=new FormData(event.currentTarget);
    const payload:Record<string,string>={};
    for(const key of Object.keys(labels)){
      if(key==='hero_image'){payload[key]=heroImage;continue}
      payload[key]=String(form.get(key)||'');
    }
    try{
      const r=await fetch('/api/admin/cms',{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({settings:payload})});
      const body=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(body.error||'No fue posible guardar el CMS.');
      setSaved(`${body.updated||0} campos guardados correctamente.`);
      await load();
    }catch(e){setError(e instanceof Error?e.message:'No fue posible guardar el CMS.')}finally{setSaving(false)}
  }
  return (
    <div className="cms-app">
      <aside className={`cms-sidebar ${mobileMenu?'open':''}`}>
        <div className="cms-brand">
          <span>C</span>
          <div><strong>Capoy</strong><small>Costa Rica</small></div>
          <button onClick={()=>setMobileMenu(false)}><X size={20}/></button>
        </div>
        <nav>
          <a href="/admin"><LayoutDashboard size={18}/> Dashboard</a>
          <a href="/admin/reservas"><SlidersHorizontal size={18}/> Reservas</a>
          <a href="/admin/tours"><ImageIcon size={18}/> Tours</a>
          <a href="/admin/clientes"><Users size={18}/> Clientes</a>
          <a className="active" href="/admin/cms"><SlidersHorizontal size={18}/> CMS</a>
        </nav>
        <div className="cms-sidebar-bottom">
          <div><ShieldCheck size={16}/> Sesión protegida</div>
          {user&&<p><b>{initials(user.displayName)}</b><span>{user.displayName}</span></p>}
          <button onClick={logout}><LogOut size={17}/> Cerrar sesión</button>
        </div>
      </aside>
      {mobileMenu&&<button className="cms-backdrop" onClick={()=>setMobileMenu(false)}/>}
      <main>
        <header className="cms-topbar">
          <div>
            <button className="cms-menu" onClick={()=>setMobileMenu(true)}><Menu size={20}/></button>
            <a href="/admin"><ArrowLeft size={17}/> Administración</a>
            <span>/</span>
            <strong>CMS</strong>
          </div>
          {user&&<small>{user.email}</small>}
        </header>
        <section className="cms-content">
          <div className="cms-heading">
            <div>
              <span>CONTENIDO PÚBLICO</span>
              <h1>CMS de la landing</h1>
              <p>Edita los textos y datos principales que ve el visitante sin modificar código.</p>
            </div>
            <a href="/" target="_blank" rel="noreferrer">Ver sitio público</a>
          </div>
          {loading&&<div className="cms-state"><Loader2 className="spin"/> Cargando contenido real…</div>}
          {!loading&&(
            <form onSubmit={save}>
              {groups.map(group=>(
                <section className="cms-card" key={group.title}>
                  <header><h2>{group.title}</h2>{group.title==='Hero principal'&&<ImageIcon size={20}/>}</header>
                  <div className="cms-grid">
                    {group.keys.map(key=>(
                      <label key={key}>
                        {labels[key]}
                        {key==='hero_image' ? (
                          <HeroImageField value={heroImage} onChange={setHeroImage} />
                        ) : key==='hero_lead'||key==='cta_copy'||key==='footer_copy' ? (
                          <textarea name={key} rows={4} defaultValue={settings[key]?.value||''}/>
                        ) : (
                          <input name={key} type={key==='contact_email'?'email':'text'} defaultValue={settings[key]?.value||''}/>
                        )}
                      </label>
                    ))}
                  </div>
                </section>
              ))}
              {error&&<div className="cms-message error">{error}</div>}
              {saved&&<div className="cms-message success">{saved}</div>}
              <div className="cms-actions">
                <button type="submit" disabled={saving}><Save size={17}/>{saving?'Guardando…':'Guardar cambios'}</button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
