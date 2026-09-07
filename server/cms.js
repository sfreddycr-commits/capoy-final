import { registerUserRoutes } from './users.js';
import { registerMaintenanceRoutes } from './maintenance.js';

const ALLOWED_KEYS = new Set([
  'hero_eyebrow','hero_title','hero_lead','hero_primary_cta','hero_secondary_cta','hero_image',
  'contact_phone','contact_email','contact_location','cta_title','cta_copy','footer_copy',
]);
function clean(value,max=5000){return String(value??'').trim().slice(0,max)}
function validUrl(value){if(!value)return true;try{const u=new URL(value);return u.protocol==='http:'||u.protocol==='https:'}catch{return false}}

export function registerCmsRoutes({app,pool,requireSession,sameOriginOnly,audit}){
  registerUserRoutes({app,pool,requireSession,sameOriginOnly,audit});
  registerMaintenanceRoutes({app,pool,requireSession,sameOriginOnly,audit});

  app.get('/api/public/cms', async (_req,res)=>{
    try{
      const [rows]=await pool.query('SELECT setting_key,setting_value FROM cms_settings');
      const settings={};
      for(const row of rows)settings[row.setting_key]=row.setting_value;
      res.json({ok:true,settings});
    }catch(error){console.error('cms_public_failed',error.message);res.status(503).json({error:'No fue posible cargar el contenido público.'})}
  });

  app.get('/api/admin/cms', requireSession, async (_req,res)=>{
    try{
      const [rows]=await pool.query('SELECT setting_key,setting_value,updated_at FROM cms_settings ORDER BY setting_key');
      const settings={};
      for(const row of rows)settings[row.setting_key]={value:row.setting_value,updatedAt:row.updated_at};
      res.json({ok:true,settings});
    }catch(error){console.error('cms_admin_failed',error.message);res.status(503).json({error:'No fue posible cargar el CMS.'})}
  });

  app.patch('/api/admin/cms', sameOriginOnly, requireSession, async (req,res)=>{
    const incoming=req.body?.settings;
    if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))return res.status(400).json({error:'Configuración CMS inválida.'});
    const entries=[];
    for(const [key,raw] of Object.entries(incoming)){
      if(!ALLOWED_KEYS.has(key))return res.status(400).json({error:`Campo CMS no permitido: ${key}`});
      const value=clean(raw,key==='hero_image'?1000:5000);
      if(key==='hero_title'&&value.length<3)return res.status(400).json({error:'Título principal inválido.'});
      if(key==='hero_lead'&&value.length<5)return res.status(400).json({error:'Texto principal inválido.'});
      if(key==='contact_email'&&value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))return res.status(400).json({error:'Correo de contacto inválido.'});
      if(key==='hero_image'&&!validUrl(value))return res.status(400).json({error:'URL de imagen inválida.'});
      entries.push([key,value]);
    }
    if(!entries.length)return res.status(400).json({error:'No hay cambios para guardar.'});
    const conn=await pool.getConnection();
    try{
      await conn.beginTransaction();
      for(const [key,value] of entries){
        await conn.execute('INSERT INTO cms_settings (setting_key,setting_value,updated_by_admin_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_by_admin_id=VALUES(updated_by_admin_id)',[key,value,req.admin.id]);
      }
      await conn.commit();
      await audit(req,'cms_updated',{userId:req.admin.id,email:req.admin.email,metadata:{keys:entries.map(([key])=>key)}});
      res.json({ok:true,updated:entries.length});
    }catch(error){await conn.rollback();console.error('cms_update_failed',error.message);res.status(503).json({error:'No fue posible guardar el CMS.'})}finally{conn.release()}
  });
}
