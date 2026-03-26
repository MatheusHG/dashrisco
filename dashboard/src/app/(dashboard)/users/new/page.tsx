"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, ArrowLeft, AlertCircle } from "lucide-react";

interface Role {
  id: string;
  name: string;
}

export default function NewUserPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    roleId: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.fetch<Role[]>("/roles").then(setRoles).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.fetch("/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      router.push("/users");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar usuario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/users")}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-card/80 text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
            <UserPlus className="h-5 w-5 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Novo Usuario</h1>
            <p className="text-sm text-muted-foreground">Preencha os dados para criar um usuario</p>
          </div>
        </div>
      </div>

      <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-foreground">Nome</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Nome completo"
                className="h-11 rounded-xl border-border/60 bg-background/50 text-foreground transition-all duration-200 focus:bg-background focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                placeholder="usuario@email.com"
                className="h-11 rounded-xl border-border/60 bg-background/50 text-foreground transition-all duration-200 focus:bg-background focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">Senha</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
                placeholder="Minimo 6 caracteres"
                className="h-11 rounded-xl border-border/60 bg-background/50 text-foreground transition-all duration-200 focus:bg-background focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role" className="text-sm font-medium text-foreground">Role</Label>
              <select
                id="role"
                className="flex h-11 w-full rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground transition-all duration-200 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={form.roleId}
                onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                required
              >
                <option value="">Selecione uma role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="rounded-xl shadow-sm transition-all duration-200 hover:shadow-md"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Criando...
                  </span>
                ) : (
                  "Criar Usuario"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => router.push("/users")}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
