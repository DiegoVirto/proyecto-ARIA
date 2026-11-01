/* ============================================================================
   ARIA, mi escritorio: script.js
   INDICE DE BLOQUES
    1 Nucleo: helpers, constantes y estado S (localStorage)
    2 Escritorio flotante: DW, sz, layout
    3 Estado temporal de interfaz (ui)
    4 Etiquetas compartidas (effort, picker)
    5 Widget Calendario
    6 Widget Grafico personal (metas)
    7 Widget Reloj
    8 Widget Calificaciones
    9 Post-its flotantes
   10 Widget Tablero Kanban
   11 Biblioteca visual (sidebar) y visor de texto
   12 PDFs (IndexedDB + PDF.js)
   13 Lobby: WIDGETS, render, sync
   14 Eventos globales (tabla de acciones A, clic y change)
   15 Mover y redimensionar widgets
   16 Arranque

   COMO QUITAR UN WIDGET: borra su bloque aqui, su linea en WIDGETS (bloque 13),
   sus acciones en la tabla A (bloque 14) y su bloque en styles.css.
   (Si quitas la Biblioteca, quita tambien PDFs y el widget "doc".)
   ============================================================================ */

/* ==========================================================================
   BLOQUE 1: NUCLEO: helpers, constantes y estado guardado (S)
   Helpers: $ (querySelector), esc (escapa HTML), fechas como texto YYYY-MM-DD (iso, fromIso, addD, mon, diff, fmt).
   Estado S: se carga/guarda en localStorage (clave "aria:v1") con save(). Todo campo nuevo de S necesita valor por defecto aqui.
   Depende de: nada. Lo usan todos los demas bloques.
   ========================================================================== */
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
const iso = (d) =>
  d.getFullYear() +
  "-" +
  String(d.getMonth() + 1).padStart(2, "0") +
  "-" +
  String(d.getDate()).padStart(2, "0");
