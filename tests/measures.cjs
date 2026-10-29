/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const ts=require('typescript');const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'..');let currentUser;let db;
const cache={};
function load(name){
 const file=path.join(root,name.replace(/^@\//,''))+'.ts';if(cache[file])return cache[file];
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};cache[file]=mod.exports;
 function req(id){if(id==='@/lib/auth')return {getSessionUser:async()=>currentUser};
 if(id==='@/lib/db')return {db:()=>async(strings,...values)=>{let sql=strings[0];values.forEach((_,i)=>sql+='$'+(i+1)+strings[i+1]);return (await db.query(sql,values)).rows;}};
 return id.startsWith('@/')?load(id):require(id);}
 new Function('require','module','exports',source)(req,mod,mod.exports);cache[file]=mod.exports;return mod.exports;
}
const U='11111111-1111-4111-8111-111111111111', F='33333333-3333-4333-8333-333333333333', F2='44444444-4444-4444-8444-444444444444';
const {randomUUID}=require('node:crypto');
const request=b=>new Request('http://localhost/api/items',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
(async()=>{
 db=new PGlite();await db.exec(fs.readFileSync(root+'/database/schema.sql','utf8'));await db.exec(fs.readFileSync(root+'/database/migrations/006_global_product_catalog.sql','utf8'));
 const migration=fs.readFileSync(root+'/database/migrations/009_quantities_and_units.sql','utf8');await db.exec(migration);await db.exec(migration);
 await db.exec(`INSERT INTO users(id,name,email,password_hash) VALUES('${U}','Dayvson','d@test.invalid','test');INSERT INTO families(id,name,created_by) VALUES('${F}','Família','${U}'),('${F2}','Outra','${U}');INSERT INTO family_members(family_id,user_id,role) VALUES('${F}','${U}','owner')`);
 currentUser={id:U,familyId:F,collectPricesOnPurchase:true};
 const items=load('app/api/items/route'),complete=load('app/api/purchases/complete/route');
 async function add(name,quantity,unit,productId=randomUUID()) {const id=randomUUID();const res=await items.POST(request({id,productId,name,quantity,unit,measurementVersion:2}));assert.equal(res.status,201,await res.text());return id;}
 async function buy(id,price,qty,mode='unit'){const r=await items.PATCH(request({id,completed:true,unitPrice:price,measuredQuantity:qty,priceMode:mode,measurementVersion:2}));assert.equal(r.status,200,await r.text());}
 async function archive(id,sessionId=randomUUID()){const r=await complete.POST(request({sessionId,itemIds:[id]}));assert.equal(r.status,200,await r.text());return sessionId;}
 const id=await add('Filé de frango','1','kg');await buy(id,'20','1');const session=await archive(id);await archive(id,session);
 const id2=await add('Filé de frango','1,6','kg');let data=await (await items.GET()).json();assert.equal(data.items[0].previousUnitPrice,20);
 await buy(id2,'30,40','1.6','total');data=await (await items.GET()).json();assert.equal(data.items[0].unitPrice,19);assert.equal(data.items[0].previousUnitPrice,20);await archive(id2);
 const hist=(await db.query('SELECT * FROM purchase_items ORDER BY purchased_at')).rows;assert.equal(Number(hist[1].total_price),30.4);assert.equal(Number(hist[1].quantity),1.6);assert.equal(hist[1].price_basis,'kg');
 const grams=await add('Filé de frango','600','g');data=await (await items.GET()).json();assert.equal(data.items[0].previousUnitPrice,19);await buy(grams,'18','600');await archive(grams);assert.equal(Number((await db.query('SELECT total_price FROM purchase_items WHERE id=$1',[grams])).rows[0].total_price),10.8);
 const cents=await add('Teste precisão','9999','g');await buy(cents,'0,01','9999','total');await archive(cents);assert.equal(Number((await db.query('SELECT total_price FROM purchase_items WHERE id=$1',[cents])).rows[0].total_price),.01);
 const carton=await add('Filé de frango','2','pacote');data=await (await items.GET()).json();assert.equal(data.items[0].previousUnitPrice,null);
 const unspecified=randomUUID();assert.equal((await items.POST(request({id:unspecified,name:'Produto sem peso',measurementVersion:2}))).status,201);
 await buy(unspecified,'12','1','total');let withoutMeasure=(await (await items.GET()).json()).items.find(x=>x.id===unspecified);assert.equal(withoutMeasure.unit,'item');assert.equal(withoutMeasure.priceBasis,null);assert.equal(withoutMeasure.totalPrice,12);await archive(unspecified);
 const invalid=await items.POST(request({name:'Ovo',quantity:'1.5',unit:'un'}));assert.equal(invalid.status,400);
 const invalidUnit=await items.POST(request({name:'Ovo',quantity:'1',unit:'invalid'}));assert.equal(invalidUnit.status,400);
 const alternative=await add('Aveia ou granola','250','g');const ambiguity=await items.PATCH(request({id:alternative,completed:true,unitPrice:'10',measurementVersion:2}));assert.equal(ambiguity.status,400);
 const oldClient=await items.PATCH(request({id:carton,completed:true,unitPrice:'5'}));assert.equal(oldClient.status,409);
 currentUser={id:U,familyId:F2,collectPricesOnPurchase:true};assert.equal((await items.PATCH(request({id:carton,completed:true,measurementVersion:2}))).status,404);assert.equal((await (await items.GET()).json()).items.length,0);currentUser.familyId=F;
 // Entire archival rolls back if a later item is invalid.
 const good=await add('Bom','1','un'),bad=await add('Inválido','1','un');await buy(good,'1','1');await buy(bad,'2','1');await db.query('UPDATE shopping_items SET quantity=$1 WHERE id=$2',['invalid',bad]);
 const failed=await complete.POST(request({sessionId:randomUUID(),itemIds:[good,bad]}));assert.equal(failed.status,500);assert.equal((await db.query('SELECT * FROM shopping_items WHERE id=ANY($1::uuid[])',[[good,bad]])).rows.length,2);assert.equal((await db.query('SELECT * FROM purchase_items WHERE id=$1',[good])).rows.length,0);
 await db.query('DELETE FROM shopping_items WHERE id=ANY($1::uuid[])',[[good,bad,carton,alternative]]);
 // Repair uses real original importer IDs, and is idempotent.
 const original=path.join(__dirname,"fixtures/week-a.sql");
 if(original){await db.exec(fs.readFileSync(original,'utf8'));
 const repair=fs.readFileSync(root+'/database/migrations/010_repair_week_a.sql','utf8');await db.exec(repair);
 assert.equal((await db.query("SELECT count(*) FROM shopping_items WHERE measurement_version=1")).rows[0].count,48);
 await db.exec(repair.replace('v_aplicar boolean := false','v_aplicar boolean := true'));await db.exec(repair.replace('v_aplicar boolean := false','v_aplicar boolean := true'));
 const repaired=(await db.query('SELECT * FROM shopping_items')).rows;assert.equal(repaired.length,48);assert(repaired.every(r=>r.measurement_version===2&&!r.name.includes(' — ')));
 const chicken=repaired.find(r=>r.name==='Filé de frango');assert.equal(chicken.quantity,'1.6');assert.equal(chicken.unit,'kg');assert.equal(chicken.product_id,hist[0].product_id);
 }
 const measures=load('lib/measures');assert.equal(measures.measuredTotal(19,'1600','g','kg'),30.4);assert.equal(measures.parseQuantity('1,6','kg'),'1.6');assert.equal(measures.parseQuantity('0','kg'),null);
 console.log('PASS: API + SQL: decimais, g/kg, total exato, histórico, repetição, unidades incompatíveis, família isolada, cliente antigo, rollback atômico, prévia e reparo da Semana A.');await db.close();
})().catch(e=>{console.error(e);process.exit(1)});
