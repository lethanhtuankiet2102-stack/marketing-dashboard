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
    ...(existing?.statusCode===200?{ifMatch:existing.blob.etag}:{}),
  });
}