const fromIso = (s) => {
  const [a, b, c] = s.split("-").map(Number);
  return new Date(a, b - 1, c);
};
const addD = (s, n) => {
  const d = fromIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const mon = (s) => addD(s, -((fromIso(s).getDay() + 6) % 7));
const diff = (a, b) => Math.round((fromIso(a) - fromIso(b)) / 864e5);
const fmt = (d) => d.slice(8) + "/" + d.slice(5, 7);
const TODAY = iso(new Date()),
  DL = ["L", "M", "X", "J", "V", "S", "D"];
const MES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const BASE = 2,
  INS = { baja: 0.7, media: 1, alta: 1.5 }; // BASE: días de preparación con esfuerzo normal (x1)
const ML = {
  horas: ["h", "Horas trabajadas"],
  dias: ["días", "Días cumplidos"],
  veces: ["veces", "Veces por día"],
};
let S;
try {
  S = JSON.parse(localStorage.getItem("aria:v1"));
} catch (e) {}
S = S || {
  open: ["cal", "goals", "clock"],
  tags: [
    { id: "t1", g: "Tipo de evento", n: "Examen", p: 100 },
    { id: "t2", g: "Tipo de evento", n: "Trabajo", p: 30 },
    { id: "t3", g: "Asignaturas", n: "Física", p: 40 },
  ],
  events: [],
  goals: [],
  log: {},
};
const save = () => {
  try {
    localStorage.setItem("aria:v1", JSON.stringify(S));
  } catch (e) {}
};
S.size = S.size || {};
S.pos = S.pos || {};
S.zo = S.zo || [];
S.clk = S.clk || {
  mode: "hora",
  sw: { acc: 0, t0: null, done: false },
  pm: { st: "setup", sMin: 25, rMin: 5, ph: "s", p0: 0, sMs: 0 },
};
/* ==========================================================================
   BLOQUE 2: ESCRITORIO FLOTANTE: posicion, tamano y apilado de widgets
   DW() = ancho util del escritorio. sz(widget) = estilo (left, top, ancho, alto, z-index). layout() coloca en filas los widgets sin posicion.
   Datos: S.pos {id:{x,y}}, S.size {id:{w,h}}, S.zo (orden de apilado; el ultimo va delante).
   Lo usan: render (bloque 13), PDFs (12) y mover/redimensionar (15).
   ========================================================================== */
const DW = () => $("#desk").clientWidth || innerWidth;
// Widgets flotantes: posición S.pos, tamaño S.size {w,h}, orden de apilado S.zo (el último va delante; los post-its siempre por encima)
const sz = (w) => {
  const z = S.size[w.id] || {},
    wd = Math.min(z.w || w.w, DW() - 36),
    p = S.pos[w.id] || { x: 18, y: 10 };
  if (!S.zo.includes(w.id)) S.zo.push(w.id);
  return `left:${Math.max(0, Math.min(p.x, DW() - wd - 18))}px;top:${p.y}px;width:${wd}px;${z.h ? "height:" + z.h + "px;" : ""}z-index:${S.zo.indexOf(w.id) + 1}`;
};
// Coloca en filas los widgets sin posición (midiendo su alto real) y ajusta la altura del escritorio
function layout() {
  const dk = $("#desk"),
    ws = [...document.querySelectorAll(".w")],
    W = dk.clientWidth,
    todo = ws.filter((w) => !S.pos[w.dataset.id]);
  if (todo.length) {
    let x = 18,
      y = Math.max(
        10,
        ...ws.filter((w) => S.pos[w.dataset.id]).map((w) => S.pos[w.dataset.id].y + w.offsetHeight + 20),
      ),
      rh = 0;
    todo.forEach((w) => {
      const wd = w.offsetWidth,
        h = w.offsetHeight;
      if (x > 18 && x + wd > W) {
        x = 18;
        y += rh + 20;
        rh = 0;
      }
      S.pos[w.dataset.id] = { x, y };
      w.style.left = x + "px";
      w.style.top = y + "px";
      x += wd + 20;
      rh = Math.max(rh, h);
    });
    save();
  }
  dk.style.height = Math.max(0, ...ws.map((w) => parseFloat(w.style.top) + w.offsetHeight)) + 30 + "px";
}
/* ==========================================================================
   BLOQUE 3: ESTADO TEMPORAL DE INTERFAZ (ui)
   Valores que NO se guardan (mes visible, formularios abiertos, semana y dia seleccionados...). Otros bloques anaden mas campos a ui.
   ========================================================================== */
const ui = {
  month: TODAY.slice(0, 7),
  form: null,
  gform: null,
  week: mon(TODAY),
  day: TODAY,
  cfg: false,
  err: "",
};
/* ==========================================================================
   BLOQUE 4: ETIQUETAS COMPARTIDAS (calendario y metas)
   S.tags [{id,g:coleccion,n:nombre,p:% de esfuerzo}]. effort(ids) = 1 + suma de % ; picker() dibuja el selector de etiquetas.
   Lo usan: calendario (5) y metas (6).
   ========================================================================== */
// Esfuerzo = 1 + suma de los % de sus etiquetas (Examen +100% y Física +40% = x2.4)
const effort = (ids) =>
  1 + ids.reduce((a, id) => a + (S.tags.find((t) => t.id === id) || { p: 0 }).p / 100, 0);
const tagNames = (ids) =>
  ids
    .map((id) => S.tags.find((t) => t.id === id))
    .filter(Boolean)
    .map((t) => t.n)
    .join(", ");

function picker(sel, f) {
  const gs = [...new Set(S.tags.map((t) => t.g))].filter((g) => f !== "g" || g !== "Tipo de evento");
  return (
    gs
      .map(
        (g) =>
          `<div class="tg"><small class="mut">${esc(g)}</small>${S.tags
            .filter((t) => t.g === g)
            .map(
              (t) =>
                `<button class="chip${sel.includes(t.id) ? " on" : ""}" data-act="ftag" data-f="${f}" data-id="${t.id}">${esc(t.n)} +${t.p}%</button>`,
            )
            .join("")}</div>`,
      )
      .join("") +
    `<div class="tg"><small class="mut">Etiqueta nueva</small><input id="nt-g" list="grp" placeholder="Colección" size="10"><input id="nt-n" placeholder="Nombre" size="9"><input id="nt-p" type="number" value="30" style="width:64px">%<button data-act="newtag" data-f="${f}">＋</button></div><datalist id="grp">${gs.map((g) => `<option value="${esc(g)}">`).join("")}</datalist>`
  );
}

/* ==========================================================================
   BLOQUE 5: WIDGET CALENDARIO
   Datos: S.events [{id,start,title,emoji,color,days,ins,tags,prog}]. Funciones: cal(), evForm(), remind() (recordatorios).
   Depende de: bloque 4. Acciones en la tabla A (bloque 14): mp mn day edit emo fsave fdel.
   ========================================================================== */

function cal() {
  const [y, m] = ui.month.split("-").map(Number),
    off = (new Date(y, m - 1, 1).getDay() + 6) % 7,
    n = new Date(y, m, 0).getDate();
  let c = DL.map((x) => `<div class="dh">${x}</div>`).join("") + "<div></div>".repeat(off);
  for (let i = 1; i <= n; i++) {
    const d = iso(new Date(y, m - 1, i)),
      es = S.events.filter((e) => d >= e.start && d <= addD(e.start, e.days - 1));
    c += `<div class="dc${d === TODAY ? " td" : ""}" data-act="day" data-d="${d}"><b>${i}</b>${es.map((e) => `<span class="ev" style="--c:${e.color}" data-act="edit" data-id="${e.id}" title="${esc(e.title)}">${esc(e.emoji)}<span class="et"> ${esc(e.title)}</span></span>`).join("")}</div>`;
  }
  return (
    `<div class="row"><button data-act="mp">◀</button><b class="sp" style="text-align:center">${MES[m - 1]} ${y}</b><button data-act="mn">▶</button></div><div class="cal">${c}</div>` +
    (ui.form ? evForm() : "") +
    remind()
  );
}
function evForm() {
  const f = ui.form,
    ef = effort(f.tags),
    ld = Math.round(BASE * ef);
  return `<div class="form"><b>${f.id ? "Editar evento" : "Evento nuevo"} del ${fmt(f.start)}</b>
 <div class="row"><input id="f-e" value="${esc(f.emoji)}" maxlength="4" style="width:56px">${["📚", "📝", "🧪", "💻", "🎯", "🏋️"].map((x) => `<button data-act="emo" data-d="${x}">${x}</button>`).join("")}<input id="f-c" type="color" value="${f.color}"></div>
 <input id="f-t" placeholder="Título" value="${esc(f.title)}" style="width:100%">
 <div class="row">Días que ocupa <input id="f-d" type="number" min="1" max="60" value="${f.days}" style="width:64px"> Recordatorios <select id="f-i">${Object.keys(
   INS,
 )
   .map((o) => `<option${o === f.ins ? " selected" : ""}>${o}</option>`)
   .join("")}</select></div>
 ${picker(f.tags, "e")}
 <p class="mut">Esfuerzo x${ef.toFixed(1)}: te sugiero empezar ${ld} día${ld === 1 ? "" : "s"} antes (${fmt(addD(f.start, -ld))}).</p>
 ${ui.err ? `<p class="bad">${esc(ui.err)}</p>` : ""}
 <div class="row"><button class="p" data-act="fsave">Guardar evento</button><button data-act="fcancel">Cancelar</button>${f.id ? '<button data-act="fdel">Borrar</button>' : ""}</div></div>`;
}
function remind() {
  const L = S.events
    .map((e) => {
      const ld = Math.round(BASE * effort(e.tags)),
        w = Math.max(1, Math.ceil(ld * INS[e.ins])),
        left = diff(e.start, TODAY);
      return { e, ld, w, left };
    })
    .filter((x) => x.left >= 1 - x.e.days && x.left <= x.w && (x.e.prog || 0) < 100)
    .sort((a, b) => a.left - b.left);
  if (!L.length) return '<p class="mut">Sin recordatorios por ahora.</p>';
  return (
    "<b>🔔 Recordatorios</b>" +
    L.map(({ e, ld, w, left }) => {
      const r = left / w,
        msg =
          left <= 0
            ? "Está en curso, a por ello."
            : r > 0.66
              ? "Todavía hay margen, pero ya está en el radar."
              : r > 0.33
                ? "Toca ir avanzando."
                : "Ya casi, esto es prioridad.";
      return `<div class="rm" style="--c:${e.color}"><div>${esc(e.emoji)} <b>${esc(e.title)}</b>, ${left > 0 ? `faltan ${left} días` : "en curso"} <span class="mut">(prepararlo desde el ${fmt(addD(e.start, -ld))})</span></div><div>${msg} ¿Cómo llevas el progreso? <select data-prog="${e.id}">${[0, 25, 50, 75, 100].map((p) => `<option value="${p}"${p === (e.prog || 0) ? " selected" : ""}>${p}%</option>`).join("")}</select></div></div>`;
    }).join("")
  );
}

/* ==========================================================================
   BLOQUE 6: WIDGET GRAFICO PERSONAL (metas semanales)
   Datos: S.goals [{id,name,mode:horas|dias|veces,target,per:sem|dia,tags}] y S.log {metaId:{fecha:valor}}.
   Funciones: stat(), goals(), goalBox(), gForm(). Depende de: bloque 4. El reloj (7) escribe horas en S.log.
   ========================================================================== */

const wk = () => Array.from({ length: 7 }, (_, i) => addD(ui.week, i));
function stat(g) {
  const lg = S.log[g.id] || {},
    v = wk().map((d) => +lg[d] || 0),
    tot = g.mode === "dias" ? v.filter((x) => x > 0).length : v.reduce((a, b) => a + b, 0);
  const dia = g.mode === "horas" && g.per === "dia";
  return {
    g,
    v,
    tot,
    pct: Math.min(
      1,
      dia ? v.reduce((a, x) => a + Math.min(x, g.target), 0) / (g.target * 7) : tot / g.target,
    ),
  };
}
function goals() {
  const G = S.goals.map(stat),
    W = G.reduce((a, x) => a + effort(x.g.tags), 0),
    sc = W ? (G.reduce((a, x) => a + x.pct * effort(x.g.tags), 0) / W) * 10 : 0;
  return (
    `<div class="row"><button data-act="wp">◀</button><b class="sp" style="text-align:center">Semana del ${fmt(ui.week)}</b><button data-act="wn">▶</button></div>
 <div class="row">Día a anotar: ${wk()
   .map(
     (d, i) =>
       `<button class="${d === ui.day ? "sel" : ""}" data-act="wd" data-d="${d}">${DL[i]}${d === TODAY ? "•" : ""}</button>`,
   )
   .join("")}</div>
 <div class="score"><span>${sc.toFixed(1)}</span>/10 <small class="mut">nota de la semana, las metas con más esfuerzo pesan más</small></div>` +
    G.map(goalBox).join("") +
    (ui.gform ? gForm() : '<button class="p" data-act="gnew">＋ Nueva meta</button>')
  );
}
function goalBox({ g, v, tot, pct }) {
  const cur = +(S.log[g.id] || {})[ui.day] || 0,
    dia = g.mode === "horas" && g.per === "dia",
    mx = Math.max(...v, dia ? g.target : 0, 1),
    tn = tagNames(g.tags);
  const viz =
    g.mode === "dias"
      ? `<div class="dots">${v.map((x, i) => `<span class="dot${x > 0 ? " ok" : ""}">${x > 0 ? "✔" : DL[i]}</span>`).join("")}</div>`
      : `<div class="bars">${v.map((x, i) => `<div class="bc"><span>${x || ""}</span><i style="height:${Math.round((x / mx) * 70)}px${dia && x >= g.target ? ";background:var(--ok)" : ""}"></i><span class="mut">${DL[i]}</span></div>`).join("")}</div>`;
  const ctl =
    g.mode === "horas"
      ? `<input type="number" min="0" step="0.25" data-log="${g.id}" value="${cur}" style="width:84px"> h`
      : g.mode === "veces"
        ? `<button data-act="dec" data-id="${g.id}">−</button><b>${cur}</b><button data-act="inc" data-id="${g.id}">＋</button>`
        : `<button class="${cur > 0 ? "on" : ""}" data-act="chk" data-id="${g.id}">${cur > 0 ? "✔ Cumplida" : "Marcar como cumplida"}</button>`;
  return `<div class="goal"><div class="row"><b>${esc(g.name)}</b><span class="sp"></span><button data-act="gdel" data-id="${g.id}" title="Borrar meta">🗑</button></div>
 <small class="mut">${ML[g.mode][1]}, objetivo ${g.target} ${ML[g.mode][0]} por ${dia ? "día" : "semana"}${tn ? ", etiquetas: " + esc(tn) : ""}</small>${viz}
 <div class="row"><div class="pb"><i style="width:${pct * 100}%"></i></div><b>${Math.round(pct * 100)}%</b></div>
 <div class="row">Día ${fmt(ui.day)}: ${ctl}</div></div>`;
}
function gForm() {
  const f = ui.gform;
  return `<div class="form"><b>Meta nueva</b><input id="g-n" placeholder="Nombre, por ejemplo Estudiar Cálculo" value="${esc(f.name)}" style="width:100%">
 <div class="row">Cómo mido el éxito <select id="g-m">${Object.entries(ML)
   .map(([k, v]) => `<option value="${k}"${k === f.mode ? " selected" : ""}>${v[1]}</option>`)
   .join("")}</select></div>
 <div class="row">Objetivo <input id="g-t" type="number" min="0.5" step="0.5" value="${f.target}" style="width:80px"> <span class="mut">${ML[f.mode][0]}</span>${f.mode === "horas" ? ` por <select id="g-p"><option value="sem"${f.per === "dia" ? "" : " selected"}>semana</option><option value="dia"${f.per === "dia" ? " selected" : ""}>día</option></select>` : " por semana"}</div>
 ${picker(f.tags, "g")}${ui.err ? `<p class="bad">${esc(ui.err)}</p>` : ""}
 <div class="row"><button class="p" data-act="gsave">Crear meta</button><button data-act="fcancel">Cancelar</button></div></div>`;
}

/* ==========================================================================
   BLOQUE 7: WIDGET RELOJ (hora, cronometro de estudio y pomodoro)
   Datos: S.clk {mode, sw (cronometro), pm (pomodoro)}. Usa marcas de tiempo (Date.now), no cuenta ticks. Incluye un setInterval de 1 s.
   Depende de: metas (6) para guardar horas, y de render/sync (13).
   ========================================================================== */

const hms = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1e3));
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60]
    .map((x) => String(x).padStart(2, "0"))
    .join(":");
};
const swMs = () => S.clk.sw.acc + (S.clk.sw.t0 ? Date.now() - S.clk.sw.t0 : 0);
const pmLeft = () => {
  const p = S.clk.pm;
  return (p.ph === "s" ? p.sMin : p.rMin) * 6e4 - (Date.now() - p.p0);
};
function pmAdv() {
  const p = S.clk.pm;
  if (p.st !== "run") return false;
  let ch = false,
    len;
  while (Date.now() - p.p0 >= (len = (p.ph === "s" ? p.sMin : p.rMin) * 6e4)) {
    if (p.ph === "s") p.sMs += len;
    p.ph = p.ph === "s" ? "r" : "s";
    p.p0 += len;
    ch = true;
  }
  return ch;
}
const pmStudy = () => {
  const p = S.clk.pm;
  return p.sMs + (p.st === "run" && p.ph === "s" ? Date.now() - p.p0 : 0);
};
const clReset = (src) => {
  if (src === "sw") S.clk.sw = { acc: 0, t0: null, done: false };
  else Object.assign(S.clk.pm, { st: "setup", sMs: 0 });
};
function beep() {
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)(),
      o = a.createOscillator();
    o.connect(a.destination);
    o.frequency.value = 660;
    o.start();
    o.stop(a.currentTime + 0.25);
  } catch (e) {}
}
function cur() {
  const c = S.clk;
  if (c.mode === "hora") return new Date().toLocaleTimeString("es-ES");
  if (c.mode === "estudio") return hms(swMs());
  return c.pm.st === "run" ? hms(pmLeft()) : "--:--:--";
}
function lab() {
  const c = S.clk;
  return c.mode === "estudio"
    ? c.sw.t0
      ? "Estudiando"
      : "En pausa"
    : c.mode === "pomo" && c.pm.st === "run"
      ? c.pm.ph === "s"
        ? "Tiempo de estudio"
        : "Descanso"
      : "";
}
function upd() {
  const c = S.clk,
    e = $("#cl-t"),
    b = $("#cl-l");
  if (e) e.textContent = cur();
  if (b) b.textContent = lab();
  const t =
    c.pm.st === "run"
      ? hms(pmLeft()) + (c.pm.ph === "s" ? " estudio" : " descanso")
      : c.sw.t0
        ? hms(swMs()) + " estudiando"
        : "";
  document.title = t ? t + " ARIA" : "ARIA, mi escritorio";
}
function saveBox(ms, src) {
  const gs = S.goals.filter((g) => g.mode === "horas"),
    h = Math.round(ms / 36e3) / 100;
  return (
    `<div class="form"><b>${src === "pm" ? "Sesión terminada" : "Cronómetro parado"}</b><p>Tiempo de estudio: <input id="cl-h" type="number" min="0" step="0.01" value="${h}" style="width:84px"> horas (${hms(ms)})</p>` +
    (gs.length
      ? `<div class="tg"><small class="mut">Guardar en la meta</small>${gs.map((g) => `<button class="chip p" data-act="clsave" data-id="${g.id}" data-f="${src}">${esc(g.name)}</button>`).join("")}</div>`
      : '<p class="mut">No tienes metas medidas en horas. Crea una en el gráfico personal y aparecerá aquí.</p>') +
    `<div class="row"><button data-act="cldrop" data-f="${src}">${gs.length ? "No guardar" : "Descartar"}</button>${src === "sw" ? '<button data-act="clback">Seguir cronometrando</button>' : ""}</div></div>`
  );
}
function clock() {
  const c = S.clk,
    m = c.mode,
    s = c.sw,
    p = c.pm,
    ctr = 'style="text-align:center"';
  let b;
  if (m === "hora")
    b = `<div class="big" id="cl-t">${cur()}</div><div class="mut" ${ctr}>${new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</div>`;
  else if (m === "estudio")
    b = s.done
      ? saveBox(swMs(), "sw")
      : `<div class="big" id="cl-t">${cur()}</div><div class="mut" id="cl-l" ${ctr}>${lab()}</div><div class="row" style="justify-content:center"><button class="p" data-act="swgo">${s.t0 ? "Pausar" : s.acc ? "Reanudar" : "Iniciar"}</button><button data-act="swstop"${s.acc || s.t0 ? "" : " disabled"}>Parar</button></div>`;
  else
    b =
      p.st === "setup"
        ? `<div class="row">Estudio <input id="cl-s" type="number" min="1" value="${p.sMin}" style="width:64px"> min, descanso <input id="cl-r" type="number" min="1" value="${p.rMin}" style="width:64px"> min</div><button class="p" data-act="pmgo">Empezar</button>`
        : p.st === "run"
          ? `<div class="big" id="cl-t">${cur()}</div><div class="mut" id="cl-l" ${ctr}>${lab()}</div><div class="row" style="justify-content:center"><button data-act="pmend">Terminar sesión</button></div>`
          : saveBox(p.sMs, "pm");
  return `<div class="row" style="justify-content:center">${[
    ["hora", "🕐 Hora"],
    ["estudio", "⏱ Estudio"],
    ["pomo", "🍅 Pomodoro"],
  ]
    .map(([k, n]) => `<button class="${m === k ? "sel" : ""}" data-act="cm" data-id="${k}">${n}</button>`)
    .join("")}</div>${b}`;
}
setInterval(() => {
  if (pmAdv()) {
    beep();
    save();
    sync();
    render();
  } else upd();
}, 1000);

