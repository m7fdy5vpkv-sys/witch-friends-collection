// Pure collection and backup rules.
export const APP_ID='witch-friends-collection';
export function mergeRecords(local,incoming) {
 const ids=new Set(local.map(r=>r.id));
 return [...local,...incoming.filter(r=>!ids.has(r.id))];
}
export function backup(records) { return {appId:APP_ID,version:1,records}; }
export function parseBackup(text) {
 const b=JSON.parse(text), ids=new Set();
 if(!b || b.appId!==APP_ID || b.version!==1 || !Array.isArray(b.records) || b.records.length>2000) throw Error('このアプリの形式（バージョン1）ではありません。');
 return b.records.map(r=>{
  if(!r || typeof r.id!=='string' || !/^[\w-]{1,100}$/.test(r.id) || ids.has(r.id) || typeof r.name!=='string' || !r.name.trim() || r.name.length>200 || typeof r.memo!=='string' || r.memo.length>100000 || typeof r.photo!=='string' || r.photo.length>8000000 || (r.photo!=='' && !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(r.photo)) || ![r.createdAt,r.updatedAt].every(t=>typeof t==='string' && /^\d{4}-\d\d-\d\dT/.test(t) && Number.isFinite(Date.parse(t)))) throw Error('バックアップに不正な記録があります。何も変更していません。');
  ids.add(r.id);
  return {id:r.id,name:r.name,memo:r.memo,photo:r.photo,createdAt:r.createdAt,updatedAt:r.updatedAt};
 });
}
export function makeRecord(input, id, now, previous) {
 return {id, name: input.name.trim() || '名前のないお友達', memo: input.memo, photo: input.photo,
 createdAt: previous?.createdAt || now, updatedAt: now};
}
