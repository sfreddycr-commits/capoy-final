import { registerAuditRoutes } from './audit.js';

const ALLOWED_KEYS=new Set(['business_name','timezone','default_currency','default_language','booking_email','booking_phone','reservation_prefix','maintenance_mode']);
const TIMEZONES=new Set(['America/Costa_Rica','America/Panama','America/Guatemala','America/Mexico_City','America/New_York','UTC']);
const CURRENCIES=new Set(['USD','CRC']);
const LANGUAGES=new Set(['es','en']);
function clean(value,max=500){return String(value??'').trim().slice(0,max)}
function requireOwner(req,res,next){if(req.admin?.role!=='owner')return res.status(403).json({error:'Se requiere rol propietario.'});next()}
function validate(key,value){
 if(!ALLOWED_KEYS.has(key))return 'Campo de configuración no permitido.';
 if(key==='business_name'&&(value.length<2||value.length>120))return 'Nombre comercial inválido.';
 if(key==='timezone'&&!TIMEZONES.has(value))return 'Zona horaria inválida.';
 if(key==='default_currency'&&!CURRENCIES.has(value))return 'Moneda inválida.';
 if(key==='default_language'&&!LANGUAGES.has(value))return 'Idioma inválido.';
 if(key==='booking_email'&&value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))return 'Correo de reservas inválido.';
 if(key==='booking_phone'&&value&&!/^\+?[0-9 ()-]{7,30}$/.test(value))return 'Teléfono de reservas inválido.';
 if(key==='reservation_prefix'&&!/^[A-Z0-9-]{2,12}$/.test(value))return 'Prefijo de reserva inválido.';
 if(key==='maintenance_mode'&&!['true','false'].includes(value))return 'Modo mantenimiento inválido.';
 return null;
}
export function registerSettingsRoutes({app,pool,requireSession,sameOriginOnly,audit}){
 registerAuditRoutes({app,pool,requireSession});
 app.get('/api/admin/settings',requireSession,async(req,res)=>{try{const [rows]=await pool.query('SELECT setting_key,setting_value,updated_at FROM app_settings ORDER BY setting_key');const settings={};for(const row of rows)settings[row.setting_key]={value:row.setting_value,updatedAt:row.updated_at};res.json({ok:true,editable:req.admin.role==='owner',settings});}catch(error){console.error('settings_list_failed',error.message);res.status(503).json({error:'No fue posible cargar la configuración.'})}});
 app.patch('/api/admin/settings',sameOriginOnly,requireSession,requireOwner,async(req,res)=>{const incoming=req.body?.settings;if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))return res.status(400).json({error:'Configuración inválida.'});const entries=[];for(const [key,raw] of Object.entries(incoming)){const value=clean(raw,key==='booking_email'?190:500);const error=validate(key,value);if(error)return res.status(400).json({error});entries.push([key,value])}if(!entries.length)return res.status(400).json({error:'No hay cambios para guardar.'});const conn=await pool.getConnection();try{await conn.beginTransaction();for(const [key,value] of entries)await conn.execute('INSERT INTO app_settings (setting_key,setting_value,updated_by_admin_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_by_admin_id=VALUES(updated_by_admin_id)',[key,value,req.admin.id]);await conn.commit();await audit(req,'settings_updated',{userId:req.admin.id,email:req.admin.email,metadata:{keys:entries.map(([key])=>key)}});res.json({ok:true,updated:entries.length});}catch(error){await conn.rollback();console.error('settings_update_failed',error.message);res.status(503).json({error:'No fue posible guardar la configuración.'})}finally{conn.release()}});
}
