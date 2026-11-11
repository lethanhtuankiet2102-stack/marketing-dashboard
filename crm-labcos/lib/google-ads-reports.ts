import {googleGet} from './google-source';
import {readPrivate,writePrivate} from './private-store';
export const sources:Record<string,string>={'2026-07':'1Ty2IgpheFoQmgcvApFFmKy3IM3FSFIhn','2026-08':'1rqSPizX300tzuZkD9G1yQRosUqzcJPJR','2026-09':'1sReRZl5jxL-5zWG7RJZUOaz6AuiCUD4c'};
export async function googleAdsReport(month:string,refresh=false){
 const fileId=sources[month];if(!fileId)throw new Error('UNKNOWN_MONTH');
 const htmlPath=`labcos/google-ads-${month}.json`,metaPath=`labcos/google-ads-source-${month}.json`;
 const cached=await readPrivate<string|null>(htmlPath,null).catch(()=>null);
 if(!refresh){if(cached)return {html:cached,stale:false};throw new Error('SOURCE_CACHE_MISSING');}
 try{
  const response=await googleGet(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
  if(Number(response.headers.get('content-length'))>2000000)throw new Error('SOURCE_TOO_LARGE');
  const html=await response.text();
  if(html.length>2000000||!/<html\b/i.test(html)||!/<\/html\s*>/i.test(html))throw new Error('SOURCE_INVALID');
  try{await writePrivate(htmlPath,html);await writePrivate(metaPath,{fileId,syncedAt:Date.now()});}catch{/* A cache race must not hide a successfully read report. */}
  return {html,stale:false};
 }catch(error){if(cached)return {html:cached,stale:true};throw error;}
}

