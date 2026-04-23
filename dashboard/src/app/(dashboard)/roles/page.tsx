"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Shield, Loader2, X, Users, Pencil, Trash2, Save, Check } from "lucide-react";

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

const permissionLabels: Record<string, { label: string; desc: string }> = {
  "users:manage": { label: "Gerenciar Usuarios", desc: "Criar, editar e desativar usuarios" },
  "roles:manage": { label: "Gerenciar Roles", desc: "Criar, editar e excluir roles" },
  "alerts:create": { label: "Criar Alertas", desc: "Criar novas configuracoes de alerta" },
  "alerts:read": { label: "Ver Alertas", desc: "Visualizar alertas e historico" },
  "alerts:manage": { label: "Gerenciar Alertas", desc: "Editar, excluir e configurar alertas" },
  "groups:manage": { label: "Gerenciar Grupos", desc: "Criar e configurar grupos de bloqueio" },
  "groups:unlock": { label: "Desbloquear Grupos", desc: "Desbloquear grupos manualmente" },
  "logs:read": { label: "Ver Logs", desc: "Visualizar logs de auditoria" },
  "panel:read": { label: "Ver Painel", desc: "Acessar painel de alertas e tasks" },
  "settings:manage": { label: "Configuracoes", desc: "Gerenciar configuracoes do sistema" },
  "category:sportbook": { label: "Categoria Sportbook", desc: "Notificacoes e tasks de apostas esportivas" },
  "category:cassino": { label: "Categoria Cassino", desc: "Notificacoes e tasks de cassino" },
  "category:finance": { label: "Categoria Financeiro", desc: "Notificacoes e tasks de depositos e saques" },
  "category:blocks": { label: "Categoria Bloqueios", desc: "Notificacoes e tasks de grupos de bloqueio" },
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPermissions, setNewPermissions] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesData, permsData] = await Promise.all([
        api.fetch<Role[]>("/roles"),
        api.fetch<Permission[]>("/roles/permissions"),
      ]);
      setRoles(rolesData);
      setPermissions(permsData);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.fetch("/roles", {
        method: "POST",
        body: JSON.stringify({ name: newName, description: newDescription || undefined, permissionIds: newPermissions }),
      });
      setShowCreate(false);
      setNewName(""); setNewDescription(""); setNewPermissions([]);
      fetchData();
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  const startEdit = (role: Role) => {
    setEditingId(role.id);
    setEditName(role.name);
    setEditDescription(role.description || "");
    setEditPermissions(role.permissions.map((p) => p.id));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName(""); setEditDescription(""); setEditPermissions([]);
  };

  const handleSave = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await api.fetch(`/roles/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({ name: editName, description: editDescription || undefined, permissionIds: editPermissions }),
      });
      // Reload to propagate permission changes through AuthContext
      // (tabs, hasPermission checks, SSE reconnect with fresh state).
      window.location.reload();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta role? Ela so pode ser excluida se nao tiver usuarios vinculados.")) return;
    setDeletingId(id);
    try {
      await api.fetch(`/roles/${id}`, { method: "DELETE" });
      fetchData();
    } catch (err: any) {
      alert(err.message || "Erro ao excluir role");
    }
    finally { setDeletingId(null); }
  };

  const PermissionGrid = ({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {permissions.map((perm) => {
        const info = permissionLabels[perm.action];
        const active = selected.includes(perm.id);
        return (
          <label key={perm.id} className={`flex items-start gap-2.5 cursor-pointer rounded-xl border p-3 transition-all ${active ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/50 opacity-60"}`}>
            <input type="checkbox" checked={active} onChange={() => onToggle(perm.id)} className="h-4 w-4 mt-0.5 accent-primary rounded" />
            <div className="min-w-0">
              <p className="text-xs font-medium">{info?.label || perm.action}</p>
              {info?.desc && <p className="text-[10px] text-muted-foreground">{info.desc}</p>}
            </div>
          </label>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
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
        <Button onClick={() => setShowCreate(!showCreate)} className="rounded-xl gap-2">
          {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showCreate ? "Fechar" : "Nova Role"}
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardContent className="p-6">
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="flex items-center gap-2 text-foreground"><Shield className="h-5 w-5 text-violet-500" /><h2 className="text-lg font-semibold">Criar Nova Role</h2></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="Ex: Analista" className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Descricao</Label>
                  <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Opcional" className="h-11 rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Permissoes</Label>
                <PermissionGrid selected={newPermissions} onToggle={(id) => setNewPermissions((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])} />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={creating} className="rounded-xl gap-1.5">
                  {creating ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Criando...</> : <><Check className="h-3.5 w-3.5" />Criar Role</>}
                </Button>
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setShowCreate(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Roles List */}
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><span className="text-sm text-muted-foreground">Carregando...</span></div>
      ) : roles.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="flex flex-col items-center gap-3 py-16"><Shield className="h-8 w-8 text-muted-foreground" /><p className="font-medium">Nenhuma role encontrada</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {roles.map((role) => {
            const isEditing = editingId === role.id;
            return (
              <Card key={role.id} className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
                <CardContent className="p-6">
                  {isEditing ? (
                    /* ═══ Edit Mode ═══ */
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Nome</Label>
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-10 rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Descricao</Label>
                          <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="h-10 rounded-xl" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Permissoes</Label>
                        <PermissionGrid selected={editPermissions} onToggle={(id) => setEditPermissions((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])} />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="rounded-xl gap-1.5" onClick={handleSave} disabled={saving}>
                          {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvando...</> : <><Save className="h-3.5 w-3.5" />Salvar</>}
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-xl" onClick={cancelEdit}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    /* ═══ View Mode ═══ */
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                            <Shield className="h-4 w-4 text-violet-500" />
                          </div>
                          <h3 className="text-lg font-semibold text-foreground">{role.name}</h3>
                          <Badge variant="secondary" className="rounded-lg gap-1">
                            <Users className="h-3 w-3" />{role._count.users} usuarios
                          </Badge>
                        </div>
                        {role.description && <p className="text-sm text-muted-foreground pl-11">{role.description}</p>}
                        <div className="flex flex-wrap gap-1.5 pl-11">
                          {role.permissions.map((perm) => (
                            <Badge key={perm.id} variant="outline" className="rounded-lg text-xs">
                              {permissionLabels[perm.action]?.label || perm.action}
                            </Badge>
                          ))}
                          {role.permissions.length === 0 && <span className="text-xs text-muted-foreground">Sem permissoes</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="outline" size="sm" className="rounded-lg gap-1" onClick={() => startEdit(role)}>
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </Button>
                        {role._count.users === 0 && (
                          <Button variant="destructive" size="sm" className="rounded-lg" onClick={() => handleDelete(role.id)} disabled={deletingId === role.id}>
                            {deletingId === role.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
