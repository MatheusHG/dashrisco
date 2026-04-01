"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Pencil, AlertCircle, Key } from "lucide-react";

interface Role {
  id: string;
  name: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  active: boolean;
  role: { id: string; name: string };
}

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [active, setActive] = useState(true);

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");

  const fetchUser = useCallback(async () => {
    try {
      const [user, rolesData] = await Promise.all([
        api.fetch<UserData>(`/users/${userId}`),
        api.fetch<Role[]>("/roles"),
      ]);
      setName(user.name);
      setEmail(user.email);
      setRoleId(user.role.id);
      setActive(user.active);
      setRoles(rolesData);
    } catch (err) {
      setError("Erro ao carregar usuario");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleSave = async () => {
    setError("");
    setSuccessMsg("");
    setSaving(true);
    try {
      await api.fetch(`/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ name, email, roleId, active }),
      });
      setSuccessMsg("Usuario atualizado com sucesso");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) return;
    setPasswordMsg("");
    setSavingPassword(true);
    try {
      await api.fetch(`/users/${userId}/password`, {
        method: "PUT",
        body: JSON.stringify({ password: newPassword }),
      });
      setNewPassword("");
      setPasswordMsg("Senha alterada com sucesso");
      setTimeout(() => setPasswordMsg(""), 3000);
    } catch (err) {
      setPasswordMsg(err instanceof Error ? err.message : "Erro ao alterar senha");
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/users")}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-card/80 text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
          <Pencil className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Editar Usuario</h1>
          <p className="text-sm text-muted-foreground">Altere os dados do usuario</p>
        </div>
      </div>

      {/* Basic Info */}
      <Card className="rounded-2xl border-border/50 shadow-sm">
        <CardContent className="p-6 space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl border-border/60 bg-background/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl border-border/60 bg-background/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Role</Label>
            <select
              className="flex h-11 w-full rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Status</Label>
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center justify-center gap-2 cursor-pointer rounded-xl border p-3 transition-all ${active ? "border-green-500 bg-green-500/10" : "border-border/50 hover:bg-muted/50"}`}>
                <input type="radio" checked={active} onChange={() => setActive(true)} className="accent-green-500" />
                <span className="text-sm font-medium">Ativo</span>
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 cursor-pointer rounded-xl border p-3 transition-all ${!active ? "border-red-500 bg-red-500/10" : "border-border/50 hover:bg-muted/50"}`}>
                <input type="radio" checked={!active} onChange={() => setActive(false)} className="accent-red-500" />
                <span className="text-sm font-medium">Inativo</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          {successMsg && (
            <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400">
              {successMsg}
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving || !name || !email} className="rounded-xl">
              {saving ? "Salvando..." : "Salvar Alteracoes"}
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => router.push("/users")}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card className="rounded-2xl border-border/50 shadow-sm">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Alterar Senha</p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Nova Senha</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimo 6 caracteres"
              className="h-11 rounded-xl border-border/60 bg-background/50"
            />
          </div>
          {passwordMsg && (
            <p className={`text-sm ${passwordMsg.includes("Erro") ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
              {passwordMsg}
            </p>
          )}
          <Button
            variant="outline"
            onClick={handlePasswordChange}
            disabled={savingPassword || newPassword.length < 6}
            className="rounded-xl"
          >
            {savingPassword ? "Alterando..." : "Alterar Senha"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
