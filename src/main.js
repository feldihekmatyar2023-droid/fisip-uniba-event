import { supabase } from "./supabase.js";
import "./style.css";

const app = document.querySelector("#app");
let session = null,
  profile = null,
  events = [],
  filter = "Semua",
  month = new Date();

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[
        c
      ])
  );
const fmt = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
const isAdmin = () =>
  profile?.role === "admin" || profile?.role === "super_admin";

async function boot() {
  const {
    data: { session: s },
  } = await supabase.auth.getSession();
  session = s;
  if (session) {
    const r = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    profile = r.data;
  }
  await loadEvents();
  render();
  supabase.auth.onAuthStateChange(async (_, s) => {
    session = s;
    if (s) {
      const r = await supabase
        .from("profiles")
        .select("*")
        .eq("id", s.user.id)
        .single();
      profile = r.data;
    } else profile = null;
    render();
  });
}
async function loadEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (!error) events = data || [];
}
async function login() {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: location.origin },
  });
}
async function logout() {
  await supabase.auth.signOut();
}
function nav() {
  return `<header><div><b>FISIP EVENT</b><small>Fakultas Ilmu Sosial dan Ilmu Politik</small></div><div>${ session ? `<button class="light" id="profile">${esc( profile?.full_name || session.user.email )}</button><button class="light" id="logout">Keluar</button>` : `<button class="light" id="login">🔵 Login Google</button>` }</div></header>`;
}
function eventCard(e, admin = false) {
  return `<article class="event"><span class="badge ${ e.category === "Akademik" ? "a" : "n" }">${e.category}</span><h3>${esc(e.title)}</h3><p>📅 ${fmt( e.event_date )} · 🕘 ${esc((e.start_time || "").slice(0, 5))}${ e.end_time ? "–" + e.end_time.slice(0, 5) : "" }<br>📍 ${esc(e.location || "-")}<br>👥 ${esc(e.organizer || "-")}</p>${ e.poster_path ? `<img class="poster" src="${esc(e.poster_path)}">` : "" }<div class="actions"><button data-detail="${e.id}">Detail</button>${ session ? `<button data-save="${e.id}">⭐ Simpan</button>` : "" }${ admin ? `<button data-edit="${e.id}">Edit</button><button class="danger" data-delete="${e.id}">Hapus</button>` : "" }</div></article>`;
}
function calendar() {
  const y = month.getFullYear(),
    m = month.getMonth(),
    first = new Date(y, m, 1),
    offset = (first.getDay() + 6) % 7,
    days = new Date(y, m + 1, 0).getDate();
  let cells = "";
  for (let i = 0; i < 42; i++) {
    const n = i - offset + 1,
      d = new Date(y, m, n),
      iso = d.toISOString().slice(0, 10),
      inm = n >= 1 && n <= days,
      ev = events.filter(
        (e) => e.event_date === iso && e.status === "published"
      );
    cells += `<div class="day ${inm ? "" : "muted"}"><b>${d.getDate()}</b>${ev .slice(0, 3) .map((e) => `<i class="${e.category === "Akademik" ? "a" : "n"}"></i>`) .join("")}</div>`;
  }
  return `<div class="calhead"><button id="prev">‹</button><b>${month.toLocaleDateString( "id-ID", { month: "long", year: "numeric" } )}</b><button id="next">›</button></div><div class="week">${[ "Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min", ] .map((x) => `<span>${x}</span>`) .join("")}</div><div class="days">${cells}</div>`;
}
function render() {
  const pub = events.filter(
    (e) =>
      e.status === "published" && (filter === "Semua" || e.category === filter)
  );
  app.innerHTML = `${nav()}<main><section class="hero"><h1>Agenda FISIP</h1><p>Semua kegiatan akademik dan non-akademik dalam satu tempat.</p></section><div class="tabs">${[ "Semua", "Akademik", "Non-Akademik", ] .map( (x) => `<button class="${ filter === x ? "active" : "" }" data-filter="${x}">${x}</button>` ) .join( "" )}</div><div class="grid"><section class="card">${calendar()}</section><section class="card"><h2>Event Mendatang</h2>${ pub.length ? pub .slice(0, 10) .map((e) => eventCard(e, isAdmin())) .join("") : '<p class="empty">Belum ada event.</p>' }</section></div>${ isAdmin() ? `<section class="card admin"><div class="row"><h2>Admin</h2><button class="primary" id="add">+ Tambah Event</button></div><p>Role: <b>${profile.role}</b></p></section>` : "" }</main>`;
  bind();
}
function bind() {
  document.querySelector("#login")?.addEventListener("click", login);
  document.querySelector("#logout")?.addEventListener("click", logout);
  document.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        filter = b.dataset.filter;
        render();
      })
  );
  document.querySelector("#prev")?.addEventListener("click", () => {
    month.setMonth(month.getMonth() - 1);
    render();
  });
  document.querySelector("#next")?.addEventListener("click", () => {
    month.setMonth(month.getMonth() + 1);
    render();
  });
  document.querySelector("#add")?.addEventListener("click", () => form());
  document
    .querySelectorAll("[data-detail]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          detail(events.find((e) => e.id === b.dataset.detail)))
    );
  document
    .querySelectorAll("[data-edit]")
    .forEach(
      (b) =>
        (b.onclick = () => form(events.find((e) => e.id === b.dataset.edit)))
    );
  document.querySelectorAll("[data-delete]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (confirm("Hapus event?")) {
          await supabase.from("events").delete().eq("id", b.dataset.delete);
          await loadEvents();
          render();
        }
      })
  );
  document
    .querySelectorAll("[data-save]")
    .forEach((b) => (b.onclick = () => saveEvent(b.dataset.save)));
}
async function saveEvent(id) {
  const { error } = await supabase
    .from("saved_events")
    .upsert({ user_id: session.user.id, event_id: id });
  alert(error ? error.message : "Event disimpan.");
}
function detail(e) {
  alert(
    `${e.title}\n\n${fmt(e.event_date)} ${e.start_time || ""}\n${ e.location || "" }\n\n${e.description || ""}`
  );
}
function form(e = {}) {
  const wrap = document.createElement("div");
  wrap.className = "modal";
  wrap.innerHTML = `<div class="modalbox"><button id="x">✕</button><h2>${ e.id ? "Edit" : "Tambah" } Event</h2><label>Judul<input id="t" value="${esc( e.title || "" )}"></label><label>Kategori<select id="c"><option ${ e.category === "Akademik" ? "selected" : "" }>Akademik</option><option ${ e.category === "Non-Akademik" ? "selected" : "" }>Non-Akademik</option></select></label><label>Tanggal<input id="d" type="date" value="${ e.event_date || "" }"></label><label>Mulai<input id="s" type="time" value="${( e.start_time || "" ).slice(0, 5)}"></label><label>Selesai<input id="en" type="time" value="${( e.end_time || "" ).slice(0, 5)}"></label><label>Lokasi<input id="l" value="${esc( e.location || "" )}"></label><label>Penyelenggara<input id="o" value="${esc( e.organizer || "FISIP" )}"></label><label>Deskripsi<textarea id="desc">${esc( e.description || "" )}</textarea></label><label>Poster<input id="poster" type="file" accept="image/*"></label><label>Link pendaftaran<input id="url" value="${esc( e.registration_url || "" )}"></label><button class="primary" id="save">Simpan & Publikasikan</button></div>`;
  document.body.append(wrap);
  wrap.querySelector("#x").onclick = () => wrap.remove();
  wrap.querySelector("#save").onclick = async () => {
    const f = wrap.querySelector("#poster").files[0];
    let poster = e.poster_path || null;
    if (f) {
      const path = `${session.user.id}/${crypto.randomUUID()}-${f.name}`;
      const up = await supabase.storage
        .from("event-posters")
        .upload(path, f, { upsert: true });
      if (up.error) {
        alert(up.error.message);
        return;
      }
      poster = supabase.storage.from("event-posters").getPublicUrl(path)
        .data.publicUrl;
    }
    const row = {
      title: wrap.querySelector("#t").value,
      category: wrap.querySelector("#c").value,
      event_date: wrap.querySelector("#d").value,
      start_time: wrap.querySelector("#s").value || null,
      end_time: wrap.querySelector("#en").value || null,
      location: wrap.querySelector("#l").value,
      organizer: wrap.querySelector("#o").value,
      description: wrap.querySelector("#desc").value,
      registration_url: wrap.querySelector("#url").value || null,
      poster_path: poster,
      status: "published",
      created_by: session.user.id,
    };
    const q = e.id
      ? supabase.from("events").update(row).eq("id", e.id)
      : supabase.from("events").insert(row);
    const r = await q;
    if (r.error) alert(r.error.message);
    else {
      wrap.remove();
      await loadEvents();
      render();
    }
  };
}
boot();
