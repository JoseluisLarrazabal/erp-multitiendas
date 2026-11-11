"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BotonImprimirPlan() {
  return (
    <Button type="button" variant="outline" className="self-start" onClick={() => window.print()}>
      <Printer aria-hidden /> Imprimir plan
    </Button>
  );
}
