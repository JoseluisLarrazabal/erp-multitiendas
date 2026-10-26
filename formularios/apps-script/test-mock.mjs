// Autochequeo sin dependencias: node formularios/apps-script/test-mock.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const codigo = fs.readFileSync(path.join(aqui, 'relevamiento.gs'), 'utf8');

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

// Corre un entry point en un contexto y stubs nuevos; devuelve lo que registraron.
function ejecutar(entry) {
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
    const h = { nombre, validaciones: 0, congelada: 0, eventos: [] };
    const rango = (args) => stub({
      setDataValidation() { h.validaciones++; return this; },
      setNumberFormat(f) { h.eventos.push({ op: 'formato', f, fila: args[0] }); return this; },
      setValues() { h.eventos.push({ op: 'valores', fila: args[0] }); return this; },
    });
    h.api = stub({
      setName(n) { h.nombre = n; return this; },
      getName() { return h.nombre; },
      setFrozenRows(n) { h.congelada = n; return this; },
      getRange(...args) { return rango(args); },
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
  vm.runInContext(codigo, ctx, { filename: 'relevamiento.gs' });
  assert.doesNotThrow(() => vm.runInContext(`${entry}()`, ctx), entry);
  return { items, logs, planillas, formState };
}

// Qué debe producir cada entry point. Lider: conteos exactos (su form ya está publicado).
const negocios = [
  {
    entry: 'crearTodoLavanderia', nombre: 'Lavandería', minPreguntas: 80, minSecciones: 9, tresNegocios: false,
    hojas: ['Instrucciones', 'Servicios', 'Clientes', 'Órdenes pendientes', 'Usuarios'],
    validaciones: { Servicios: 3, Clientes: 2, 'Órdenes pendientes': 3 },
    conFormatoTexto: ['Servicios', 'Clientes', 'Órdenes pendientes'],
  },
  {
    entry: 'crearTodoFrial', nombre: 'Frial', minPreguntas: 80, minSecciones: 8, tresNegocios: false,
    hojas: ['Instrucciones', 'Productos', 'Lotes', 'Clientes', 'Proveedores', 'Usuarios', 'Categorías'],
    validaciones: { Productos: 9, Lotes: 1, Clientes: 2, Proveedores: 1 },
    conFormatoTexto: ['Productos', 'Lotes', 'Clientes', 'Proveedores'],
  },
  {
    entry: 'crearTodoLider_YA_EJECUTADO', nombre: 'Multitienda Lider', exactas: 104, exactasSecciones: 12, tresNegocios: true,
    hojas: ['Instrucciones', 'Productos', 'Números de serie', 'Clientes', 'Usuarios', 'Categorías'],
    validaciones: { Productos: 10, Clientes: 1 },
    conFormatoTexto: ['Productos'],
  },
];

// Cada validación apunta a una columna que existe (si no, Google falla a mitad de ejecución).
{
  const ctx = vm.createContext({});
  vm.runInContext(codigo, ctx, { filename: 'relevamiento.gs' });
  for (const nombre of ['HOJAS_CARGA', 'HOJAS_LAVANDERIA', 'HOJAS_FRIAL']) {
    for (const h of vm.runInContext(nombre, ctx)) {
      for (const v of h.validaciones || []) {
        assert.ok(h.columnas.includes(v.columna), `${nombre}/${h.nombre}: columna inexistente "${v.columna}"`);
      }
    }
  }
}

for (const n of negocios) {
  const { items, logs, planillas, formState } = ejecutar(n.entry);
  const preguntas = items.filter((i) => i.tipo !== 'seccion');
  const secciones = items.filter((i) => i.tipo === 'seccion');
  const ctxMsg = `[${n.entry}]`;

  // Estructura
  if (n.exactas) {
    assert.equal(preguntas.length, n.exactas, `${ctxMsg} preguntas`);
    assert.equal(secciones.length, n.exactasSecciones, `${ctxMsg} secciones`);
  } else {
    assert.ok(preguntas.length >= n.minPreguntas, `${ctxMsg} preguntas: ${preguntas.length}`);
    assert.ok(secciones.length >= n.minSecciones, `${ctxMsg} secciones: ${secciones.length}`);
  }
  for (const i of items) assert.ok(i.titulo && i.titulo.trim(), `${ctxMsg} título vacío en ${i.tipo} de "${i.seccion}"`);
  for (const s of secciones) {
    const titulos = preguntas.filter((p) => p.seccion === s.titulo).map((p) => p.titulo);
    assert.equal(new Set(titulos).size, titulos.length, `${ctxMsg} títulos duplicados en "${s.titulo}"`);
    assert.ok(titulos.length > 0, `${ctxMsg} sección sin preguntas: "${s.titulo}"`);
  }
  assert.equal(new Set(secciones.map((s) => s.titulo)).size, secciones.length, `${ctxMsg} secciones repetidas`);
  secciones.forEach((s, i) => assert.ok(s.titulo.startsWith(`${i + 1}. `), `${ctxMsg} numeración: "${s.titulo}"`));
  for (const p of preguntas) {
    if (['opcion', 'casillas', 'lista'].includes(p.tipo)) assert.ok(p.opciones?.length, `${ctxMsg} sin opciones: ${p.titulo}`);
    if (p.tipo === 'grillaCasillas') assert.ok(p.filas?.length && p.columnas?.length, `${ctxMsg} grilla incompleta: ${p.titulo}`);
  }
  assert.ok(preguntas.some((p) => p.tipo === 'grillaCasillas'), `${ctxMsg} falta la grilla de permisos`);
  assert.ok(preguntas.some((p) => p.tipo === 'fecha') === (n.entry !== 'crearTodoLavanderia'), `${ctxMsg} fecha del conteo inicial`);

  // "Los 3 negocios juntos": solo en Lider
  assert.equal(secciones.some((s) => s.titulo.includes('3 negocios juntos')), n.tresNegocios, `${ctxMsg} sección 3 negocios`);

  // Última pregunta: confirmación obligatoria
  const ultima = preguntas.at(-1);
  assert.equal(ultima.tipo, 'casillas');
  assert.equal(ultima.obligatoria, true);
  assert.match(ultima.opciones[0], /correcta y completa a la fecha/);

  // Secciones opcionales de Lider
  if (n.tresNegocios) {
    for (const t of ['Crédito y cuotas', 'Entregas e instalación']) {
      assert.ok(secciones.some((s) => s.titulo.includes(t)), `falta sección ${t}`);
    }
  }

  // Formulario
  assert.ok(formState.titulo.startsWith(n.nombre), `${ctxMsg} título del form: ${formState.titulo}`);
  assert.deepEqual(formState.flags, { progreso: true, edicion: true, correo: true });
  assert.ok(formState.confirmacion);
  assert.equal(formState.destino[0], 'SPREADSHEET');
  assert.ok(formState.descripcion.includes('https://stub/getUrl'), `${ctxMsg} la descripción no trae el link de la planilla`);

  // Planilla de carga
  const carga = planillas.find((p) => p.nombre.includes('Datos iniciales'));
  assert.ok(carga, `${ctxMsg} no se creó la planilla de carga`);
  assert.ok(carga.nombre.startsWith(n.nombre), `${ctxMsg} nombre de la planilla: ${carga.nombre}`);
  assert.deepEqual(carga.hojas.map((h) => h.nombre), n.hojas);
  assert.ok(!carga.hojas.some((h) => /^(Sheet|Hoja) ?1$/.test(h.nombre)), `${ctxMsg} quedó la hoja por defecto`);
  for (const h of carga.hojas.slice(1)) assert.equal(h.congelada, 1, `${ctxMsg} fila 1 sin congelar en ${h.nombre}`);
  for (const [hoja, min] of Object.entries(n.validaciones)) {
    const h = carga.hojas.find((x) => x.nombre === hoja);
    assert.ok(h.validaciones >= min, `${ctxMsg} validaciones en ${hoja}: ${h.validaciones}`);
  }
  // Formato texto (@) antes de escribir ejemplos
  for (const h of carga.hojas) {
    const iFormato = h.eventos.findIndex((e) => e.op === 'formato');
    const iEjemplos = h.eventos.findIndex((e) => e.op === 'valores' && e.fila === 2);
    assert.equal(iFormato >= 0, n.conFormatoTexto.includes(h.nombre), `${ctxMsg} formato texto en ${h.nombre}`);
    if (iFormato >= 0 && iEjemplos >= 0) assert.ok(iFormato < iEjemplos, `${ctxMsg} ${h.nombre}: @ después de los ejemplos`);
  }
  assert.ok(planillas.some((p) => p.nombre.includes('Respuestas formulario') && p.nombre.startsWith(n.nombre)), `${ctxMsg} falta la planilla de respuestas`);

  // Logger: 4 URLs
  assert.equal(logs.length, 4);
  for (const [i, re] of [/getEditUrl/, /getPublishedUrl/, /getUrl/, /getUrl/].entries()) assert.match(logs[i], re);

  // Resumen
  console.log(`\n== ${n.entry} ==`);
  console.log('Preguntas por sección:');
  for (const s of secciones) console.log(`  ${String(preguntas.filter((p) => p.seccion === s.titulo).length).padStart(3)}  ${s.titulo}`);
  console.log(`Secciones (page breaks): ${secciones.length}`);
  console.log(`Total de preguntas: ${preguntas.length}`);
  console.log(`Pestañas de la planilla: ${carga.hojas.map((h) => h.nombre).join(', ')}`);
}
console.log('\nOK');
