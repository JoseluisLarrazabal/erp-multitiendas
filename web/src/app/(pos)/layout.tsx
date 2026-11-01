import { SerwistProvider } from "@serwist/turbopack/react";

// El service worker se registra solo desde /pos. Con reloadOnOnline el paquete recarga la página
// al volver la red; en un POS con venta a medias eso pierde el formulario, así que va apagado.
export default function PosLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SerwistProvider
      swUrl="/sw-pos/sw.js"
      options={{ scope: "/pos", type: "classic" }}
      cacheOnNavigation={false}
      reloadOnOnline={false}
    >
      {children}
    </SerwistProvider>
  );
}