/* ==========================================================================
   BLOQUE 8: WIDGET CALIFICACIONES
   Datos: S.grades [{id,asig,exam,nota,peso,fecha}], S.scol (color fijo por asignatura). Funciones: gcalc(), grades(), gfForm(), drawGr() (grafica SVG).
   drawGr() se llama desde render() (bloque 13).
   ========================================================================== */

S.grades = S.grades || [];
ui.gr = { show: false, view: "evo" };
ui.nf = null;
// Color fijo por asignatura (se guarda en S.scol, así no cambia al borrar notas)
const gcol = (a) => {
  S.scol = S.scol || {};
  if (!(a in S.scol)) {
    S.scol[a] = Object.keys(S.scol).length;
    save();
  }
  return `hsl(${(S.scol[a] * 67 + 210) % 360} 62% 46%)`;
};
// Nota actual de cada asignatura = media ponderada sobre lo ya evaluado; global = media simple de asignaturas
function gcalc(rs) {
  const m = {};
  rs.forEach((r) => {
    const o = (m[r.asig] = m[r.asig] || { s: 0, w: 0 });
    o.s += r.nota * r.peso;
    o.w += r.peso;
  });
  const sub = Object.entries(m)
    .map(([a, o]) => ({ a, n: o.w ? o.s / o.w : 0, w: o.w }))
    .filter((x) => x.w);
  return { sub, gl: sub.length ? sub.reduce((x, y) => x + y.n, 0) / sub.length : 0 };
}
function grades() {
  const rs = S.grades,
    { sub, gl } = gcalc(rs),
    f = ui.nf,
    subs = [...new Set(rs.map((r) => r.asig))];
  let h = `<div class='score'><span>${rs.length ? gl.toFixed(2) : "-"}</span>/10 <small class='mut'>media global (cada asignatura pesa igual)</small></div>`;
  h += subs
    .map((a) => {
      const x = sub.find((s) => s.a === a) || { n: 0, w: 0 },
        rr = rs.filter((r) => r.asig === a).sort((p, q) => (p.fecha < q.fecha ? -1 : 1));
      return (
        `<div class='goal' style='border:2px solid ${gcol(a)};background:color-mix(in srgb,${gcol(a)} 10%,transparent)'><div class='row'><b>${esc(a)}</b><span class='sp'></span><b style='color:var(--${x.n >= 5 ? "ok" : "bad"})'>${x.w ? x.n.toFixed(2) : "-"}</b></div><small class='mut'>Nota actual sobre lo evaluado (${x.w}% del total)</small>${x.w > 100 ? `<div class='bad'>Los pesos suman más de 100%.</div>` : ""}` +
        rr
          .map(
            (r) =>
              `<div class='gr'><span class='gn'>${esc(r.exam)} <small class='mut'>${fmt(r.fecha)}</small></span><b>${r.nota}</b><span>${r.peso}%</span><span><button data-act='ged' data-id='${r.id}'>✎</button><button data-act='gdl' data-id='${r.id}'>🗑</button></span></div>`,
          )
          .join("") +
        "</div>"
      );
    })
    .join("");
  h += f ? gfForm() : `<button class='p' data-act='gnw'>＋ Añadir nota</button>`;
  if (rs.length)
    h += ` <button data-act='gshow'>${ui.gr.show ? "Ocultar gráfica" : "Ver Gráfica de Progreso"}</button>`;
  if (ui.gr.show && rs.length)
    h += `<div class='row'><button class='${ui.gr.view === "cmp" ? "" : "sel"}' data-act='gview' data-id='evo'>Evolución</button><button class='${ui.gr.view === "cmp" ? "sel" : ""}' data-act='gview' data-id='cmp'>Comparativa</button></div><div id='gr-box'></div>`;
  return h;
}
function gfForm() {
  const f = ui.nf;
  return `<div class='form'><b>${f.id ? "Editar nota" : "Nota nueva"}</b><div class='row'><input id='n-a' list='n-l' placeholder='Asignatura' value='${esc(f.asig)}'><datalist id='n-l'>${[...new Set(S.grades.map((r) => r.asig))].map((a) => `<option value='${esc(a)}'>`).join("")}</datalist><input id='n-e' placeholder='Examen o entrega' value='${esc(f.exam)}'></div><div class='row'>Nota <input id='n-n' type='number' min='0' max='10' step='0.01' value='${f.nota}' style='width:80px'> Peso <input id='n-p' type='number' min='0' max='100' step='1' value='${f.peso}' style='width:72px'>% <input id='n-d' type='date' value='${f.fecha}'></div>${ui.err ? `<p class='bad'>${esc(ui.err)}</p>` : ""}<div class='row'><button class='p' data-act='gfs'>Guardar</button><button data-act='fcancel'>Cancelar</button></div></div>`;
}
// Gráfica en SVG nativo; se redibuja al cambiar el ancho del widget
function drawGr() {
  const b = $("#gr-box");
  if (!b) return;
  b._w = b.clientWidth;
  const W = Math.max(240, b._w),
    H = Math.round(Math.min(300, Math.max(180, W * 0.55))),
    L = 28,
    R = 10,
    T = 10,
    B = 26,
    pw = W - L - R,
    ph = H - T - B,
    Y = (v) => T + ph * (1 - v / 10),
    rs = S.grades,
    subs = [...new Set(rs.map((r) => r.asig))],
    col = gcol;
  let s =
      `<svg viewBox='0 0 ${W} ${H}' width='${W}' height='${H}'>` +
      [0, 5, 10]
        .map(
          (v) =>
            `<line class='gl' x1='${L}' x2='${W - R}' y1='${Y(v)}' y2='${Y(v)}'${v === 5 ? ` stroke-dasharray='4 3'` : ""}/><text x='${L - 5}' y='${Y(v) + 4}' text-anchor='end'>${v}</text>`,
        )
        .join(""),
    lg = "";
  if (ui.gr.view === "cmp") {
    const c = gcalc(rs).sub,
      bw = pw / Math.max(1, c.length);
    c.forEach((x, i) => {
      const bx = L + bw * i + bw * 0.2,
        cx = bx + bw * 0.3;
      s += `<rect class='${x.n >= 5 ? "ok" : "no"}' x='${bx}' y='${Y(x.n)}' width='${bw * 0.6}' height='${(ph * x.n) / 10}' rx='3'><title>${esc(x.a)}: ${x.n.toFixed(2)}</title></rect><text class='gv' x='${cx}' y='${Y(x.n) - 4}' text-anchor='middle'>${x.n.toFixed(1)}</text><text x='${cx}' y='${H - 8}' text-anchor='middle'>${esc(x.a.slice(0, Math.max(3, Math.floor(bw / 7))))}</text>`;
    });
  } else {
    let sx = "";
    const ds = [...new Set(rs.map((r) => r.fecha))].sort(),
      t0 = fromIso(ds[0]),
      sp = fromIso(ds[ds.length - 1]) - t0 || 1,
      X = (d) => (ds.length > 1 ? L + (pw * (fromIso(d) - t0)) / sp : L + pw / 2);
    subs.forEach((a) => {
      const p = rs.filter((r) => r.asig === a).sort((x, y) => (x.fecha < y.fecha ? -1 : 1));
      let cs = 0,
        cw = 0;
      const q = p.map((r) => {
        cs += r.nota * r.peso;
        cw += r.peso;
        return { x: X(r.fecha), v: cw ? cs / cw : r.nota, r };
      });
      sx +=
        `<polyline fill='none' stroke='${col(a)}' stroke-width='2.5' points='${q.map((o) => o.x + "," + Y(o.v)).join(" ")}'/>` +
        q
          .map(
            (o) =>
              `<circle cx='${o.x}' cy='${Y(o.v)}' r='5' fill='${col(a)}'><title>${esc(a)}, ${esc(o.r.exam)}: ${o.r.nota} (${fmt(o.r.fecha)}). Nota actual: ${o.v.toFixed(2)}</title></circle>`,
          )
          .join("");
    });
    const g = ds.map((d) => ({ x: X(d), v: gcalc(rs.filter((r) => r.fecha <= d)).gl, d }));
    s +=
      `<polyline class='gg' points='${g.map((q) => q.x + "," + Y(q.v)).join(" ")}'/>` +
      g
        .map(
          (q) =>
            `<circle class='gd' cx='${q.x}' cy='${Y(q.v)}' r='5'><title>Media global tras el ${fmt(q.d)}: ${q.v.toFixed(2)}</title></circle>`,
        )
        .join("") +
      sx +
      `<text x='${L}' y='${H - 8}'>${fmt(ds[0])}</text><text x='${W - R}' y='${H - 8}' text-anchor='end'>${ds.length > 1 ? fmt(ds[ds.length - 1]) : ""}</text>`;
    lg = `<div class='lg'>${subs.map((a) => `<span><i style='background:${col(a)}'></i>${esc(a)}</span>`).join("")}<span><i style='background:var(--ink)'></i>Media global</span></div>`;
  }
  b.innerHTML = s + "</svg>" + lg;
  if (!b._ro) {
    b._ro = new ResizeObserver(() => {
      if (b.clientWidth !== b._w) drawGr();
    });
    b._ro.observe(b);
  }
}

