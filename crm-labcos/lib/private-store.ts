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

// Keep the read and conditional write in one transaction; retry storage races only.
export async function transactPrivate<T>(path:string,fallback:T,update:(value:T)=>T):Promise<T>{
  for(let attempt=0;attempt<5;attempt++){
    const existing=await get(path,{access:'private',useCache:false});
    const present=existing?.statusCode===200;
    const value=update(present?JSON.parse(await new Response(existing.stream).text()):structuredClone(fallback));
    try{
      await put(path,JSON.stringify(value),{access:'private',addRandomSuffix:false,contentType:'application/json',...(present?{allowOverwrite:true,ifMatch:existing.blob.etag.replace(/^W\//,'')}:{allowOverwrite:false})});
      return value;
    }catch(error){
      if(error instanceof Error&&error.name==='BlobPreconditionFailedError')continue;
      if(!present&&(await get(path,{access:'private',useCache:false}))?.statusCode===200)continue;
      throw error;
    }
  }
  throw new Error('CONFLICT');
}
