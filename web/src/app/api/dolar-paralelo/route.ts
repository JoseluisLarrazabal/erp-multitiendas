import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obtenerParalelo } from "@/modules/catalogo/panel";

// RF-CAT-12. El proxy no redirige /api: aquí se exige sesión y se responde 401 JSON. Siempre 200 si hay sesión,
// aunque paralelo.bo falle.
export async function GET() {
  const { data } = await (await createClient()).auth.getClaims();
  if (!data?.claims) return NextResponse.json({ error: "sin sesión" }, { status: 401 });
  return NextResponse.json(await obtenerParalelo(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
