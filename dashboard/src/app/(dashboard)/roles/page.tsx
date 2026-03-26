"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Shield, Loader2, X, Users } from "lucide-react";

interface Permission {
  id: string;
  action: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  _count: { users: number };
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPermissions, setNewPermissions] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesData, permsData] = await Promise.all([
        api.fetch<Role[]>("/roles"),
        api.fetch<Permission[]>("/roles/permissions"),
      ]);
      setRoles(rolesData);
      setPermissions(permsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.fetch("/roles", {
        method: "POST",
        body: JSON.stringify({
          name: newName,
          description: newDescription || undefined,
          permissionIds: newPermissions,
        }),
      });
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      setNewPermissions([]);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const togglePermission = (id: string) => {
    setNewPermissions((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
            <Shield className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Roles e Permissoes</h1>
            <p className="text-sm text-muted-foreground">Gerencie roles e permissoes de acesso</p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-xl gap-2 shadow-sm transition-all duration-200 hover:shadow-md"
        >
          {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showCreate ? "Fechar" : "Nova Role"}
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-foreground">Criar Nova Role</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateRole} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Nome</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    placeholder="Ex: Editor"
                    className="h-11 rounded-xl border-border/60 bg-background/50 text-foreground transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Descricao</Label>
                  <Input
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Descricao opcional"
                    className="h-11 rounded-xl border-border/60 bg-background/50 text-foreground transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-medium text-foreground">Permissoes</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {permissions.map((perm) => (
                    <label
                      key={perm.id}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-all duration-200 ${
                        newPermissions.includes(perm.id)
                          ? "border-primary/30 bg-primary/5 text-foreground"
                          : "border-border/50 bg-background/30 text-muted-foreground hover:border-border hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={newPermissions.includes(perm.id)}
                        onChange={() => togglePermission(perm.id)}
                        className="h-4 w-4 rounded accent-primary"
                      />
                      {perm.action}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl shadow-sm transition-all duration-200 hover:shadow-md"
                >
                  {creating ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Criando...
                    </span>
                  ) : (
                    "Criar Role"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setShowCreate(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Roles List */}
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Carregando...</span>
        </div>
      ) : roles.length === 0 ? (
        <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm backdrop-blur-sm">
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">Nenhuma role encontrada</p>
            <p className="text-sm text-muted-foreground">Crie a primeira role para comecar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {roles.map((role) => (
            <Card
              key={role.id}
              className="group rounded-2xl border-border/50 bg-card/80 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                        <Shield className="h-4 w-4 text-violet-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">{role.name}</h3>
                      <Badge variant="secondary" className="rounded-lg gap-1">
                        <Users className="h-3 w-3" />
                        {role._count.users} usuarios
                      </Badge>
                    </div>
                    {role.description && (
                      <p className="text-sm text-muted-foreground pl-11">
                        {role.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 pl-11">
                      {role.permissions.map((perm) => (
                        <Badge key={perm.id} variant="outline" className="rounded-lg text-xs font-normal">
                          {perm.action}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
