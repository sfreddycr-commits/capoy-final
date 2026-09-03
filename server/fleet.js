const FLEET_STATUSES = new Set(['active','maintenance','inactive']);
const VEHICLE_TYPES = new Set(['car','suv','van','minibus','bus','boat','other']);

function cleanText(value,maxLength){return String(value??'').trim().slice(0,maxLength)}
function nullableText(value,maxLength){const text=cleanText(value,maxLength);return text||null}
function fleetPayload(body){
  const plate=cleanText(body?.plate,40).toUpperCase();
  const name=cleanText(body?.name,160);
  const vehicleType=cleanText(body?.vehicleType||'van',32);
  const brand=nullableText(body?.brand,80);
  const model=nullableText(body?.model,100);
  const rawYear=body?.modelYear;
  const modelYear=rawYear===''||rawYear===null||rawYear===undefined?null:Number(rawYear);
  const capacity=Number(body?.capacity);
  const status=cleanText(body?.status||'active',32);
  const notes=nullableText(body?.notes,4000);
  if(plate.length<2||name.length<2)return{error:'Placa y nombre son obligatorios.'};
  if(!VEHICLE_TYPES.has(vehicleType))return{error:'Tipo de vehículo inválido.'};
  if(!Number.isInteger(capacity)||capacity<1||capacity>500)return{error:'Capacidad inválida.'};
  if(modelYear!==null&&(!Number.isInteger(modelYear)||modelYear<1950||modelYear>2100))return{error:'Año inválido.'};
  if(!FLEET_STATUSES.has(status))return{error:'Estado de vehículo inválido.'};
  return{plate,name,vehicleType,brand,model,modelYear,capacity,status,notes};
}
function mapFleet(row){return{id:Number(row.id),plate:row.plate,name:row.name,vehicleType:row.vehicle_type,brand:row.brand,model:row.model,modelYear:row.model_year===null?null:Number(row.model_year),capacity:Number(row.capacity),status:row.status,notes:row.notes,createdAt:row.created_at,updatedAt:row.updated_at}}

export function registerFleetRoutes({app,pool,requireSession,sameOriginOnly,audit}){
  app.get('/api/admin/fleet',requireSession,async(req,res)=>{
    try{
      const status=cleanText(req.query.status,32),vehicleType=cleanText(req.query.vehicleType,32),q=cleanText(req.query.q,120);
      const page=Math.max(1,Number.parseInt(String(req.query.page||'1'),10)||1),limit=Math.min(100,Math.max(10,Number.parseInt(String(req.query.limit||'25'),10)||25)),offset=(page-1)*limit;
      const where=[],params=[];
      if(status&&status!=='all'){if(!FLEET_STATUSES.has(status))return res.status(400).json({error:'Filtro de estado inválido.'});where.push('status=?');params.push(status)}
      if(vehicleType&&vehicleType!=='all'){if(!VEHICLE_TYPES.has(vehicleType))return res.status(400).json({error:'Filtro de tipo inválido.'});where.push('vehicle_type=?');params.push(vehicleType)}
      if(q){const like=`%${q}%`;where.push('(plate LIKE ? OR name LIKE ? OR brand LIKE ? OR model LIKE ?)');params.push(like,like,like,like)}
      const clause=where.length?`WHERE ${where.join(' AND ')}`:'';
      const [[summaryRows],[countRows],[rows]]=await Promise.all([
        pool.query("SELECT COUNT(*) total,SUM(status='active') activeCount,SUM(status='maintenance') maintenanceCount,SUM(status='inactive') inactiveCount,SUM(capacity) totalCapacity FROM fleet"),
        pool.execute(`SELECT COUNT(*) total FROM fleet ${clause}`,params),
        pool.execute(`SELECT id,plate,name,vehicle_type,brand,model,model_year,capacity,status,notes,created_at,updated_at FROM fleet ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,[...params,limit,offset]),
      ]);
      const summary=summaryRows[0]||{},total=Number(countRows[0]?.total||0);
      res.json({ok:true,summary:{total:Number(summary.total||0),active:Number(summary.activeCount||0),maintenance:Number(summary.maintenanceCount||0),inactive:Number(summary.inactiveCount||0),totalCapacity:Number(summary.totalCapacity||0)},pagination:{page,limit,total,pages:Math.max(1,Math.ceil(total/limit))},fleet:rows.map(mapFleet)});
    }catch(error){console.error('fleet_list_failed',error.message);res.status(503).json({error:'No fue posible cargar la flota.'})}
  });

  app.post('/api/admin/fleet',sameOriginOnly,requireSession,async(req,res)=>{
    const payload=fleetPayload(req.body);if(payload.error)return res.status(400).json({error:payload.error});
    try{
      const [result]=await pool.execute('INSERT INTO fleet (plate,name,vehicle_type,brand,model,model_year,capacity,status,notes,created_by_admin_id,updated_by_admin_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[payload.plate,payload.name,payload.vehicleType,payload.brand,payload.model,payload.modelYear,payload.capacity,payload.status,payload.notes,req.admin.id,req.admin.id]);
      await audit(req,'fleet_created',{userId:req.admin.id,email:req.admin.email,metadata:{fleetId:result.insertId,plate:payload.plate}});
      res.status(201).json({ok:true,vehicle:{id:Number(result.insertId)}});
    }catch(error){if(error?.code==='ER_DUP_ENTRY')return res.status(409).json({error:'Ya existe un vehículo con esa placa.'});console.error('fleet_create_failed',error.message);res.status(503).json({error:'No fue posible crear el vehículo.'})}
  });

  app.patch('/api/admin/fleet/:id',sameOriginOnly,requireSession,async(req,res)=>{
    const id=Number.parseInt(req.params.id,10);if(!Number.isInteger(id)||id<1)return res.status(400).json({error:'Vehículo inválido.'});
    const payload=fleetPayload(req.body);if(payload.error)return res.status(400).json({error:payload.error});
    try{
      const [result]=await pool.execute('UPDATE fleet SET plate=?,name=?,vehicle_type=?,brand=?,model=?,model_year=?,capacity=?,status=?,notes=?,updated_by_admin_id=? WHERE id=?',[payload.plate,payload.name,payload.vehicleType,payload.brand,payload.model,payload.modelYear,payload.capacity,payload.status,payload.notes,req.admin.id,id]);
      if(!result.affectedRows)return res.status(404).json({error:'Vehículo no encontrado.'});
      await audit(req,'fleet_updated',{userId:req.admin.id,email:req.admin.email,metadata:{fleetId:id,status:payload.status}});res.json({ok:true});
    }catch(error){if(error?.code==='ER_DUP_ENTRY')return res.status(409).json({error:'Ya existe un vehículo con esa placa.'});console.error('fleet_update_failed',error.message);res.status(503).json({error:'No fue posible actualizar el vehículo.'})}
  });
}
