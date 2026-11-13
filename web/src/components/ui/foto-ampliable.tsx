"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  url: string;
  nombre: string;
  // La miniatura; `className` da forma al botón que la envuelve.
  children: React.ReactNode;
  className?: string;
};

export function FotoAmpliable({ url, nombre, children, className }: Props) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        type="button"
        aria-label={`Ampliar foto de ${nombre}`}
        className={cn(
          "focus-visible:ring-ring cursor-zoom-in outline-none focus-visible:ring-3",
          className,
        )}
      >
        {children}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 bg-foreground/40 fixed inset-0 isolate z-50 duration-100 supports-backdrop-filter:backdrop-blur-xs motion-reduce:duration-0" />
        <Dialog.Popup className="bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-max max-w-[90vw] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl p-3 ring-1 duration-100 outline-none motion-reduce:duration-0">
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="min-w-0 truncate text-base font-medium">{nombre}</Dialog.Title>
            <Dialog.Close render={<Button variant="outline" />}>
              <X aria-hidden />
              Cerrar
            </Dialog.Close>
          </div>
          {/* URL firmada con vencimiento: no pasa por el optimizador de next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`Foto de ${nombre}`}
            className="max-h-[min(70dvh,40rem)] min-h-48 max-w-[min(84vw,40rem)] min-w-48 rounded-lg object-contain"
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