/* ==========================================================================
   BLOQUE 9: POST-ITS FLOTANTES (no son un widget)
   Datos: S.notes [{id,c,title,text,items,x,y}]. Se crean con el boton de la cabecera, viven en #pits y siempre quedan por encima de todo.
   pits() se llama desde render() (bloque 13). Incluye autoguardado al escribir y arrastre propio (PD).
   ========================================================================== */

S.notes = S.notes || [];
ui.nd = null;
S.notes.forEach((n, i) => {
  if (n.x == null) {
    n.x = 140 + (i % 8) * 26;
    n.y = 140 + (i % 8) * 26;
  }
});
const PC = { y: "#fff59d", g: "#c8f0c0", b: "#bfe0ff", p: "#ffc8dc", l: "#e3d1fb" };
function pits() {
  return S.notes
    .map(
      (
        n,
        i,
      ) => `<div class='pw' style='--r:${((i % 3) - 1) * 0.7}deg;left:${Math.max(0, Math.min(n.x, innerWidth - 230))}px;top:${n.y}px'><div class='pn' style='--pc:${PC[n.c]}'>
 <div class='row pt' data-id='${n.id}' style='margin:0;padding-bottom:6px'>${Object.entries(PC)
   .map(
     ([k, v]) =>
       `<button class='cd${k === n.c ? " cur" : ""}' style='background:${v}' data-act='nco' data-id='${n.id}' data-d='${k}' title='Color'></button>`,
   )
   .join(
     "",
   )}<span class='sp'></span><button class='nx' data-act='ndel' data-id='${n.id}' title='Borrar nota'>${ui.nd === n.id ? "¿Borrar?" : "✕"}</button></div>
 <input class='ti' data-n='${n.id}' data-f='t' placeholder='Título (opcional)' value='${esc(n.title)}'>
 <textarea data-n='${n.id}' data-f='x' placeholder='Escribe aquí...'>${esc(n.text)}</textarea>
 ${n.items.map((i) => `<div class='ni'><input type='checkbox' data-act='nck' data-id='${n.id}' data-d='${i.id}'${i.d ? " checked" : ""}><input class='${i.d ? "dn" : ""}' data-n='${n.id}' data-f='i' data-i='${i.id}' value='${esc(i.t)}' placeholder='Tarea'><button class='nx' data-act='nid' data-id='${n.id}' data-d='${i.id}'>✕</button></div>`).join("")}
 <button class='nx' data-act='nit' data-id='${n.id}'>＋ ítem de lista</button></div></div>`,
    )
    .join("");
}
// Autoguardado al escribir (sin re-render, para no perder el foco)
document.addEventListener("input", (e) => {
  const t = e.target,
    n = S.notes.find((x) => x.id === t.dataset.n);
  if (!n) return;
  if (t.dataset.f === "t") n.title = t.value;
  else if (t.dataset.f === "x") n.text = t.value;
  else if (t.dataset.f === "i") n.items.find((i) => i.id === t.dataset.i).t = t.value;
  save();
});
// Arrastrar post-its desde su barra superior
let PD = null;
document.addEventListener("pointerdown", (e) => {
  const h = e.target.closest(".pt");
  if (!h || e.target.closest("button")) return;
  const n = S.notes.find((x) => x.id === h.dataset.id);
  if (!n) return;
  e.preventDefault();
  PD = { n, w: h.closest(".pw"), x: e.clientX, y: e.clientY, x0: n.x, y0: n.y };
  h.setPointerCapture(e.pointerId);
});
document.addEventListener("pointermove", (e) => {
  if (!PD) return;
  PD.n.x = Math.max(0, PD.x0 + e.clientX - PD.x);
  PD.n.y = Math.max(0, PD.y0 + e.clientY - PD.y);
  PD.w.style.left = PD.n.x + "px";
  PD.w.style.top = PD.n.y + "px";
});
["pointerup", "pointercancel"].forEach((t) =>
  document.addEventListener(t, () => {
    if (PD) {
      PD = null;
      save();
    }
  }),
);
/* ==========================================================================
   BLOQUE 10: WIDGET TABLERO KANBAN
   Datos: S.kb [{id,t,p:a|m|b,s:0|1|2}] (s = columna). Funcion: kanban(). Arrastrar tarjetas con raton y botones para tactil.
   ========================================================================== */

