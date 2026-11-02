import { describe, expect, it, vi } from "vitest";
import { alCambiarControlador } from "./sw-controlador";

function falso(conControlador: boolean) {
  const et = new EventTarget();
  const sw = Object.assign(et, { controller: conControlador ? ({} as ServiceWorker) : null });
  return {
    sw: sw as unknown as ServiceWorkerContainer,
    cambiar: () => et.dispatchEvent(new Event("controllerchange")),
  };
}

describe("alCambiarControlador", () => {
  it("con controlador previo, cada cambio es una actualización", () => {
    const { sw, cambiar } = falso(true);
    const aviso = vi.fn();
    alCambiarControlador(sw, aviso);
    cambiar();
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it("sin controlador previo, el primer cambio es la instalación y el segundo ya es una actualización", () => {
    const { sw, cambiar } = falso(false);
    const aviso = vi.fn();
    alCambiarControlador(sw, aviso);
    cambiar();
    expect(aviso).not.toHaveBeenCalled();
    cambiar();
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it("sin controlador previo, si esta pestaña pidió la actualización el primer cambio ya la aplica", () => {
    const { sw, cambiar } = falso(false);
    const aviso = vi.fn();
    alCambiarControlador(sw, aviso, () => true);
    cambiar();
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it("al desmontar deja de escuchar", () => {
    const { sw, cambiar } = falso(true);
    const aviso = vi.fn();
    alCambiarControlador(sw, aviso)();
    cambiar();
    expect(aviso).not.toHaveBeenCalled();
  });
});
