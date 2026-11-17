const JSON_HEADERS = {"Content-Type":"application/json; charset=utf-8"};
const cors = {
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Methods":"GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":"Content-Type,Authorization"
};
const json = (data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...cors}});
const fail = (message,status=400)=>json({error:message},status);
const extFor = type => ({ "image/jpeg":"jpg","image/png":"png","image/webp":"webp" }[type]);

export default {
 async fetch(request,env) {
  const url = new URL(request.url);
  if (request.method==="OPTIONS") return new Response(null,{headers:cors});
  try {
   if (url.pathname==="/api/admin/albums" && request.method==="POST") {
    if (!isAdmin(request,env)) return fail("Неверный ключ администратора.",401);
    const body=await request.json();
    const title=String(body.title||"").trim().slice(0,80);
    if (!title) return fail("Укажите название события.");
    const slug=crypto.randomUUID().replaceAll("-","").slice(0,12);
    const eventDate=String(body.eventDate||"").slice(0,10);
    await env.DB.prepare("INSERT INTO albums (slug,title,event_date,created_at) VALUES (?,?,?,?)")
      .bind(slug,title,eventDate,Date.now()).run();
    return json({slug,title,eventDate});
   }
   const mediaMatch=url.pathname.match(/^\/media\/([a-f0-9-]+)$/i);
   if (mediaMatch && request.method==="GET") {
    const photo=await env.DB.prepare("SELECT object_key,mime_type FROM photos WHERE id=? AND approved=1").bind(mediaMatch[1]).first();
    if (!photo) return fail("Фотография не найдена.",404);
    const object=await env.PHOTOS_BUCKET.get(photo.object_key);
    if (!object) return fail("Файл не найден.",404);
    return new Response(object.body,{headers:{...cors,"Content-Type":photo.mime_type,"Cache-Control":"public, max-age=3600"}});
   }
   const albumMatch=url.pathname.match(/^\/api\/albums\/([a-f0-9]+)(?:\/(photos))?$/i);
   if (!albumMatch) return fail("Маршрут не найден.",404);
   const slug=albumMatch[1], isPhotos=!!albumMatch[2];
   const album=await env.DB.prepare("SELECT slug,title,event_date FROM albums WHERE slug=?").bind(slug).first();
   if (!album) return fail("Альбом не найден.",404);
   if (!isPhotos && request.method==="GET") return json({slug:album.slug,title:album.title,eventDate:album.event_date});
   if (isPhotos && request.method==="GET") {
    const result=await env.DB.prepare("SELECT id,uploaded_at FROM photos WHERE album_slug=? AND approved=1 ORDER BY uploaded_at DESC LIMIT 300").bind(slug).all();
    return json({photos:(result.results||[]).map(p=>({id:p.id,uploadedAt:p.uploaded_at,url:"/media/"+p.id}))});
   }
   if (isPhotos && request.method==="POST") {
    const form=await request.formData(), file=form.get("photo");
    if (!(file instanceof File)) return fail("Выберите фотографию.");
    const ext=extFor(file.type);
    if (!ext) return fail("Поддерживаются JPG, PNG и WebP.");
    if (file.size>10*1024*1024) return fail("Размер фотографии не должен превышать 10 МБ.");
    const id=crypto.randomUUID(), key=`${slug}/${id}.${ext}`;
    await env.PHOTOS_BUCKET.put(key,file.stream(),{httpMetadata:{contentType:file.type}});
    try {
     await env.DB.prepare("INSERT INTO photos (id,album_slug,object_key,original_name,mime_type,size,uploaded_at,approved) VALUES (?,?,?,?,?,?,?,1)")
      .bind(id,slug,key,String(file.name||"photo").slice(0,180),file.type,file.size,Date.now()).run();
    } catch(err) { await env.PHOTOS_BUCKET.delete(key); throw err; }
    return json({ok:true,id},201);
   }
   return fail("Метод не поддерживается.",405);
  } catch(err) { return fail(err.message||"Внутренняя ошибка сервера.",500); }
 }
};
function isAdmin(request,env) {
 const supplied=request.headers.get("Authorization")||"";
 return !!env.ADMIN_KEY && supplied==="Bearer "+env.ADMIN_KEY;
}
