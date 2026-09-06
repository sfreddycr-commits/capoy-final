const ALLOWED_PERIODS=new Set(['24h','7d','30d','90d','all']);
function clean(value,max=200){return String(value??'').trim().slice(0,max)}
function requireOwner(req,res,next){if(req.admin?.role!=='owner')return res.status(403).json({error:'Se requiere rol propietario.'});next()}
function periodClause(period){if(period==='24h')return 'AND a.created_at>=DATE_SUB(NOW(), INTERVAL 24 HOUR)';if(period==='7d')return 'AND a.created_at>=DATE_SUB(NOW(), INTERVAL 7 DAY)';if(period==='30d')return 'AND a.created_at>=DATE_SUB(NOW(), INTERVAL 30 DAY)';if(period==='90d')return 'AND a.created_at>=DATE_SUB(NOW(), INTERVAL 90 DAY)';return ''}
function safeMetadata(value){if(value===null||value===undefined)return null;try{return typeof value==='string'?JSON.parse(value):value}catch{return null}}
export function registerAuditRoutes({app,pool,requireSession}){
 app.get('/api/admin/audit',requireSession,requireOwner,async(req,res)=>{
  const q=clean(req.query.q,120),eventType=clean(req.query.eventType,60),period=clean(req.query.period||'7d',10),page=Math.max(1,Number.parseInt(String(req.query.page||'1'),10)||1),limit=Math.min(100,Math.max(10,Number.parseInt(String(req.query.limit||'25'),10)||25)),offset=(page-1)*limit;
  if(!ALLOWED_PERIODS.has(period))return res.status(400).json({error:'Período inválido.'});
  const where=['1=1'];const params=[];
  if(eventType&&eventType!=='all'){where.push('a.event_type=?');params.push(eventType)}
  if(q){const like=`%${q}%`;where.push('(a.event_type LIKE ? OR a.email_attempted LIKE ? OR u.display_name LIKE ? OR a.ip_address LIKE ?)');params.push(like,like,like,like)}
  const clause=`WHERE ${where.join(' AND ')} ${periodClause(period)}`;
  try{
   const [[countRows],[rows],[types],[summaryRows]]=await Promise.all([
    pool.execute(`SELECT COUNT(*) total FROM admin_audit_log a LEFT JOIN admin_users u ON u.id=a.user_id ${clause}`,params),
    pool.execute(`SELECT a.id,a.user_id,a.event_type,a.email_attempted,a.ip_address,a.user_agent,a.metadata_json,a.created_at,u.display_name FROM admin_audit_log a LEFT JOIN admin_users u ON u.id=a.user_id ${clause} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,[...params,limit,offset]),
    pool.query('SELECT event_type,COUNT(*) total FROM admin_audit_log GROUP BY event_type ORDER BY event_type'),
    pool.query("SELECT COUNT(*) total,SUM(created_at>=DATE_SUB(NOW(),INTERVAL 24 HOUR)) last24h,COUNT(DISTINCT user_id) actors FROM admin_audit_log")
   ]);
   const total=Number(countRows[0]?.total||0),s=summaryRows[0]||{};
   res.json({ok:true,summary:{total:Number(s.total||0),last24h:Number(s.last24h||0),actors:Number(s.actors||0),eventTypes:types.length},pagination:{page,limit,total,pages:Math.max(1,Math.ceil(total/limit))},eventTypes:types.map(r=>({eventType:r.event_type,total:Number(r.total||0)})),events:rows.map(r=>({id:Number(r.id),userId:r.user_id===null?null:Number(r.user_id),displayName:r.display_name||null,email:r.email_attempted||null,eventType:r.event_type,ipAddress:r.ip_address||null,userAgent:r.user_agent||null,metadata:safeMetadata(r.metadata_json),createdAt:r.created_at}))});
  }catch(error){console.error('audit_list_failed',error.message);res.status(503).json({error:'No fue posible cargar la auditoría.'})}
 });
}
