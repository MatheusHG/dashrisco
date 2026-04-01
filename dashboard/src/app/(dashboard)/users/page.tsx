"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Users, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";

interface User {
  id: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: string;
  role: { id: string; name: string };
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.fetch<{ users: User[] }>(
        `/users?search=${search}`
      );
      setUsers(data.users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
            <Users className="h-5 w-5 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Usuarios</h1>
            <p className="text-sm text-muted-foreground">Gerencie os usuarios do sistema</p>
          </div>
        </div>
        <Link href="/users/new">
          <Button className="rounded-xl gap-2 shadow-sm transition-all duration-200 hover:shadow-md">
            <Plus className="h-4 w-4" /> Novo Usuario
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou email..."
          className="h-11 rounded-xl border-border/60 bg-card/80 pl-10 backdrop-blur-sm transition-all duration-200 focus:bg-background focus:shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Criado em</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Carregando...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                        <Users className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Nenhum usuario encontrado</p>
                        <p className="text-sm text-muted-foreground">Tente ajustar sua busca ou crie um novo usuario</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user, i) => (
                  <tr
                    key={user.id}
                    className={`transition-colors duration-150 hover:bg-muted/40 ${i % 2 === 0 ? "" : "bg-muted/15"}`}
                  >
                    <td className="px-6 py-4 font-medium text-foreground">{user.name}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{user.email}</td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className="rounded-lg">{user.role.name}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={user.active ? "success" : "destructive"} className="rounded-lg">
                        {user.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link href={`/users/${user.id}/edit`}>
                          <Button variant="outline" size="sm" className="rounded-lg transition-all duration-200 hover:shadow-sm">
                            Editar
                          </Button>
                        </Link>
                        {user.active && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="rounded-lg"
                            onClick={async () => {
                              if (!confirm(`Desativar usuario "${user.name}"?`)) return;
                              try {
                                await api.fetch(`/users/${user.id}`, { method: "DELETE" });
                                fetchUsers();
                              } catch (err) { console.error(err); }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