S.kb = S.kb || [];
const COLS = ["Por hacer", "En proceso", "Completado"],
  PR = { a: ["Alta", "var(--bad)"], m: ["Media", "#d99a1e"], b: ["Baja", "var(--ok)"] };
function kanban() {
  const col = (i) => {
    const t = S.kb.filter((k) => k.s === i).sort((a, b) => "amb".indexOf(a.p) - "amb".indexOf(b.p));
    return (
      `<div class='kcol' data-s='${i}'><div class='kh'>${COLS[i]} <small class='mut'>${t.length}</small><span class='sp'></span>${i === 2 && t.length ? `<button data-act='kclr' title='Borrar todas las completadas'>Limpiar</button>` : ""}</div>` +
      t
        .map(
          (k) =>
            `<div class='kc' draggable='true' data-id='${k.id}' style='--pr:${PR[k.p][1]}'><div class='kt${i === 2 ? " dn" : ""}'>${esc(k.t)}</div><div class='ka'><small class='mut'>${PR[k.p][0]}</small><span class='sp'></span>${i > 0 ? `<button data-act='kmv' data-id='${k.id}' data-d='${i - 1}' title='Mover a ${COLS[i - 1]}'>◀</button>` : ""}${i < 2 ? `<button data-act='kmv' data-id='${k.id}' data-d='${i + 1}' title='Mover a ${COLS[i + 1]}'>▶</button>` : ""}${i === 0 ? `<button data-act='kmv' data-id='${k.id}' data-d='2' title='Marcar como completada'>✓</button>` : ""}<button data-act='kdel' data-id='${k.id}' title='Eliminar'>✕</button></div></div>`,
        )
        .join("") +
      "</div>"
    );
  };
  return `<div class='row'><input id='kb-t' placeholder='Nueva tarea...' style='flex:1;min-width:120px'><select id='kb-p'><option value='b'>Baja</option><option value='m' selected>Media</option><option value='a'>Alta</option></select><button class='p' id='kb-add' data-act='kadd'>＋</button></div><div class='kb'>${[0, 1, 2].map(col).join("")}</div>`;
}
// Arrastrar tarjetas entre columnas (con ratón); en pantallas táctiles quedan los botones ◀ ▶ ✓
document.addEventListener("dragstart", (e) => {
  const c = e.target.closest?.(".kc");
  if (c) e.dataTransfer.setData("text/plain", c.dataset.id);
});
document.addEventListener("dragover", (e) => {
  if (e.target.closest?.(".kcol")) e.preventDefault();
});
document.addEventListener("drop", (e) => {
  const c = e.target.closest?.(".kcol");
  if (!c) return;
  e.preventDefault();
  const k = S.kb.find((x) => x.id === e.dataTransfer.getData("text/plain"));
  if (k) {
    k.s = +c.dataset.s;
    save();
    render();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "kb-t") $("#kb-add").click();
});

/* ==========================================================================
   BLOQUE 11: BIBLIOTECA VISUAL (sidebar) y visor de documentos de texto
   Datos: S.lib = nodos planos [{id,k:b libro|s seccion|d documento|f pdf, p:padre, n, c color, o abierto, x texto, cr, up}], S.doc, S.sbc.
   Funciones: side() (panel lateral), docw() (widget Documento). showDoc() usa front() del bloque 15.
   ========================================================================== */

S.lib = S.lib || [];
if (S.sbc === undefined) S.sbc = innerWidth < 900;
ui.sd = true;
ui.ld = null;
ui.lc = 0;
const LC = ["#2f6b4f", "#2f5d8c", "#7b2d3b", "#c99a2e", "#5b4a8a", "#1f6f78"];
const showDoc = () => {
  if (!S.open.includes("doc")) S.open.push("doc");
  front("doc");
  const n = S.lib.find((x) => x.id === S.doc);
  if (n && n.k === "f" && !S.size.doc) S.size.doc = { w: Math.min(760, DW() - 36), h: 660 };
};
function side() {
  const L = S.lib,
    ch = (p) => L.filter((n) => n.p === p),
    del = (id, t) =>
      `<button data-act='ldel' data-id='${id}' title='Borrar'>${ui.ld === id ? "¿Seguro?" : t}</button>`;
  const doc = (d) =>
    `<div class='dl${S.doc === d.id ? " on" : ""}' data-act='dopen' data-id='${d.id}'><span>${d.k === "f" ? "📕" : "📄"} ${esc(d.n || "Sin título")}</span>${del(d.id, "✕")}</div>`;
  const sec = (s) =>
    `<div class='sc'><div class='sh'>§<input class='sn' data-lid='${s.id}' data-lf='s' value='${esc(s.n)}'><button data-act='dnew' data-id='${s.id}' title='Nuevo documento en esta sección'>＋📄</button>${pfb(s.id)}${del(s.id, "✕")}</div>${ch(s.id).map(doc).join("")}</div>`;
  const book = (b) =>
    `<div class='bk${b.o ? " open" : ""}' data-id='${b.id}' style='--bc:${b.c}'><div class='spb' data-act='bopen' data-id='${b.id}'><span class='bt'>${esc(b.n)}</span><button data-act='bcol' data-id='${b.id}' title='Cambiar color'>🎨</button></div><div class='bb'><div class='bi'><div class='bp'>${ch(
      b.id,
    )
      .filter((n) => n.k === "s")
      .map(sec)
      .join("")}${ch(b.id)
      .filter((n) => n.k !== "s")
      .map(doc)
      .join(
        "",
      )}${ch(b.id).length ? "" : "<small>Libro vacío</small>"}<div class='bt2'><button data-act='dnew' data-id='${b.id}'>＋ Documento</button><button data-act='snew' data-id='${b.id}'>＋ Sección</button>${pfb(b.id)}${del(b.id, "✕ Libro")}</div></div></div></div></div>`;
  return `<div class='sbh'><span class='sbx'>📚 Biblioteca</span><span class='sp'></span><button data-act='sbt' title='Mostrar u ocultar'>${S.sbc ? "📚" : "◀"}</button></div><div class='sbx'>${
    ch(null)
      .filter((n) => n.k === "b")
      .map(book)
      .join("") || "<small>Estantería vacía.</small>"
  }${ui.sm ? `<small class='bad' style='color:#ffb4a8'>${esc(ui.sm)}</small>` : ""}<div class='ab'><input id='ab-n' placeholder='Nuevo libro o carpeta...'><div class='sw'>${LC.map((c, i) => `<button class='cd${i === ui.lc ? " cur" : ""}' style='background:${c}' data-act='lcol' data-d='${i}' title='Color'></button>`).join("")}</div><button class='p' data-act='bnew'>＋ Añadir libro</button></div></div>`;
}
// Visor de documento: widget que muestra el documento elegido en la biblioteca (S.doc)
function docw() {
  const d = S.lib.find((x) => x.id === S.doc && x.k !== "s" && x.k !== "b");
  if (!d) return `<p class='mut'>Elige un documento en la biblioteca de la izquierda.</p>`;
  if (d.k === "f") return pdfw(d);
  const p = S.lib.find((n) => n.id === d.p),
    b = p && p.k === "s" ? S.lib.find((n) => n.id === p.p) : p,
    f = (t) =>
      new Date(t).toLocaleString("es-ES", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
  return `<div class='dv'><div class='mut'><i class='cdot' style='background:${b ? b.c : "#999"}'></i>${[
    b,
    p && p.k === "s" ? p : null,
  ]
    .filter(Boolean)
    .map((n) => esc(n.n))
    .join(
      " › ",
    )}</div><input class='dt' data-lid='${d.id}' data-lf='t' placeholder='Título' value='${esc(d.n)}'><textarea data-lid='${d.id}' data-lf='x' placeholder='Escribe aquí...'>${esc(d.x || "")}</textarea><small class='mut'>Creado ${f(d.cr)}, editado ${f(d.up)}</small></div>`;
}
document.addEventListener("input", (e) => {
  const t = e.target,
    n = S.lib.find((x) => x.id === t.dataset.lid);
  if (!n) return;
  const f = t.dataset.lf;
  if (f === "x") {
    n.x = t.value;
    n.up = Date.now();
  } else {
    n.n = t.value;
    if (n.k === "d") n.up = Date.now();
  }
  save();
});

/* ==========================================================================
   BLOQUE 12: PDFs: subida, almacenamiento y visor
   Bytes en IndexedDB (base "aria", almacen "pdf"); metadatos en S.lib (k:"f", n, sz, tp, pg). Visor con PDF.js 3.11.174 cargado desde cdnjs bajo demanda.
   Funciones: addPdf(), pvOpen(), pvGo(), drawPdf(), pdfw(). Depende de: biblioteca (11), layout (2), render (13).
   ========================================================================== */

const PJ = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
const pjLoad = (u) =>
  new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = u;
    s.onload = ok;
    s.onerror = () => no(new Error("No se pudo cargar PDF.js"));
    document.head.appendChild(s);
  });
let pjP = null;
const pjs = () =>
  pjP ||
  (pjP = pjLoad(PJ + "pdf.min.js")
    .then(() => pjLoad(PJ + "pdf.worker.min.js"))
    .then(() => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = PJ + "pdf.worker.min.js";
    })
    .catch((e) => {
      pjP = null;
      throw e;
    }));
