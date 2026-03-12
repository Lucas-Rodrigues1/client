import { getToken, removeToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function DashboardPage() {
  const token = getToken();

  const handleLogout = () => {
    removeToken();
    // Redirecionar para login seria feito via client component
  };

  return (
    <div className="min-h-svh bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-card border border-border rounded-lg p-8">
          <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
          <p className="text-foreground/70 mb-6">
            Bem-vindo ao seu painel! Você está autenticado com sucesso.
          </p>

          {token && (
            <div className="bg-secondary/50 border border-border rounded p-4 mb-6">
              <p className="text-sm font-mono text-foreground/60">
                Token: {token.substring(0, 50)}...
              </p>
            </div>
          )}

          <Link href="/login">
            <Button variant="outline" className="cursor-pointer">
              Voltar para Login
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
