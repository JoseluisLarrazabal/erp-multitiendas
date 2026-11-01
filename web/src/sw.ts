/// <reference lib="webworker" />
import { Serwist, type PrecacheEntry } from "serwist";
import { precacheGuardPlugin } from "./sw-precache-guard";

declare const self: ServiceWorkerGlobalScope & { __SW_MANIFEST: (PrecacheEntry | string)[] };

// Solo precache (shell de /pos, chunks y CSS). Sin runtimeCaching: auth, Supabase y /panel pasan a la red.
// skipWaiting apagado a propósito: una versión nueva espera a que se cierre la pestaña del POS, así una
// venta a medias nunca cambia de JS/HTML bajo los pies. Con eso una actualización solo se activa sin
// clientes, así que clientsClaim solo afecta a la primera instalación: deja controlada esa primera
// pestaña sin recargar. Ver docs/stack.md.
new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: { plugins: [precacheGuardPlugin] },
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: false,
}).addEventListeners();