const idb = (m, k, v) =>
  new Promise((ok, no) => {
    const r = indexedDB.open("aria", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("pdf");
    r.onerror = () => no(r.error);
    r.onsuccess = () => {
      const t = r.result.transaction("pdf", m === "get" ? "readonly" : "readwrite"),
        s = t.objectStore("pdf"),
        q = m === "get" ? s.get(k) : m === "put" ? s.put(v, k) : s.delete(k);
      q.onsuccess = () => ok(q.result);
      q.onerror = () => no(q.error);
      t.oncomplete = () => r.result.close();
    };
  });
const mb = (b) =>
  b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
const pfb = (id) =>
  `<label class='fb' title='Subir un PDF'>＋ PDF<input type='file' accept='application/pdf,.pdf' data-pf='${id}' hidden></label>`;
async function addPdf(pid, f) {
  if (!f) return;
  if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) {
    ui.sm = "Solo se admiten archivos PDF.";
    ui.sd = true;
    render();
    return;
  }
  try {
    const id = "f" + Date.now();
    await idb("put", id, await f.arrayBuffer());
    S.lib.push({
      id,
      k: "f",
      p: pid,
      n: f.name,
      sz: f.size,
      tp: f.type || "application/pdf",
      cr: Date.now(),
    });
    try {
      navigator.storage.persist();
    } catch (e) {}
    ui.sm = "";
    ui.sd = true;
    save();
    render();
  } catch (e) {
    ui.sm = "No se pudo guardar el PDF (" + (e.name || "error") + ").";
    ui.sd = true;
    render();
  }
}
function pvOpen(d) {
  const v = (ui.pv = { id: d.id, n: d.pg || 1, N: 0, scale: 1, fit: true, pdf: null, tk: 0, sx: 0, sy: 0 });
  (async () => {
    try {
      await pjs();
      const buf = await idb("get", d.id);
      if (!buf) throw new Error("el archivo no está en este navegador (¿se borraron los datos del sitio?)");
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
      if (ui.pv !== v) return;
      v.pdf = pdf;
      v.N = pdf.numPages;
      v.n = Math.min(v.n, v.N);
      render();
    } catch (e) {
      if (ui.pv === v) {
        v.err = "No se pudo abrir el PDF: " + (e.message || e);
        render();
      }
    }
  })();
}
function pvGo(n) {
  const v = ui.pv;
  if (!v || !v.pdf) return;
  v.n = Math.min(v.N, Math.max(1, Math.round(n) || 1));
  const f = S.lib.find((x) => x.id === v.id);
  if (f) f.pg = v.n;
  v.sx = 0;
  v.sy = 0;
}
async function drawPdf() {
  const v = ui.pv,
    box = $("#pv-box");
  if (!v || !box) return;
  if (!v.pdf) {
    box.textContent = v.err || "Cargando PDF...";
    return;
  }
  if (!v.cv) v.cv = document.createElement("canvas");
  box.textContent = "";
  box.appendChild(v.cv);
  box.scrollLeft = v.sx || 0;
  box.scrollTop = v.sy || 0;
  const w = box.clientWidth,
    tk = ++v.tk,
    pg = await v.pdf.getPage(v.n),
    v1 = pg.getViewport({ scale: 1 }),
    sc = v.fit ? Math.max(0.3, (w - 6) / v1.width) : v.scale,
    key = [v.id, v.n, sc.toFixed(3)].join();
  v.cur = sc;
  if (v.key === key || tk !== v.tk) return;
  const vp = pg.getViewport({ scale: sc }),
    r = devicePixelRatio || 1,
    c = v.cv;
  c.width = Math.floor(vp.width * r);
  c.height = Math.floor(vp.height * r);
  c.style.width = vp.width + "px";
  c.style.height = vp.height + "px";
  try {
    if (v.task) v.task.cancel();
  } catch (e) {}
  try {
    v.task = pg.render({
      canvasContext: c.getContext("2d"),
      viewport: vp,
      transform: r !== 1 ? [r, 0, 0, r, 0, 0] : null,
    });
    await v.task.promise;
    v.key = key;
    layout();
  } catch (e) {}
  box._w = w;
  if (!box._ro) {
    box._ro = new ResizeObserver(() => {
      if (ui.pv && ui.pv.fit && box.clientWidth !== box._w) drawPdf();
    });
    box._ro.observe(box);
  }
}
function pdfw(d) {
  const p = S.lib.find((n) => n.id === d.p),
    b = p && p.k === "s" ? S.lib.find((n) => n.id === p.p) : p;
  if (!ui.pv || ui.pv.id !== d.id) pvOpen(d);
  const V = ui.pv;
  return `<div class='dv'><div><b>Leyendo: ${esc(d.n)}</b> <span class='mut'>dentro de <i class='cdot' style='background:${b ? b.c : "#999"}'></i>${esc(b ? b.n : "?")}${p && p.k === "s" ? " › " + esc(p.n) : ""}</span></div><div class='row pvt'><button data-act='pvp' title='Página anterior'>◀</button><input id='pv-n' type='number' min='1' max='${V.N || 1}' value='${V.n}' style='width:62px'> / ${V.N || "-"}<button data-act='pvn' title='Página siguiente'>▶</button><button data-act='pvz' data-d='-1' title='Alejar'>−</button><button data-act='pvz' data-d='1' title='Acercar'>＋</button><button class='${V.fit ? "sel" : ""}' data-act='pvf'>Ajustar al ancho</button><button data-act='pvx' title='Maximizar (Esc para salir)'>${ui.mx ? "🗗" : "⛶"}</button><button data-act='pvc' title='Cerrar documento'>✕</button></div><div id='pv-box'></div><small class='mut'>${mb(d.sz)}, ${esc(d.tp)}</small></div>`;
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && ui.mx) {
    ui.mx = false;
    render();
  } else if (
    ui.pv &&
    ui.pv.pdf &&
    S.doc === ui.pv.id &&
    !/INPUT|TEXTAREA/.test(e.target.tagName) &&
    (e.key === "ArrowRight" || e.key === "ArrowLeft")
  ) {
    pvGo(ui.pv.n + (e.key === "ArrowRight" ? 1 : -1));
    save();
    render();
  }
});

/* ==========================================================================
   BLOQUE 13: LOBBY: registro de widgets, render() y sync()
   WIDGETS = lista de widgets disponibles (id, icono, titulo, ancho por defecto w, funcion render). Un widget nuevo se anade aqui.
   render() reconstruye todo el escritorio (guarda y restaura el scroll) y llama a side(), pits(), drawGr(), drawPdf(), layout().
   sync() guarda el texto de los formularios abiertos antes de redibujar.
   ========================================================================== */

