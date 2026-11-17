// После публикации Worker вставьте сюда его адрес workers.dev без завершающего слэша.
const API_BASE = "https://YOUR-WORKER.workers.dev";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const albumSlug = params.get("album");

function apiReady() {
  return !API_BASE.includes("YOUR-WORKER");
}
function showStatus(id, message, error=false) {
  const el = $(id); el.textContent = message; el.style.color = error ? "#a33" : "#58745b";
}
function albumUrl(slug) {
  const u = new URL(location.href); u.search = ""; u.searchParams.set("album", slug); return u.toString();
}
async function request(path, options={}) {
  if (!apiReady()) throw new Error("Сначала укажите адрес Cloudflare Worker в файле app.js.");
  const response = await fetch(API_BASE + path, options);
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error || "Не удалось выполнить запрос.");
  return data;
}

$("create-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  showStatus("create-status","Создаём альбом…");
  try {
    const data = await request("/api/admin/albums", {
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+$("admin-key").value},
      body:JSON.stringify({title:$("event-title").value.trim(),eventDate:$("event-date").value})
    });
    const url = albumUrl(data.slug);
    $("created-title").textContent = data.title;
    $("share-url").value = url;
    $("qr-image").src = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data="+encodeURIComponent(url);
    $("open-album").href = url;
    $("created-album").classList.remove("hidden");
    showStatus("create-status","Готово! Сохраните ссылку и QR-код.");
  } catch(err) { showStatus("create-status",err.message,true); }
});

$("copy-link").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("share-url").value); $("copy-link").textContent="Скопировано!"; }
  catch { $("share-url").select(); document.execCommand("copy"); $("copy-link").textContent="Скопировано!"; }
});

async function loadGallery() {
  if (!albumSlug) return;
  $("album-section").classList.remove("hidden");
  try {
    const data = await request("/api/albums/"+encodeURIComponent(albumSlug));
    $("album-heading").textContent = data.title;
    $("album-subtitle").textContent = data.eventDate ? "Дата события: "+data.eventDate : "Фотографии гостей";
    const photos = await request("/api/albums/"+encodeURIComponent(albumSlug)+"/photos");
    $("gallery").innerHTML = "";
    $("gallery-empty").classList.toggle("hidden", photos.photos.length > 0);
    for (const photo of photos.photos) {
      const img = document.createElement("img");
      img.src = API_BASE + photo.url; img.alt = "Фотография гостей"; img.loading = "lazy";
      $("gallery").appendChild(img);
    }
  } catch(err) { $("album-heading").textContent = "Не удалось открыть альбом"; $("album-subtitle").textContent = err.message; }
}
$("refresh-gallery").addEventListener("click", loadGallery);
$("photo-input").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length || !albumSlug) return;
  let done = 0;
  for (const file of files) {
    showStatus("upload-status",`Загружаем ${done+1} из ${files.length}…`);
    const form = new FormData(); form.append("photo",file);
    try { await request("/api/albums/"+encodeURIComponent(albumSlug)+"/photos",{method:"POST",body:form}); done++; }
    catch(err) { showStatus("upload-status",err.message,true); e.target.value=""; return; }
  }
  showStatus("upload-status",`Загружено фотографий: ${done}`);
  e.target.value=""; loadGallery();
});
if (albumSlug) loadGallery();
