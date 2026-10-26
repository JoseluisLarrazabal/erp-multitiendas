// Autochequeo sin dependencias: node formularios/apps-script/test-mock.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const codigo = fs.readFileSync(path.join(aqui, 'formulario-lider.gs'), 'utf8');

// Objeto encadenable: métodos propios en `own`, el resto registra y devuelve el mismo objeto.
function stub(own = {}) {
  const self = new Proxy({}, {
    get(_, p) {
      if (typeof p === 'symbol' || p === 'then') return undefined;
      if (p in own) return (...a) => own[p].apply(self, a);
      if (/^get(Edit|Published|)Url$|^getId$/.test(p)) return () => `https://stub/${p}`;
      return () => self;
    },
  });
  return self;
}

const items = []; // preguntas y secciones, en orden de creación
const logs = [];
const planillas = [];
const formState = { descripcion: '', destino: null, flags: {} };
let seccionActual = '(intro)';

function itemStub(tipo) {
  const rec = { tipo, titulo: undefined, seccion: seccionActual, obligatoria: false, otro: false };
  items.push(rec);
  return stub({
    setTitle(t) {
      rec.titulo = t;
      if (tipo === 'seccion') seccionActual = t;
      return this;
    },
    setRequired(v) { rec.obligatoria = v; return this; },
    showOtherOption(v) { rec.otro = v; return this; },
    setChoiceValues(v) { rec.opciones = v; return this; },
    setRows(v) { rec.filas = v; return this; },
    setColumns(v) { rec.columnas = v; return this; },
  });
}

function hojaStub(nombre) {
  const h = { nombre, validaciones: 0, congelada: 0, notas: 0, rangoCategorias: false };
  const rango = () => stub({
    setDataValidation() { h.validaciones++; return this; },
    setNote() { h.notas++; return this; },
  });
  h.api = stub({
    setName(n) { h.nombre = n; return this; },
    getName() { return h.nombre; },
    setFrozenRows(n) { h.congelada = n; return this; },
    getRange() { return rango(); },
  });
  return h;
}

const FormApp = {
  DestinationType: { SPREADSHEET: 'SPREADSHEET' },
  create(titulo) {
    formState.titulo = titulo;
    return stub({
      setDescription(d) { formState.descripcion = d; return this; },
      setProgressBar(v) { formState.flags.progreso = v; return this; },
      setAllowResponseEdits(v) { formState.flags.edicion = v; return this; },
      setCollectEmail(v) { formState.flags.correo = v; return this; },
      setConfirmationMessage(m) { formState.confirmacion = m; return this; },
      setDestination(tipo, id) { formState.destino = [tipo, id]; return this; },
      addPageBreakItem: () => itemStub('seccion'),
      addTextItem: () => itemStub('texto'),
      addParagraphTextItem: () => itemStub('parrafo'),
      addMultipleChoiceItem: () => itemStub('opcion'),
      addCheckboxItem: () => itemStub('casillas'),
      addListItem: () => itemStub('lista'),
      addCheckboxGridItem: () => itemStub('grillaCasillas'),
      addDateItem: () => itemStub('fecha'),
    });
  },
};

const SpreadsheetApp = {
  newDataValidation: () => stub(),
  create(nombre) {
    const hojas = [hojaStub('Hoja 1')];
    planillas.push({ nombre, hojas });
    return stub({
      getSheets: () => hojas.map((h) => h.api),
      insertSheet(n) { const h = hojaStub(n); hojas.push(h); return h.api; },
      getSheetByName: (n) => hojas.find((h) => h.nombre === n)?.api,
    });
  },
};

const Logger = { log: (m) => logs.push(String(m)) };

const ctx = vm.createContext({ FormApp, SpreadsheetApp, Logger });
vm.runInContext(codigo, ctx, { filename: 'formulario-lider.gs' });
assert.doesNotThrow(() => vm.runInContext('crearTodoLider()', ctx));