const WIDGETS = [
  { id: "cal", icon: "📅", title: "Calendario", w: 640, render: cal },
  { id: "goals", icon: "🎯", title: "Gráfico personal", w: 470, render: goals },
  { id: "clock", icon: "🕐", title: "Reloj", w: 330, render: clock },
  { id: "grades", icon: "🎓", title: "Calificaciones", w: 560, render: grades },
  { id: "kanban", icon: "🗂️", title: "Tablero Kanban", w: 560, render: kanban },
  { id: "doc", icon: "📄", title: "Documento", w: 520, render: docw },
];
function render() {
  const sy = scrollY,
    ws = {},
    pb = $("#pv-box");
  if (pb && ui.pv) {
    ui.pv.sx = pb.scrollLeft;
    ui.pv.sy = pb.scrollTop;
  }
  if (ui.sd) {
    const sb = $("#sb"),
      st = sb.scrollTop;
    sb.innerHTML = side();
    sb.scrollTop = st;
    ui.sd = false;
  }
  document.body.classList.toggle("sbc", !!S.sbc);
  document.querySelectorAll(".wb").forEach((b) => {
    ws[b.parentElement.dataset.id] = b.scrollTop;
  });
  $("#cfg").innerHTML = ui.cfg
    ? `<div class="form" style="background:var(--paper)"><b>Ajustes</b> (el menú completo llegará más adelante)<div class="row">${WIDGETS.map((w) => `<label><input type="checkbox" ${S.open.includes(w.id) ? "checked" : ""} data-act="tog" data-id="${w.id}"> ${w.icon} ${w.title}</label>`).join("")}</div></div>`
    : "";
  $("#desk").innerHTML =
    S.open
      .map((id) => WIDGETS.find((w) => w.id === id))
      .filter(Boolean)
      .map(
        (w) =>
          `<section class="w${ui.mx && w.id === "doc" ? " mx" : ""}" data-id="${w.id}" style="${sz(w)}"><div class="wh">${w.icon} ${w.title}<span class="sp"></span><button data-act="close" data-id="${w.id}" title="Cerrar">✕</button></div><div class="wb">${w.render()}</div><div class="rz" data-id="${w.id}" title="Arrastra para redimensionar, doble clic para restaurar"></div></section>`,
      )
      .join("") || "<p>Escritorio vacío. Abre Ajustes para añadir widgets.</p>";
  $("#pits").innerHTML = pits();
  drawGr();
  drawPdf().catch(() => {});
  layout();
  document.querySelectorAll(".wb").forEach((b) => {
    b.scrollTop = ws[b.parentElement.dataset.id] || 0;
  });
  scrollTo(0, sy);
}
function sync() {
  const g = (id) => $("#" + id);
  if (ui.form && g("f-t"))
    Object.assign(ui.form, {
      title: g("f-t").value,
      color: g("f-c").value,
      days: Math.max(1, +g("f-d").value || 1),
      ins: g("f-i").value,
      emoji: g("f-e").value || "📌",
    });
  if (ui.nf && g("n-a"))
    Object.assign(ui.nf, {
      asig: g("n-a").value,
      exam: g("n-e").value,
      nota: g("n-n").value,
      peso: g("n-p").value,
      fecha: g("n-d").value,
    });
  if (ui.gform && g("g-n"))
    Object.assign(ui.gform, {
      name: g("g-n").value,
      mode: g("g-m").value,
      target: Math.max(0.5, +g("g-t").value || 1),
      per: g("g-p") ? g("g-p").value : "sem",
    });
}
const shiftM = (k) => {
  const [y, m] = ui.month.split("-").map(Number),
    n = new Date(y, m - 1 + k, 1);
  ui.month = n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0");
};
const shiftW = (k) => {
  ui.week = addD(ui.week, k * 7);
  ui.day = TODAY >= ui.week && TODAY <= addD(ui.week, 6) ? TODAY : ui.week;
};
/* ==========================================================================
   BLOQUE 14: EVENTOS GLOBALES: clic y change
   Un unico listener de clic. Cada boton lleva data-act (accion), data-id, data-d y data-f; la tabla A ejecuta la accion y luego save() + render().
   Las acciones estan agrupadas por bloque. El listener de change gestiona inputs y selects.
   ========================================================================== */
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-act]");
  if (!t) return;
  sync();
  const a = t.dataset.act,
    id = t.dataset.id,
    d = t.dataset.d,
    F = t.dataset.f === "g" ? ui.gform : ui.form,
    lg = () => (S.log[id] = S.log[id] || {});
  if (a !== "fsave" && a !== "gsave") ui.err = "";
  if (a !== "ndel") ui.nd = null;
  if (a !== "ldel" && ui.ld) {
    ui.ld = null;
    ui.sd = true;
  }
  const A = {
    // ----- Acciones: Lobby (ajustes, cerrar widget, ordenar) [bloque 13] -----
    cfg: () => {
      ui.cfg = !ui.cfg;
    },
    tog: () => {
      S.open = S.open.includes(id) ? S.open.filter((x) => x !== id) : [...S.open, id];
    },
    close: () => {
      S.open = S.open.filter((x) => x !== id);
    },
    tidy: () => {
      S.pos = {};
    },
    // ----- Acciones: Compartidas por calendario, metas y notas: etiquetas y cancelar formularios [bloque 4] -----
    ftag: () => {
      F.tags = F.tags.includes(id) ? F.tags.filter((x) => x !== id) : [...F.tags, id];
    },
    newtag: () => {
      const n = $("#nt-n").value.trim();
      if (!n) return;
      const tg = {
        id: "t" + Date.now(),
        g: ((g) => (t.dataset.f === "g" && g === "Tipo de evento" ? "General" : g))(
          $("#nt-g").value.trim() || "General",
        ),
        n,
        p: +$("#nt-p").value || 0,
      };
      S.tags.push(tg);
      F.tags.push(tg.id);
    },
    fcancel: () => {
      ui.form = null;
      ui.gform = null;
      ui.nf = null;
    },
    // ----- Acciones: Calendario [bloque 5] -----
    mp: () => shiftM(-1),
    mn: () => shiftM(1),
    day: () => {
      ui.form = { start: d, title: "", emoji: "📚", color: "#2547c9", days: 1, ins: "media", tags: [] };
    },
    edit: () => {
      const ev = S.events.find((x) => x.id === id);
      ui.form = { ...ev, tags: [...ev.tags] };
    },
    emo: () => {
      ui.form.emoji = d;
    },
    fsave: () => {
      const f = ui.form;
      if (!f.title.trim()) {
        ui.err = "Ponle un título al evento.";
        return;
      }
      if (f.id) S.events = S.events.map((x) => (x.id === f.id ? { ...x, ...f } : x));
      else S.events.push({ ...f, id: "e" + Date.now(), prog: 0 });
      ui.form = null;
      ui.err = "";
    },
    fdel: () => {
      S.events = S.events.filter((x) => x.id !== ui.form.id);
      ui.form = null;
    },
    // ----- Acciones: Grafico personal / metas [bloque 6] -----
    wp: () => shiftW(-1),
    wn: () => shiftW(1),
    wd: () => {
      ui.day = d;
    },
    gnew: () => {
      ui.gform = { name: "", mode: "horas", target: 5, tags: [] };
    },
    gsave: () => {
      const f = ui.gform;
      if (!f.name.trim()) {
        ui.err = "Ponle un nombre a la meta.";
        return;
      }
      S.goals.push({ ...f, id: "g" + Date.now() });
      ui.gform = null;
      ui.err = "";
    },
    gdel: () => {
      S.goals = S.goals.filter((x) => x.id !== id);
      delete S.log[id];
    },
    inc: () => {
      const l = lg();
      l[ui.day] = (+l[ui.day] || 0) + 1;
    },
    dec: () => {
      const l = lg();
      l[ui.day] = Math.max(0, (+l[ui.day] || 0) - 1);
    },
    chk: () => {
      const l = lg();
      l[ui.day] = l[ui.day] ? 0 : 1;
    },
    // ----- Acciones: Reloj [bloque 7] -----
    cm: () => {
      S.clk.mode = id;
    },
    swgo: () => {
      const s = S.clk.sw,
        n = Date.now();
      if (s.t0) {
        s.acc += n - s.t0;
        s.t0 = null;
      } else s.t0 = n;
    },
    swstop: () => {
      const s = S.clk.sw,
        n = Date.now();
      if (s.t0) {
        s.acc += n - s.t0;
        s.t0 = null;
      }
      if (s.acc > 0) s.done = true;
    },
    clback: () => {
      S.clk.sw.done = false;
    },
    pmgo: () => {
      Object.assign(S.clk.pm, {
        st: "run",
        sMin: Math.max(1, Math.round(+$("#cl-s").value) || 25),
        rMin: Math.max(1, Math.round(+$("#cl-r").value) || 5),
        ph: "s",
        p0: Date.now(),
        sMs: 0,
      });
    },
    pmend: () => {
      const p = S.clk.pm;
      pmAdv();
      p.sMs = pmStudy();
      p.st = "end";
    },
    clsave: () => {
      const h = Math.max(0, +$("#cl-h").value || 0),
        l = (S.log[id] = S.log[id] || {});
      l[TODAY] = Math.round(((+l[TODAY] || 0) + h) * 100) / 100;
      clReset(t.dataset.f);
    },
    cldrop: () => clReset(t.dataset.f),
    // ----- Acciones: Calificaciones [bloque 8] -----
    gnw: () => {
      ui.nf = { asig: "", exam: "", nota: "", peso: "", fecha: TODAY };
    },
    ged: () => {
      ui.nf = { ...S.grades.find((r) => r.id === id) };
    },
    gfs: () => {
      const f = ui.nf,
        v = (k) => $("#n-" + k).value,
        r = {
          id: f.id,
          asig: v("a").trim(),
          exam: v("e").trim(),
          nota: +v("n"),
          peso: +v("p"),
          fecha: v("d") || TODAY,
        };
      if (!r.asig || !r.exam || v("n") === "" || v("p") === "") {
        ui.nf = r;
        ui.err = "Rellena asignatura, examen, nota y peso.";
        return;
      }
      if (r.nota < 0 || r.nota > 10 || r.peso < 0 || r.peso > 100) {
        ui.nf = r;
        ui.err = "La nota va de 0 a 10 y el peso de 0 a 100.";
        return;
      }
      if (f.id) S.grades = S.grades.map((x) => (x.id === f.id ? r : x));
      else {
        r.id = "n" + Date.now();
        S.grades = [...S.grades, r];
      }
      ui.nf = null;
    },
    gdl: () => {
      S.grades = S.grades.filter((x) => x.id !== id);
    },
    gshow: () => {
      ui.gr.show = !ui.gr.show;
    },
    gview: () => {
      ui.gr.view = id;
    },
    // ----- Acciones: Post-its [bloque 9] -----
    nnew: () => {
      const k = S.notes.length % 8;
      S.notes.push({
        id: "p" + Date.now(),
        c: Object.keys(PC)[S.notes.length % 5],
        title: "",
        text: "",
        items: [],
        x: scrollX + (S.sbc ? 46 : 260) + 60 + k * 26,
        y: scrollY + 120 + k * 26,
      });
    },
    nco: () => {
      S.notes.find((x) => x.id === id).c = d;
    },
    ndel: () => {
      if (ui.nd === id) {
        S.notes = S.notes.filter((x) => x.id !== id);
        ui.nd = null;
      } else ui.nd = id;
    },
    nit: () => {
      S.notes.find((x) => x.id === id).items.push({ id: "i" + Date.now(), t: "", d: false });
    },
    nck: () => {
      const i = S.notes.find((x) => x.id === id).items.find((x) => x.id === d);
      i.d = !i.d;
    },
    nid: () => {
      const n = S.notes.find((x) => x.id === id);
      n.items = n.items.filter((x) => x.id !== d);
    },
    // ----- Acciones: Kanban [bloque 10] -----
    kadd: () => {
      const t = $("#kb-t").value.trim();
      if (!t) return;
      S.kb.push({ id: "k" + Date.now(), t, p: $("#kb-p").value, s: 0 });
    },
    kmv: () => {
      S.kb.find((x) => x.id === id).s = +d;
    },
    kdel: () => {
      S.kb = S.kb.filter((x) => x.id !== id);
    },
    kclr: () => {
      S.kb = S.kb.filter((x) => x.s !== 2);
    },
    // ----- Acciones: Biblioteca visual [bloque 11] -----
    sbt: () => {
      S.sbc = !S.sbc;
      ui.sd = true;
    },
    bopen: () => {
      const b = S.lib.find((x) => x.id === id);
      b.o = !b.o;
      document.querySelector(`.bk[data-id='${id}']`).classList.toggle("open", b.o);
    },
    bcol: () => {
      const b = S.lib.find((x) => x.id === id);
      b.c = LC[(LC.indexOf(b.c) + 1) % LC.length];
      ui.sd = true;
    },
    lcol: () => {
      ui.lc = +d;
      document.querySelectorAll(".ab .cd").forEach((x, i) => x.classList.toggle("cur", i === +d));
    },
    bnew: () => {
      S.lib.push({
        id: "l" + Date.now(),
        k: "b",
        p: null,
        n: $("#ab-n").value.trim() || "Libro nuevo",
        c: LC[ui.lc],
        o: true,
      });
      ui.sd = true;
    },
    snew: () => {
      S.lib.push({ id: "s" + Date.now(), k: "s", p: id, n: "Nueva sección" });
      ui.sd = true;
    },
    dnew: () => {
      const k = {
        id: "d" + Date.now(),
        k: "d",
        p: id,
        n: "Nuevo documento",
        x: "",
        cr: Date.now(),
        up: Date.now(),
      };
      S.lib.push(k);
      S.doc = k.id;
      showDoc();
      ui.sd = true;
    },
    dopen: () => {
      S.doc = id;
      showDoc();
      ui.sd = true;
    },
    ldel: () => {
      if (ui.ld !== id) {
        ui.ld = id;
        ui.sd = true;
        return;
      }
      const ids = new Set([id]);
      let c = true;
      while (c) {
        c = false;
        S.lib.forEach((n) => {
          if (n.p && ids.has(n.p) && !ids.has(n.id)) {
            ids.add(n.id);
            c = true;
          }
        });
      }
      S.lib.filter((n) => ids.has(n.id) && n.k === "f").forEach((n) => idb("del", n.id).catch(() => {}));
      S.lib = S.lib.filter((n) => !ids.has(n.id));
      if (ids.has(S.doc)) {
        S.doc = null;
        ui.pv = null;
      }
      ui.ld = null;
      ui.sd = true;
    },
    // ----- Acciones: Visor de PDF [bloque 12] -----
    pvp: () => pvGo(ui.pv.n - 1),
    pvn: () => pvGo(ui.pv.n + 1),
    pvf: () => {
      ui.pv.fit = true;
    },
    pvx: () => {
      ui.mx = !ui.mx;
    },
    pvz: () => {
      const v = ui.pv;
      v.scale = Math.min(4, Math.max(0.4, (v.cur || 1) + +d * 0.25));
      v.fit = false;
    },
    pvc: () => {
      S.doc = null;
      ui.pv = null;
      ui.mx = false;
      ui.sd = true;
    },
  };
  (A[a] || (() => {}))();
  save();
  render();
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.log) (S.log[t.dataset.log] = S.log[t.dataset.log] || {})[ui.day] = Math.max(0, +t.value || 0);
  else if (t.dataset.prog) S.events.find((x) => x.id === t.dataset.prog).prog = +t.value;
  else if (t.id === "g-m" || t.id === "g-p") sync();
  else if (t.dataset.lf === "t" || t.dataset.lf === "s") ui.sd = true;
  else if (t.dataset.pf) {
    addPdf(t.dataset.pf, t.files[0]);
    t.value = "";
  } else if (t.id === "pv-n") pvGo(+t.value);
  else return;
  save();
  render();
});
/* ==========================================================================
   BLOQUE 15: MOVER, TRAER AL FRENTE Y REDIMENSIONAR WIDGETS
   Arrastre por la barra del titulo (WD), traer al frente (front), asa .rz para redimensionar (RZ), doble clic restaura el tamano.
   ========================================================================== */
