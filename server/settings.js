import { registerAuditRoutes } from './audit.js';

const ALLOWED_KEYS=new Set([
  // Original
  'business_name','timezone','default_currency','default_language','booking_email','booking_phone','reservation_prefix','maintenance_mode',
  // Boutique company profile
  'company_legal_name','company_tax_id','company_logo_url','company_favicon_url',
  'company_phone','company_whatsapp','company_email','company_address','company_website',
  'company_hours','company_tagline','company_country',
  'social_facebook','social_instagram','social_tiktok','social_whatsapp_link','social_youtube',
  'currency_symbol'
]);
const TIMEZONES=new Set(['America/Costa_Rica','America/Panama','America/Guatemala','America/Mexico_City','America/New_York','UTC']);
const CURRENCIES=new Set(['USD','CRC']);
const LANGUAGES=new Set(['es','en']);
const COUNTRY_RE=new RegExp("^[\\p{L}\\p{N}\\p{P}\\p{Z}._/,'’\\-]{0,180}$",'u');
const PHONE_RE=/^\+?[0-9 ()-]{7,30}$/;
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE=/^https?:\/\/[\w.-]+(?::\d+)?(?:[\/\?#][^\s]*)?$/i;
const SHORT=new Set(['business_name','company_country','default_language']);
const LONG=new Set(['company_legal_name','company_address','company_hours','company_tagline']);
const EMAIL_FIELDS=new Set(['company_email','booking_email']);
const URL_FIELDS=new Set(['company_logo_url','company_favicon_url','company_website','social_facebook','social_instagram','social_tiktok','social_whatsapp_link','social_youtube']);
const PHONE_FIELDS=new Set(['company_phone','company_whatsapp','booking_phone']);
const PREFIX_FIELDS=new Set(['reservation_prefix']);
const TIMEZONE_FIELDS=new Set(['timezone']);
const CURRENCY_FIELDS=new Set(['default_currency']);
const CURRENCY_SYMBOL_FIELDS=new Set(['currency_symbol']);
const LANG_FIELDS=new Set(['default_language']);
const BOOLEAN_FIELDS=new Set(['maintenance_mode']);
function clean(value,max=500){return String(value??'').trim().slice(0,max)}
function requireOwner(req,res,next){if(req.admin?.role!=='owner')return res.status(403).json({error:'Se requiere rol propietario.'});next()}
function validate(key,value){
 if(!ALLOWED_KEYS.has(key))return 'Campo de configuración no permitido.';
 if(SHORT.has(key)&&(value.length<2||value.length>120))return 'Nombre comercial inválido.';
 if(LONG.has(key)&&value.length>500)return 'Campo demasiado largo (máx 500).';
 if(EMAIL_FIELDS.has(key)&&value&&!EMAIL_RE.test(value))return 'Correo inválido.';
 if(URL_FIELDS.has(key)&&value&&!URL_RE.test(value))return 'URL inválida.';
 if(PHONE_FIELDS.has(key)&&value&&!PHONE_RE.test(value))return 'Teléfono inválido.';
 if(PREFIX_FIELDS.has(key)&&!/^[A-Z0-9-]{2,12}$/.test(value))return 'Prefijo de reserva inválido.';
 if(TIMEZONE_FIELDS.has(key)&&!TIMEZONES.has(value))return 'Zona horaria inválida.';
 if(CURRENCY_FIELDS.has(key)&&!CURRENCIES.has(value))return 'Moneda inválida.';
 if(CURRENCY_SYMBOL_FIELDS.has(key)&&value&&!/^[A-Z$₡€£¥]{0,5}$/.test(value))return 'Símbolo de moneda inválido (use letras, $, ₡, €, £, ¥).';
 if(LANG_FIELDS.has(key)&&!LANGUAGES.has(value))return 'Idioma inválido.';
 if(BOOLEAN_FIELDS.has(key)&&!['true','false'].includes(value))return 'Modo mantenimiento inválido.';
 if(key==='company_country'&&value&&!COUNTRY_RE.test(value))return 'País inválido.';
 return null;
}
export function registerSettingsRoutes({app,pool,requireSession,sameOriginOnly,audit}){
 registerAuditRoutes({app,pool,requireSession});
  app.get('/api/admin/settings',requireSession,async(req,res)=>{
    try{
      const [rows]=await pool.query(`SELECT s.setting_key, s.setting_value, s.updated_at, s.updated_by_admin_id, u.display_name AS updated_by_name, u.email AS updated_by_email
        FROM app_settings s LEFT JOIN admin_users u ON u.id = s.updated_by_admin_id
        ORDER BY s.setting_key`);
      const settings={};
      for(const row of rows){
        settings[row.setting_key]={
          value:row.setting_value,
          updatedAt:row.updated_at,
          updatedBy: row.updated_by_admin_id ? { id:Number(row.updated_by_admin_id), displayName:row.updated_by_name, email:row.updated_by_email } : null,
        };
      }
      res.json({ok:true,editable:req.admin.role==='owner',settings});
    }catch(error){console.error('settings_list_failed',error.message);res.status(503).json({error:'No fue posible cargar la configuración.'})}
  });

  // Active sessions for current admin (owner only) — used by the Security panel
  app.get('/api/admin/sessions', requireSession, requireOwner, async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id, ip_address, user_agent, created_at, expires_at
         FROM admin_sessions
         WHERE user_id = ? AND expires_at > NOW()
         ORDER BY created_at DESC`,
        [req.admin.id],
      );
      res.json({
        ok: true,
        sessions: rows.map((r) => ({
          id: Number(r.id),
          ipAddress: r.ip_address || null,
          userAgent: String(r.user_agent || '').slice(0, 160),
          createdAt: r.created_at,
          expiresAt: r.expires_at,
          current: Number(r.id) === Number(req.admin.sessionId),
        })),
      });
    } catch (error) {
      console.error('sessions_list_failed', error.message);
      res.status(503).json({ error: 'No fue posible cargar las sesiones activas.' });
    }
  });

  app.delete('/api/admin/sessions/:id', sameOriginOnly, requireSession, requireOwner, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Sesión inválida.' });
    if (id === Number(req.admin.sessionId)) return res.status(400).json({ error: 'No puedes revocar tu sesión actual desde aquí.' });
    try {
      const [result] = await pool.execute('DELETE FROM admin_sessions WHERE id = ? AND user_id = ?', [id, req.admin.id]);
      if (!result.affectedRows) return res.status(404).json({ error: 'Sesión no encontrada.' });
      await audit(req, 'session_revoked', { userId: req.admin.id, email: req.admin.email, metadata: { revokedSessionId: id } });
      res.json({ ok: true });
    } catch (error) {
      console.error('session_revoke_failed', error.message);
      res.status(503).json({ error: 'No fue posible revocar la sesión.' });
    }
  });
 app.patch('/api/admin/settings',sameOriginOnly,requireSession,requireOwner,async(req,res)=>{const incoming=req.body?.settings;if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))return res.status(400).json({error:'Configuración inválida.'});const entries=[];for(const [key,raw] of Object.entries(incoming)){const value=clean(raw,key==='booking_email'?190:500);const error=validate(key,value);if(error)return res.status(400).json({error});entries.push([key,value])}if(!entries.length)return res.status(400).json({error:'No hay cambios para guardar.'});const conn=await pool.getConnection();try{await conn.beginTransaction();for(const [key,value] of entries)await conn.execute('INSERT INTO app_settings (setting_key,setting_value,updated_by_admin_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_by_admin_id=VALUES(updated_by_admin_id)',[key,value,req.admin.id]);await conn.commit();await audit(req,'settings_updated',{userId:req.admin.id,email:req.admin.email,metadata:{keys:entries.map(([key])=>key)}});res.json({ok:true,updated:entries.length});}catch(error){await conn.rollback();console.error('settings_update_failed',error.message);res.status(503).json({error:'No fue posible guardar la configuración.'})}finally{conn.release()}});
}
