import {makeRecord,backup,parseBackup} from './core.mjs';
import {openDatabase,allRecords,putRecord,deleteRecord,importRecords} from './storage.mjs';
const $=id=>document.getElementById(id);
let db, records=[], selected=null, editing=null, draftPhoto='', busy=false, photoBusy=false, photoInvalid=false, photoToken=0, returnFocus=null;
const status=(message)=>{$('status').textContent=message;};
const problem=e=>e?.message || '処理できませんでした。';
function lock(value){
 busy=value;
 for(const id of ['add','export','import','edit','delete','confirm-delete','keep','save']) $(id).disabled=value;
 $('editor-fields').disabled=value;
}
function showDialog(dialog){returnFocus=document.activeElement;dialog.showModal();}
function closeEditor(){
 if(busy)return;
 photoToken++;photoBusy=false;photoInvalid=false;
 $('editor').close();returnFocus?.focus();
}
function picture(photo,name){
 if(photo){const image=document.createElement('img');image.src=photo;image.alt=name;return image;}
 const blank=document.createElement('div');blank.className='placeholder';blank.textContent='✧';blank.setAttribute('aria-hidden','true');return blank;
}
function render(){
 const q=$('search').value.trim().toLocaleLowerCase('ja');
 const visible=records.filter(r=>r.name.toLocaleLowerCase('ja').includes(q));
 $('grid').replaceChildren();
 for(const r of visible){
  const card=document.createElement('button');card.className='card';card.type='button';
  card.setAttribute('aria-label',r.name+'の詳細');
  card.append(picture(r.photo,''));const title=document.createElement('h2');title.textContent=r.name;
  const memo=document.createElement('p');memo.textContent=r.memo || 'メモはまだ白紙です';card.append(title,memo);
  card.onclick=()=>{if(!busy)openDetail(r.id);};$('grid').append(card);
 }
 $('empty').hidden=visible.length>0;
 if(!records.length) $('empty').textContent='✧\nまだ白紙のアルバムです。好きなときに、ひとりずつ。';
 else if(!visible.length) $('empty').textContent='その名前のお友達は見つかりませんでした。';
}
function openDetail(id){
 selected=id;const r=records.find(r=>r.id===id);if(!r)return;
 $('detail-name').textContent=r.name;$('detail-memo').textContent=r.memo || 'メモはまだ白紙です。';
 $('detail-photo').replaceChildren(picture(r.photo,r.name));showDialog($('detail'));
}
function openEditor(record=null){
 editing=record;draftPhoto=record?.photo || '';photoInvalid=false;photoBusy=false;photoToken++;$('save').disabled=false;
 $('record-form').reset();$('name').value=record?.name || '';$('memo').value=record?.memo || '';
 $('editor-title').textContent=record?'お友達のページを編集':'お友達を迎える';$('editor-status').textContent='';
 updatePreview();showDialog($('editor'));$('name').focus();
}
function updatePreview(){ $('preview').hidden=!draftPhoto;if(draftPhoto)$('preview').src=draftPhoto;else $('preview').removeAttribute('src'); }
function loadImage(url){return new Promise((resolve,reject)=>{
 const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('この写真は開けません。HEICなどはJPEGやPNGに変換して選び直してください。'));image.src=url;
});}
async function preparePhoto(file){
 if(file.size>40*1024*1024)throw Error('写真は40MB以下で選んでください。');
 const url=URL.createObjectURL(file);
 try{
  const image=await loadImage(url);if(!image.naturalWidth || !image.naturalHeight)throw Error('写真の大きさが読み取れません。');
  const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('写真の変換に失敗しました。');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL('image/jpeg',.86);if(!data.startsWith('data:image/jpeg;'))throw Error('JPEGに変換できませんでした。');return data;
 }finally{URL.revokeObjectURL(url);}
}
$('photo').onchange=async()=>{
 const file=$('photo').files[0];if(!file)return;
 const token=++photoToken;photoBusy=true;photoInvalid=false;$('save').disabled=true;$('editor-status').textContent='写真を小さくしています…';
 try{const photo=await preparePhoto(file);if(token!==photoToken)return;draftPhoto=photo;updatePreview();$('editor-status').textContent='写真の準備ができました。「保存する」で記録します。';}
 catch(e){if(token!==photoToken)return;photoInvalid=true;$('editor-status').textContent=problem(e)+' まだ保存していません。選び直すか「写真をはずす」を押してください。';}
 finally{if(token===photoToken){photoBusy=false;$('save').disabled=busy || photoInvalid;}}
};
$('remove-photo').onclick=()=>{photoToken++;photoBusy=false;photoInvalid=false;draftPhoto='';$('photo').value='';updatePreview();$('editor-status').textContent='写真をはずしました。まだ保存していません。';$('save').disabled=busy;};
$('add').onclick=()=>{if(!busy)openEditor();};
$('search').oninput=render;
$('cancel').onclick=closeEditor;
$('editor').addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
$('record-form').onsubmit=async e=>{
 e.preventDefault();if(busy || photoBusy || photoInvalid)return;
 lock(true);$('editor-status').textContent='保存しています…';
 try{
  if(!editing && records.length>=2000)throw Error('このアルバムは2000件までです。');
  const r=makeRecord({name:$('name').value,memo:$('memo').value,photo:draftPhoto},editing?.id || crypto.randomUUID(),new Date().toISOString(),editing);
  await putRecord(db,r);
  records=records.filter(x=>x.id!==r.id);records.push(r);render();$('editor').close();status('このブラウザに保存しました。');returnFocus?.focus();
 }catch(error){$('editor-status').textContent='保存できませんでした。入力は残しています。 '+problem(error);}
 finally{lock(false);}
};
$('close-detail').onclick=()=>{$('detail').close();returnFocus?.focus();};
$('edit').onclick=()=>{if(busy)return;const r=records.find(r=>r.id===selected);$('detail').close();openEditor(r);};
$('delete').onclick=()=>{if(busy)return;$('delete-status').textContent='';$('confirm').showModal();$('keep').focus();};
$('keep').onclick=()=>{if(!busy){$('confirm').close();$('delete').focus();}};
for(const id of ['confirm','detail']) $(id).addEventListener('cancel',e=>{if(busy)e.preventDefault();});
$('confirm-delete').onclick=async()=>{
 if(busy)return;lock(true);
 try{await deleteRecord(db,selected);records=records.filter(r=>r.id!==selected);$('confirm').close();$('detail').close();render();status('このブラウザから削除しました。');$('add').focus();}
 catch(e){$('delete-status').textContent='削除できませんでした。記録は残しています。 '+problem(e);}
 finally{lock(false);}
};
$('export').onclick=async()=>{
 if(busy)return;lock(true);
 try{
  const latest=await allRecords(db);const blob=new Blob([JSON.stringify(backup(latest),null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='witch-friends-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  status('写真入りJSONのダウンロードを開始しました。ファイルの保存完了はブラウザで確認してください。');
 }catch(e){status('書き出せませんでした。記録は変更していません。 '+problem(e));}
 finally{lock(false);}
};
$('import').onchange=async()=>{
 const file=$('import').files[0];if(!file || busy)return;lock(true);status('バックアップ全体を確認しています…');
 try{
  if(file.size>150*1024*1024)throw Error('読み込めるJSONは150MB以下です。');
  const incoming=parseBackup(await file.text());
  for(const r of incoming)if(r.photo){const image=await loadImage(r.photo);if(Math.max(image.naturalWidth,image.naturalHeight)>1600)throw Error('写真が1600pxを超えています。');}
  const added=await importRecords(db,incoming);
  try{records=await allRecords(db);render();status(`${added}件を追加しました。同じIDの記録は変更していません。`);}
  catch(e){status(`${added}件の追加は保存済みですが、一覧を更新できませんでした。再読み込みしてください。 `+problem(e));}
 }catch(e){status('読み込みを完了できませんでした。 '+problem(e));}
 finally{lock(false);$('import').value='';}
};
try{db=await openDatabase();records=await allRecords(db);render();lock(false);status('このブラウザのアルバムです。');}
catch(e){status('アルバムを開けませんでした。再読み込みをお試しください。 '+problem(e));}
