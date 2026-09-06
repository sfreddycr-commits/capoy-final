import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);
const USER_ROLES = new Set(['owner','admin']);
const USER_STATUSES = new Set(['active','inactive']);

function cleanText(value,maxLength){return String(value??'').trim().slice(0,maxLength)}
function normalizeEmail(value){return String(value||'').trim().toLowerCase()}
function validEmail(email){return email.length<=190&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
function validPassword(password){return typeof password==='string'&&password.length>=12&&password.length<=200}
async function hashPassword(password){const salt=crypto.randomBytes(16).toString('hex');const derived=await scryptAsync(password,salt,64);return `scrypt$${salt}$${Buffer.from(derived).toString('hex')}`}
function requireOwner(req,res,next){if(req.admin?.role!=='owner')return res.status(403).json({error:'Se requiere rol propietario.'});next()}
function mapUser(row){return{id:Number(row.id),email:row.email,displayName:row.display_name,role:row.role,status:row.status,lastLoginAt:row.last_login_at,passwordChangedAt:row.password_changed_at,createdAt:row.created_at,updatedAt:row.updated_at,activeSessions:Number(row.active_sessions||0)}}

export function registerUserRoutes({app,pool,requireSession,sameOriginOnly,audit}){
  app.get('/api/admin/users',requireSession,requireOwner,async(_req,res)=>{
    try{
      const [rows]=await pool.query(`SELECT u.id,u.email,u.display_name,u.role,u.status,u.last_login_at,u.password_changed_at,u.created_at,u.updated_at,
        (SELECT COUNT(*) FROM admin_sessions s WHERE s.user_id=u.id AND s.expires_at>NOW()) active_sessions
        FROM admin_users u ORDER BY u.created_at ASC`);
      const users=rows.map(mapUser);
      res.json({ok:true,summary:{total:users.length,active:users.filter(u=>u.status==='active').length,owners:users.filter(u=>u.role==='owner'&&u.status==='active').length,admins:users.filter(u=>u.role==='admin'&&u.status==='active').length},users});
    }catch(error){console.error('users_list_failed',error.message);res.status(503).json({error:'No fue posible cargar los usuarios internos.'})}
  });

  app.post('/api/admin/users',sameOriginOnly,requireSession,requireOwner,async(req,res)=>{
    const email=normalizeEmail(req.body?.email),displayName=cleanText(req.body?.displayName,120),role=cleanText(req.body?.role||'admin',40),status=cleanText(req.body?.status||'active',20),password=req.body?.password;
    if(!validEmail(email)||displayName.length<2)return res.status(400).json({error:'Nombre o correo inválido.'});
    if(!USER_ROLES.has(role))return res.status(400).json({error:'Rol inválido.'});
    if(!USER_STATUSES.has(status))return res.status(400).json({error:'Estado inválido.'});
    if(!validPassword(password))return res.status(400).json({error:'La contraseña inicial debe tener al menos 12 caracteres.'});
    try{
      const passwordHash=await hashPassword(password);
      const [result]=await pool.execute('INSERT INTO admin_users (email,display_name,password_hash,role,status) VALUES (?,?,?,?,?)',[email,displayName,passwordHash,role,status]);
      await audit(req,'admin_user_created',{userId:req.admin.id,email:req.admin.email,metadata:{createdUserId:result.insertId,role,status}});
      res.status(201).json({ok:true,user:{id:Number(result.insertId)}});
    }catch(error){if(error?.code==='ER_DUP_ENTRY')return res.status(409).json({error:'Ya existe un usuario con ese correo.'});console.error('user_create_failed',error.message);res.status(503).json({error:'No fue posible crear el usuario.'})}
  });

  app.patch('/api/admin/users/:id',sameOriginOnly,requireSession,requireOwner,async(req,res)=>{
    const id=Number.parseInt(req.params.id,10);if(!Number.isInteger(id)||id<1)return res.status(400).json({error:'Usuario inválido.'});
    const email=normalizeEmail(req.body?.email),displayName=cleanText(req.body?.displayName,120),role=cleanText(req.body?.role,40),status=cleanText(req.body?.status,20),password=req.body?.password;
    if(!validEmail(email)||displayName.length<2)return res.status(400).json({error:'Nombre o correo inválido.'});
    if(!USER_ROLES.has(role))return res.status(400).json({error:'Rol inválido.'});
    if(!USER_STATUSES.has(status))return res.status(400).json({error:'Estado inválido.'});
    if(password!==undefined&&password!==''&&!validPassword(password))return res.status(400).json({error:'La nueva contraseña debe tener al menos 12 caracteres.'});
    try{
      const [existingRows]=await pool.execute('SELECT id,role,status FROM admin_users WHERE id=? LIMIT 1',[id]);
      const existing=existingRows[0];if(!existing)return res.status(404).json({error:'Usuario no encontrado.'});
      if(id===req.admin.id&&(role!=='owner'||status!=='active'))return res.status(400).json({error:'No puede quitarse su propio acceso de propietario.'});
      if(existing.role==='owner'&&existing.status==='active'&&(role!=='owner'||status!=='active')){
        const [ownerRows]=await pool.query("SELECT COUNT(*) total FROM admin_users WHERE role='owner' AND status='active'");
        if(Number(ownerRows[0]?.total||0)<=1)return res.status(400).json({error:'Debe existir al menos un propietario activo.'});
      }
      const passwordHash=password?await hashPassword(password):null;
      if(passwordHash){
        await pool.execute('UPDATE admin_users SET email=?,display_name=?,role=?,status=?,password_hash=?,password_changed_at=NOW() WHERE id=?',[email,displayName,role,status,passwordHash,id]);
        await pool.execute('DELETE FROM admin_sessions WHERE user_id=? AND id<>?',[id,id===req.admin.id?req.admin.sessionId:0]);
      }else{
        await pool.execute('UPDATE admin_users SET email=?,display_name=?,role=?,status=? WHERE id=?',[email,displayName,role,status,id]);
        if(status==='inactive')await pool.execute('DELETE FROM admin_sessions WHERE user_id=?',[id]);
      }
      await audit(req,'admin_user_updated',{userId:req.admin.id,email:req.admin.email,metadata:{updatedUserId:id,role,status,passwordChanged:Boolean(passwordHash)}});
      res.json({ok:true});
    }catch(error){if(error?.code==='ER_DUP_ENTRY')return res.status(409).json({error:'Ya existe un usuario con ese correo.'});console.error('user_update_failed',error.message);res.status(503).json({error:'No fue posible actualizar el usuario.'})}
  });
}