// Arrastrar widgets desde su barra de título y traerlos al frente al pulsarlos (los post-its quedan siempre por encima)
let WD = null;
const front = (id) => {
  S.zo = S.zo.filter((x) => x !== id).concat(id);
  document.querySelectorAll(".w").forEach((w) => {
    w.style.zIndex = S.zo.indexOf(w.dataset.id) + 1;
  });
};
document.addEventListener("pointerdown", (e) => {
  const w = e.target.closest(".w");
  if (!w) return;
  const id = w.dataset.id;
  if (S.zo[S.zo.length - 1] !== id) {
    front(id);
    save();
  }
  const h = e.target.closest(".wh");
  if (!h || e.target.closest("button") || !S.pos[id]) return;
  e.preventDefault();
  WD = { id, w, x: e.clientX, y: e.clientY, x0: S.pos[id].x, y0: S.pos[id].y };
  h.setPointerCapture(e.pointerId);
});
document.addEventListener("pointermove", (e) => {
  if (!WD) return;
  const p = S.pos[WD.id];
  p.x = Math.max(0, Math.min(DW() - WD.w.offsetWidth - 18, WD.x0 + e.clientX - WD.x));
  p.y = Math.max(0, WD.y0 + e.clientY - WD.y);
  WD.w.style.left = p.x + "px";
  WD.w.style.top = p.y + "px";
});
["pointerup", "pointercancel"].forEach((t) =>
  document.addEventListener(t, () => {
    if (WD) {
      WD = null;
      save();
      layout();
    }
  }),
);

// Redimensionar widgets: ancho y alto en píxeles
let RZ = null;
document.addEventListener("pointerdown", (e) => {
  const h = e.target.closest(".rz");
  if (!h) return;
  e.preventDefault();
  const w = h.parentElement,
    r = w.getBoundingClientRect();
  RZ = { id: h.dataset.id, w, x: e.clientX, y: e.clientY, w0: r.width, h0: r.height };
  h.setPointerCapture(e.pointerId);
});
document.addEventListener("pointermove", (e) => {
  if (!RZ) return;
  const wd = Math.max(300, Math.min(DW() - 36, Math.round(RZ.w0 + e.clientX - RZ.x))),
    h = Math.max(260, Math.round(RZ.h0 + e.clientY - RZ.y));
  RZ.w.style.width = wd + "px";
  RZ.w.style.height = h + "px";
  S.size[RZ.id] = { w: wd, h };
});
["pointerup", "pointercancel"].forEach((t) =>
  document.addEventListener(t, () => {
    if (RZ) {
      RZ = null;
      save();
      layout();
    }
  }),
);
document.addEventListener("dblclick", (e) => {
  const h = e.target.closest(".rz");
  if (!h) return;
  delete S.size[h.dataset.id];
  save();
  render();
});
/* ==========================================================================
   BLOQUE 16: ARRANQUE
   Pone la fecha en la cabecera y dibuja el escritorio por primera vez.
   ========================================================================== */
$("#dt").textContent = new Date().toLocaleDateString("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
/* ===== Dock IA: columna derecha reservada y desplegable ===== */
const AIDock = (() => {
  const KEY = 'aria:ai-dock';        // clave propia
  const HEADER_SEL = 'header';       // selector de tu cabecera (ajústalo si hace falta)
  const MIN = 300, MAX = 640;
  const root = document.documentElement;
  const dock = document.getElementById('ai-dock');
  const btn  = document.getElementById('ai-toggle');
  const grip = document.getElementById('ai-resize');

  let st = { open: false, w: 360 };
  try { Object.assign(st, JSON.parse(localStorage.getItem(KEY)) || {}); } catch {}

  const clamp = w => Math.min(Math.max(+w || 360, MIN), MAX, root.clientWidth * .6);
  const save  = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };
  // Recoloca los widgets cuando cambia el ancho útil (si existe layout())
  const relayout = () => { if (typeof layout === 'function') layout(); };

  function apply() {
    st.w = clamp(st.w);
    dock.classList.toggle('open', st.open);
    btn.setAttribute('aria-expanded', st.open);
    root.style.setProperty('--ai-w', st.w + 'px');
    root.style.setProperty('--ai-cur', st.open ? st.w + 'px' : 'var(--ai-tab)');
  }

  // El dock cuelga bajo la cabecera aunque ésta se vaya con el scroll
  let raf = 0;
  function place() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const h = document.querySelector(HEADER_SEL);
      root.style.setProperty('--ai-top', (h ? Math.max(0, h.getBoundingClientRect().bottom) : 0) + 'px');
    });
  }

  function set(open) { st.open = !!open; apply(); save(); }

  btn.addEventListener('click', () => set(!st.open));
  dock.addEventListener('transitionend', e => {
    if (e.target === dock && e.propertyName === 'width') relayout();
  });

  // Redimensionar arrastrando el borde izquierdo
  grip.addEventListener('pointerdown', e => {
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    root.classList.add('ai-dragging');
    const move = ev => { st.w = clamp(root.clientWidth - ev.clientX); apply(); };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      root.classList.remove('ai-dragging');
      save(); relayout();
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  });

  addEventListener('scroll', place, { passive: true });
  addEventListener('resize', () => { apply(); place(); });
  apply(); place();

  // API para cuando conectes la IA
  return {
    open: () => set(true), close: () => set(false), toggle: () => set(!st.open),
    messages: document.getElementById('ai-messages'),
  };
})();
render();
