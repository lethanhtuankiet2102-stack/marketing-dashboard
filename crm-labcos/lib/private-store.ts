import { get, put } from '@vercel/blob';

export async function readPrivate<T>(path:string,fallback:T):Promise<T> {
  const result=await get(path,{access:'private',useCache:false});
  if (!result||result.statusCode!==200) return fallback;
  return JSON.parse(await new Response(result.stream).text()) as T;
}
export async function writePrivate<T>(path:string,value:T):Promise<void> {
  const existing=await get(path,{access:'private',useCache:false});
  await put(path,JSON.stringify(value),{
    access:'private',addRandomSuffix:false,contentType:'application/json',
    ...(existing?.statusCode===200?{allowOverwrite:true,ifMatch:existing.blob.etag.replace(/^W\//,'')}:{}),
  });
}

export async function updatePrivate<T>(path:string,update:(value:T)=>T):Promise<T>{
  const existing=await get(path,{access:'private',useCache:false});
  if(!existing||existing.statusCode!==200)throw new Error('NOT_FOUND');
  const value=update(JSON.parse(await new Response(existing.stream).text()) as T);
  await put(path,JSON.stringify(value),{access:'private',addRandomSuffix:false,contentType:'application/json',allowOverwrite:true,ifMatch:existing.blob.etag.replace(/^W\//,'')});
  return value;
}
