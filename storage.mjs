// IndexedDB adapter. A request succeeding is not a committed write.
export function openDatabase() {
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open('witch-friends-collection',1);
  req.onupgradeneeded=()=>req.result.createObjectStore('friends',{keyPath:'id'});
  req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close(); resolve(req.result);};
  req.onerror=()=>reject(req.error);
  req.onblocked=()=>reject(Error('別のタブを閉じて、再読み込みしてください。'));
 });
}
export async function allRecords(db) {
 const tx=db.transaction('friends','readonly'), done=transactionDone(tx);
 const req=tx.objectStore('friends').getAll();
 await done; return req.result;
}
export async function putRecord(db,record) {
 const tx=db.transaction('friends','readwrite'), done=transactionDone(tx);
 tx.objectStore('friends').put(record); await done;
}
export async function deleteRecord(db,id) {
 const tx=db.transaction('friends','readwrite'), done=transactionDone(tx);
 tx.objectStore('friends').delete(id); await done;
}
// Validation occurs before starting this transaction. The read + additions share
// one serialized transaction, so another tab cannot lose a concurrent record.
export async function importRecords(db,incoming) {
 const tx=db.transaction('friends','readwrite'), done=transactionDone(tx);
 const store=tx.objectStore('friends'), req=store.getAll(); let added=0;
 req.onsuccess=()=>{
  const ids=new Set(req.result.map(r=>r.id));
  for(const r of incoming) if(!ids.has(r.id)){store.add(r); added++;}
 };
 await done; return added;
}
export function transactionDone(tx) {
 return new Promise((resolve,reject)=>{
  tx.oncomplete=()=>resolve();
  tx.onabort=()=>reject(tx.error || Error('保存処理が中断されました。'));
  tx.onerror=()=>{}; // onabort is the final failure signal
 });
}
