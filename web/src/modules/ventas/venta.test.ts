import { describe, expect, it } from "vitest";
import { construirNota, construirPayload, type DatosEnvio } from "./venta";
import type { ResumenCarrito } from "./carrito";

const uuid = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const resumen = {
  error: null,
  totales: { subtotal: 8000, sumaLineas: 8000, total: 8000 },
  lineas: [
    {
      linea: {
        producto: { id: uuid(4), nombre: "P", codigo: "C", garantiaMeses: null },
        lista: "contado",
        serieId: null,
        serieTexto: null,
      },
      entrada: { cantidadMilesimas: 1000, precio: 8000, descuento: 0 },
    },
  ],
} as unknown as ResumenCarrito;
const datos: DatosEnvio = {
  ventaId: uuid(1),
  dispositivoId: uuid(2),
  cajaId: uuid(3),
  numero: "C1-000001",
  clienteId: null,
  creadaEnCliente: "2026-11-01T10:00:00.000Z",
  descuentoVentaTexto: "",
  efectivo: 0,
  qr: 8000,
  qrVerificado: false,
};

describe("QR pendiente de verificar", () => {
  it("el payload lleva verificado:false y la nota lo marca pendiente", () => {
    expect(construirPayload(resumen, datos)?.pagos).toEqual([
      { medio: "qr", monto: 80, verificado: false },
    ]);
    const nota = construirNota(resumen, datos, {
      negocio: { nombre: "N", nit: null, datosNota: null },
      vendedor: "V",
      cliente: null,
      recibido: 0,
    });
    expect(nota?.pagos).toEqual([{ medio: "qr", monto: 8000, pendiente: true }]);
  });

  it("confirmado conserva verificado:true y la nota no lo marca", () => {
    const d = { ...datos, qrVerificado: true };
    expect(construirPayload(resumen, d)?.pagos[0]).toMatchObject({ verificado: true });
    expect(
      construirNota(resumen, d, {
        negocio: { nombre: "N", nit: null, datosNota: null },
        vendedor: "V",
        cliente: null,
        recibido: 0,
      })?.pagos[0],
    ).not.toHaveProperty("pendiente");
  });
});
