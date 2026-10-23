const normalized=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').trim().toUpperCase().replace(/[\s-]+/g,'_');
export function designerStatusKey(value:string):string{
 const key=normalized(value);
 const aliases:Record<string,string>={GAP:'URGENT',URGENT:'URGENT',MOI:'NEW',DANG_LAM:'IN_PROGRESS',DANG_THUC_HIEN:'IN_PROGRESS',CHO_DUYET:'REVIEW',CAN_CHINH_SUA:'REVISION',HOAN_THANH:'DONE',DA_HUY:'CANCELED',CANCELLED:'CANCELED'};
 return aliases[key]||(['NEW','URGENT','IN_PROGRESS','REVIEW','REVISION','DONE','CANCELED'].includes(key)?key:value.trim());
}
export function designerStatusTone(value:string):string{
 const key=designerStatusKey(value);
 return key==='URGENT'?'urgent':key==='DONE'?'done':key==='IN_PROGRESS'?'working':key==='REVIEW'?'review':key==='REVISION'?'revision':key==='CANCELED'?'canceled':key==='NEW'?'new':'neutral';
}
export function designerTypeStyle(value:string){
 let hash=0;for(const char of normalized(value))hash=(hash*31+char.charCodeAt(0))>>>0;
 const hue=hash%360;
 return {backgroundColor:`hsl(${hue} 65% 94%)`,borderColor:`hsl(${hue} 40% 78%)`,color:`hsl(${hue} 55% 27%)`};
}
