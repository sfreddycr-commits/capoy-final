import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, ClipboardList, Edit3, Image as ImageIcon, LayoutDashboard, Loader2, LogOut, Menu, Plus, Search, ShieldCheck, Trash2, Upload, X } from 'lucide-react';

type AdminUser={id:number;displayName:string;email:string;role:string};
type Translation={name:string;destination:string;shortDescription:string|null;description:string|null;duration:string|null};
type Tour={id:number;slug:string;name:string;destination:string;shortDescription:string|null;description:string|null;duration:string|null;adultPrice:number;childPrice:number|null;currency:string;capacity:number|null;mainImageUrl:string|null;status:string;publishedAt:string|null;createdAt:string;updatedAt:string;galleryImages?:string[];translations?:Record<string,Translation>};
type Payload={summary:{total:number;draft:number;published:number;inactive:number};pagination:{page:number;limit:number;total:number;pages:number};tours:Tour[]};

const LANGS=[['es','Español'],['en','English']] as const;
type LangCode=typeof LANGS[number][0];

function emptyTranslation():Translation{return{name:'',destination:'',shortDescription:null,description:null,duration:null}}
function translationFromTour(t:Tour):Translation{return{name:t.name,destination:t.destination,shortDescription:t.shortDescription,description:t.description,duration:t.duration}}
function translationFromMap(t:Tour,lang:LangCode):Translation{const tx=t.translations?.[lang];if(tx)return tx;return emptyTranslation()}

const statuses=[['draft','Borrador'],['published','Publicado'],['inactive','Inactivo']] as const;
const MAX_GALLERY=5;
function initials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]?.toUpperCase()).join('')||'CA'}
function money(value:number,currency:string){return new Intl.NumberFormat('es-CR',{style:'currency',currency}).format(value)}
function parseGallery(value:unknown):string[]{if(!Array.isArray(value))return[];return value.filter((v):v is string=>typeof v==='string'&&!!v)}