const preguntas = items.filter((i) => i.tipo !== 'seccion');
const secciones = items.filter((i) => i.tipo === 'seccion');

// Estructura
assert.ok(secciones.length >= 12, `secciones: ${secciones.length}`);
assert.ok(preguntas.length >= 80, `preguntas: ${preguntas.length}`);
for (const i of items) assert.ok(i.titulo && i.titulo.trim(), `título vacío en ${i.tipo} de "${i.seccion}"`);
for (const s of secciones) {
  const titulos = preguntas.filter((p) => p.seccion === s.titulo).map((p) => p.titulo);
  assert.equal(new Set(titulos).size, titulos.length, `títulos duplicados en "${s.titulo}"`);
  assert.ok(titulos.length > 0, `sección sin preguntas: "${s.titulo}"`);
}
for (const p of preguntas) {
  if (['opcion', 'casillas', 'lista'].includes(p.tipo)) assert.ok(p.opciones?.length, `sin opciones: ${p.titulo}`);
  if (p.tipo === 'grillaCasillas') assert.ok(p.filas?.length && p.columnas?.length, `grilla incompleta: ${p.titulo}`);
}
assert.ok(preguntas.some((p) => p.tipo === 'grillaCasillas'), 'falta la grilla de permisos');
assert.ok(preguntas.some((p) => p.tipo === 'fecha'), 'falta la fecha del conteo inicial');

// Última pregunta: confirmación obligatoria
const ultima = preguntas.at(-1);
assert.equal(ultima.tipo, 'casillas');
assert.equal(ultima.obligatoria, true);
assert.match(ultima.opciones[0], /correcta y completa a la fecha/);

// Secciones opcionales
for (const t of ['Crédito y cuotas', 'Entregas e instalación']) {
  assert.ok(secciones.some((s) => s.titulo.includes(t)), `falta sección ${t}`);
}

// Formulario
assert.deepEqual(formState.flags, { progreso: true, edicion: true, correo: true });
assert.ok(formState.confirmacion);
assert.equal(formState.destino[0], 'SPREADSHEET');
assert.ok(formState.descripcion.includes('https://stub/getUrl'), 'la descripción no trae el link de la planilla');

// Planilla de carga
const carga = planillas.find((p) => p.nombre.includes('Datos iniciales'));
assert.ok(carga, 'no se creó la planilla de carga');
assert.deepEqual(
  carga.hojas.map((h) => h.nombre),
  ['Instrucciones', 'Productos', 'Números de serie', 'Clientes', 'Usuarios', 'Categorías'],
);
assert.ok(!carga.hojas.some((h) => /^(Sheet|Hoja) ?1$/.test(h.nombre)), 'quedó la hoja por defecto');
for (const h of carga.hojas.slice(1)) assert.equal(h.congelada, 1, `fila 1 sin congelar en ${h.nombre}`);
const prod = carga.hojas.find((h) => h.nombre === 'Productos');
assert.ok(prod.validaciones >= 10, `validaciones en Productos: ${prod.validaciones}`);
assert.ok(planillas.some((p) => p.nombre.includes('Respuestas formulario')), 'falta la planilla de respuestas');

// Logger: 4 URLs
assert.equal(logs.length, 4);
for (const [i, re] of [/getEditUrl/, /getPublishedUrl/, /getUrl/, /getUrl/].entries()) assert.match(logs[i], re);

// Resumen
console.log('Preguntas por sección:');
for (const s of secciones) console.log(`  ${String(preguntas.filter((p) => p.seccion === s.titulo).length).padStart(3)}  ${s.titulo}`);
console.log(`Secciones (page breaks): ${secciones.length}`);
console.log(`Total de preguntas: ${preguntas.length}`);
console.log(`Pestañas de la planilla: ${carga.hojas.map((h) => h.nombre).join(', ')}`);
console.log('OK');
