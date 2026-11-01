import type { Metadata } from "next";
import { LoginForm } from "@/modules/usuarios";

export const metadata: Metadata = { title: "Iniciar sesión · ERP Multitiendas" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Iniciar sesión</h1>
      <p className="text-muted-foreground mt-2 mb-6 text-sm">
        Ingresa con la cuenta que te dio tu administrador.
      </p>
      <LoginForm />
    </>
  );
}