export function ToursPage(){
  const [user,setUser]=useState<AdminUser|null>(null);const [data,setData]=useState<Payload|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  const [query,setQuery]=useState('');const [status,setStatus]=useState('all');const [modal,setModal]=useState(false);const [editing,setEditing]=useState<Tour|null>(null);const [saving,setSaving]=useState(false);const [saveError,setSaveError]=useState('');const [mobileMenu,setMobileMenu]=useState(false);const [photoMode,setPhotoMode]=useState(false);const [previewUrl,setPreviewUrl]=useState<string|null>(null);const [uploading,setUploading]=useState(false);
  const [gallery,setGallery]=useState<string[]>([]);const [galleryUploading,setGalleryUploading]=useState<number|null>(null);const fileRefs=useRef<Record<number,HTMLInputElement|null>>({});
  const [activeLang,setActiveLang]=useState<LangCode>('es');
  const [translations,setTranslations]=useState<Record<LangCode,Translation>>({es:emptyTranslation(),en:emptyTranslation()});

  async function load(){setLoading(true);setError('');try{const params=new URLSearchParams({page:'1',limit:'100'});if(status!=='all')params.set('status',status);if(query.trim())params.set('q',query.trim());const [s,t]=await Promise.all([fetch('/api/auth/session',{credentials:'same-origin'}),fetch(`/api/admin/tours?${params}`,{credentials:'same-origin'})]);if(s.status===401||t.status===401){window.location.assign('/admin/login');return}if(!s.ok||!t.ok){const b=await t.json().catch(()=>({}));throw new Error(b.error||'No fue posible cargar los tours.')}setUser((await s.json()).user);setData(await t.json())}catch(e){setError(e instanceof Error?e.message:'No fue posible cargar los tours.')}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);
  async function logout(){await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'}).catch(()=>null);window.location.assign('/admin/login')}
  function openCreate(){setEditing(null);setSaveError('');setPhotoMode(false);setPreviewUrl(null);setGallery([]);setActiveLang('es');setTranslations({es:emptyTranslation(),en:emptyTranslation()});setModal(true)}
  function openEdit(tour:Tour){setEditing(tour);setSaveError('');setPhotoMode(false);setPreviewUrl(null);setGallery(parseGallery(tour.galleryImages));setActiveLang('es');setTranslations({es:translationFromMap(tour,'es'),en:translationFromMap(tour,'en')});setModal(true)}
  function openPhoto(tour:Tour){setEditing(tour);setSaveError('');setPhotoMode(true);setPreviewUrl(tour.mainImageUrl||null);setModal(true)}

  function updateTranslation(lang:LangCode,field:keyof Translation,value:string){setTranslations((prev)=>({...prev,[lang]:{...prev[lang],[field]:value}}))}

  async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();setSaving(true);setSaveError('');const form=new FormData(event.currentTarget);const es=translations.es;const en=translations.en;const payload={name:String(es.name||''),slug:String(form.get('slug')||''),destination:String(es.destination||''),shortDescription:String(es.shortDescription||''),description:String(es.description||''),duration:String(es.duration||''),adultPrice:String(form.get('adultPrice')||'0'),childPrice:String(form.get('childPrice')||''),currency:String(form.get('currency')||'USD'),capacity:String(form.get('capacity')||''),mainImageUrl:String(form.get('mainImageUrl')||''),status:String(form.get('status')||'draft'),translations:{es:{name:es.name,destination:es.destination,shortDescription:es.shortDescription,description:es.description,duration:es.duration},en:{name:en.name,destination:en.destination,shortDescription:en.shortDescription,description:en.description,duration:en.duration}}};try{const response=await fetch(editing?`/api/admin/tours/${editing.id}`:'/api/admin/tours',{method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(payload)});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'No fue posible guardar el tour.');setModal(false);setEditing(null);setPhotoMode(false);setPreviewUrl(null);setGallery([]);setTranslations({es:emptyTranslation(),en:emptyTranslation()});setActiveLang('es');await load()}catch(e){setSaveError(e instanceof Error?e.message:'No fue posible guardar el tour.')}finally{setSaving(false)}}

  async function uploadMainImage(file:File){if(!editing) return;setUploading(true);setSaveError('');try{const form=new FormData();form.append('image',file);const response=await fetch(`/api/admin/tours/${editing.id}/image`,{method:'POST',credentials:'same-origin',body:form});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'No fue posible subir la imagen.');setPreviewUrl(body.imageUrl);if(editing)setEditing({...editing,mainImageUrl:body.imageUrl});setSaveError('')  }catch(e){setSaveError(e instanceof Error?e.message:'No fue posible subir la imagen.')}finally{setUploading(false)}}

  async function uploadGallerySlot(index:number,file:File){if(!editing)return;if(file.size>8*1024*1024){setSaveError('La imagen no debe superar 8 MB.');return}if(!file.type.startsWith('image/')){setSaveError('El archivo debe ser una imagen.');return}setGalleryUploading(index);setSaveError('');try{const form=new FormData();form.append('image',file);const response=await fetch(`/api/admin/tours/${editing.id}/gallery/${index}`,{method:'PUT',credentials:'same-origin',body:form});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'No fue posible subir la foto.');setGallery(parseGallery(body.gallery));if(editing)setEditing({...editing,galleryImages:parseGallery(body.gallery)});setSaveError('');const r=fileRefs.current[index];if(r){r.value=''}}catch(e){setSaveError(e instanceof Error?e.message:'No fue posible subir la foto.')}finally{setGalleryUploading(null)}}

  async function deleteGallerySlot(index:number){if(!editing)return;if(!window.confirm('¿Quitar esta foto del tour?'))return;setSaveError('');try{const response=await fetch(`/api/admin/tours/${editing.id}/gallery/${index}`,{method:'DELETE',credentials:'same-origin'});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'No fue posible quitar la foto.');setGallery(parseGallery(body.gallery));if(editing)setEditing({...editing,galleryImages:parseGallery(body.gallery)})}catch(e){setSaveError(e instanceof Error?e.message:'No fue posible quitar la foto.')}}

  function handleMainFileChange(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){setSaveError('El archivo debe ser una imagen.');return}if(file.size>5*1024*1024){setSaveError('La imagen no debe superar 5 MB.');return}setPreviewUrl(URL.createObjectURL(file));void uploadMainImage(file)}
  function handleGalleryFileChange(index:number,e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(file)void uploadGallerySlot(index,file)}

  const slots=Array.from({length:Math.max(5,gallery.length+1)},(_,i)=>i).slice(0,MAX_GALLERY);

  return <div className="tours-app"><aside className={`tours-sidebar ${mobileMenu?'open':''}`}><div className="tours-brand"><span>C</span><div><strong>Capoy</strong><small>Costa Rica</small></div><button onClick={()=>setMobileMenu(false)}><X size={20}/></button></div><nav><a href="/admin"><LayoutDashboard size={18}/> Dashboard</a><a href="/admin/reservas"><ClipboardList size={18}/> Reservas</a><a className="active" href="/admin/tours"><ClipboardList size={18}/> Tours</a></nav><div className="tours-sidebar-bottom"><div><ShieldCheck size={16}/> Sesión protegida</div>{user&&<div className="tours-user"><span>{initials(user.displayName)}</span><div><strong>{user.displayName}</strong><small>{user.role}</small></div></div>}<button onClick={logout}><LogOut size={17}/> Cerrar sesión</button></div></aside>{mobileMenu&&<button className="tours-backdrop" onClick={()=>setMobileMenu(false)}/>}
  <main className="tours-main"><header className="tours-topbar"><div><button onClick={()=>setMobileMenu(true)}><Menu size={20}/></button><a href="/admin"><ArrowLeft size={17}/> Administración</a><span>/</span><strong>Tours</strong></div></header><section className="tours-content"><div className="tours-heading"><div><span>CATÁLOGO OPERATIVO</span><h1>Tours</h1><p>Crea, publica y administra las experiencias que vende Capoy.</p></div><button onClick={openCreate}><Plus size={18}/> Nuevo tour</button></div>
  {data&&<div className="tours-kpis"><article><span>Total</span><strong>{data.summary.total}</strong><small>Experiencias</small></article><article><span>Publicados</span><strong>{data.summary.published}</strong><small>Visibles para operación</small></article><article><span>Borradores</span><strong>{data.summary.draft}</strong><small>En preparación</small></article><article><span>Inactivos</span><strong>{data.summary.inactive}</strong><small>Fuera de venta</small></article></div>}
  <div className="tours-toolbar"><form onSubmit={e=>{e.preventDefault();load()}}><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar nombre, destino o slug"/><button>Buscar</button></form><select value={status} onChange={e=>{setStatus(e.target.value);setTimeout(load,0)}}><option value="all">Todos los estados</option>{statuses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
  {loading&&<div className="tours-state"><Loader2 className="spin"/> Cargando tours…</div>}{!loading&&error&&<div className="tours-state error">{error}</div>}{!loading&&!error&&data?.tours.length===0&&<div className="tours-empty"><ClipboardList size={36}/><h2>No hay tours todavía</h2><p>El catálogo está listo y conectado a MySQL.</p><button onClick={openCreate}><Plus size={17}/> Crear primer tour</button></div>}
  {!loading&&!error&&data&&data.tours.length>0&&<div className="tours-grid">{data.tours.map(t=>{const g=parseGallery(t.galleryImages);return <article key={t.id}><div className="tour-photo-wrap">{t.mainImageUrl?<img src={t.mainImageUrl} alt={t.name}/>:<div className="tour-placeholder">Sin imagen</div>}<button className="tour-photo-btn" onClick={()=>openPhoto(t)}><Camera size={16}/> Cambiar foto</button></div><div className="tour-card-body"><div className="tour-card-top"><span className={`tour-status ${t.status}`}>{statuses.find(s=>s[0]===t.status)?.[1]||t.status}</span><button onClick={()=>openEdit(t)}><Edit3 size={16}/> Editar</button></div><h2>{t.name}</h2><p>{t.destination}{t.duration?` · ${t.duration}`:''}</p><small>{t.shortDescription||'Sin descripción corta'}</small><div className="tour-prices"><strong>{money(t.adultPrice,t.currency)}</strong><span>Adulto</span>{t.childPrice!==null&&<><strong>{money(t.childPrice,t.currency)}</strong><span>Niño</span></>}</div>{g.length>0&&<div className="tour-card-gallery-hint"><ImageIcon size={13}/> {g.length} foto(s) en galería</div>}<code>/{t.slug}</code></div></article>})}</div>}</section></main>
  {modal&&<div className="tour-modal"><button className="tour-modal-backdrop" onClick={()=>setModal(false)}/><section><header><div><span>{photoMode?'CAMBIAR FOTO PRINCIPAL':editing?'EDITAR TOUR':'NUEVO TOUR'}</span><h2>{editing?editing.name:'Crear experiencia'}</h2></div><button onClick={()=>setModal(false)}><X size={20}/></button></header><form onSubmit={save}><div className="tour-form-grid">
  {photoMode && (<div className="wide tour-photo-section"><div className="wide tour-photo-preview">{(editing?.mainImageUrl||previewUrl)?<img src={previewUrl||editing?.mainImageUrl||''} alt={editing?.name||'Imagen principal'}/>:<div className="tour-placeholder tall">Sin imagen</div>}</div><label className="tour-file-input"><Upload size={18}/> Seleccionar imagen principal<input type="file" accept="image/*" onChange={handleMainFileChange} disabled={uploading}/></label>{uploading&&<div className="tour-gallery-status"><Loader2 className="spin" size={15}/> Subiendo…</div>}</div>)}
  {!photoMode&&(<>
    {(!editing||editing.id)&&<>
      <div className="wide tour-translations-bar">
        <span>Idioma de los campos informativos:</span>
        <div className="tour-translations-tabs">
          {LANGS.map(([code,label])=><button key={code} type="button" className={activeLang===code?'active':''} onClick={()=>setActiveLang(code)}>{label}</button>)}
        </div>
        <small>Los campos en español son obligatorios. Si inglés queda vacío, el público verá el texto en español.</small>
      </div>
      <label>Nombre ({activeLang.toUpperCase()})<input name={`name_${activeLang}`} value={translations[activeLang].name} onChange={(e)=>updateTranslation(activeLang,'name',e.target.value)} maxLength={180} required={activeLang==='es'}/></label>
      <label>Slug<input name="slug" defaultValue={editing?.slug||''} placeholder="se genera desde el nombre" maxLength={190}/></label>
      <label>Destino ({activeLang.toUpperCase()})<input name={`destination_${activeLang}`} value={translations[activeLang].destination} onChange={(e)=>updateTranslation(activeLang,'destination',e.target.value)} maxLength={160} required={activeLang==='es'}/></label>
      <label>Duración ({activeLang.toUpperCase()})<input name={`duration_${activeLang}`} value={translations[activeLang].duration||''} onChange={(e)=>updateTranslation(activeLang,'duration',e.target.value)} maxLength={80} placeholder="8 horas"/></label>
      <label>Precio adulto<input name="adultPrice" type="number" min="0" step="0.01" defaultValue={editing?.adultPrice??0} required/></label>
      <label>Precio niño<input name="childPrice" type="number" min="0" step="0.01" defaultValue={editing?.childPrice??''}/></label>
      <label>Moneda<input name="currency" defaultValue={editing?.currency||'USD'} maxLength={3} required/></label>
      <label>Capacidad<input name="capacity" type="number" min="1" defaultValue={editing?.capacity??''}/></label>
      <label className="wide">Imagen principal URL<input name="mainImageUrl" type="url" defaultValue={editing?.mainImageUrl||''} placeholder="https://..." autoFocus={!editing}/></label>
      <label>Estado<select name="status" defaultValue={editing?.status||'draft'}>{statuses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label className="wide">Descripción corta ({activeLang.toUpperCase()})<input name={`shortDescription_${activeLang}`} value={translations[activeLang].shortDescription||''} onChange={(e)=>updateTranslation(activeLang,'shortDescription',e.target.value)} maxLength={320}/></label>
      <label className="wide">Descripción ({activeLang.toUpperCase()})<textarea name={`description_${activeLang}`} rows={5} value={translations[activeLang].description||''} onChange={(e)=>updateTranslation(activeLang,'description',e.target.value)}/></label>
    </>}
    {editing&&editing.id&&(
      <div className="wide tour-gallery-section">
        <div className="tour-gallery-heading"><div><ImageIcon size={15}/><strong>Galería de fotos</strong></div><small>{gallery.filter(Boolean).length}/{MAX_GALLERY} fotos</small></div>
        <p className="tour-gallery-hint">Cada foto se guarda con la marca de agua «Capoy Costa Rica». Toca «Cambiar» en cualquier foto para reemplazarla individualmente. Se guarda al instante.</p>
        <div className="tour-gallery-grid">{slots.map(i=>{
          const url=gallery[i];
          return <div className={`tour-gallery-slot ${url?'filled':'empty'}`} key={i}>
            {url?<><img src={url} alt={`Foto ${i+1}`} loading="lazy"/><span className="tour-gallery-slot-idx">{i+1}</span><button type="button" className="tour-gallery-del" aria-label="Quitar foto" onClick={()=>deleteGallerySlot(i)}><Trash2 size={14}/></button></>:<div className="tour-gallery-empty"><ImageIcon size={20}/><small>{i+1}</small></div>}
            <button type="button" className="tour-gallery-change" disabled={galleryUploading!==null} onClick={()=>fileRefs.current[i]?.click()}>
              {galleryUploading===i?<><Loader2 className="spin" size={14}/> Subiendo…</>:url?<><Camera size={14}/> Cambiar</>:<><Plus size={14}/> Agregar</>}
            </button>
            <input ref={el=>{fileRefs.current[i]=el}} type="file" accept="image/*" hidden onChange={e=>handleGalleryFileChange(i,e)} disabled={galleryUploading!==null}/>
          </div>})}</div>
      </div>
    )}
    {!editing&&<div className="wide tour-gallery-note"><ImageIcon size={15}/> Guarda el tour y enseguida podrás agregar hasta {MAX_GALLERY} fotos con marca de agua a su galería.</div>}
  </>)}
  </div>{saveError&&<div className="tour-form-error">{saveError}</div>}<footer><button type="button" onClick={()=>setModal(false)}>Cancelar</button><button className="primary" disabled={saving||uploading||galleryUploading!==null}>{saving?<><Loader2 className="spin" size={17}/> Guardando…</>:uploading?'Subiendo…':photoMode?'Guardar foto':editing?'Guardar cambios':'Crear tour'}</button></footer></form></section></div>}</div>
}