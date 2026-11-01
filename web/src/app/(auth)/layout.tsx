import { Sparkles } from "lucide-react";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-2.5 text-[19px] font-bold tracking-tight">
        <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-lg">
          <Sparkles className="size-[17px]" aria-hidden />
        </span>
        ERP Multitiendas
      </div>
      <div className="bg-card w-full max-w-sm rounded-xl border p-6 shadow-[0_2px_5px_#34345a0d] sm:p-8">
        {children}
      </div>
    </main>
  );
}
