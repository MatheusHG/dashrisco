"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getFieldLabel, formatCurrency, parseCurrency } from "@/lib/field-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Lock, ArrowLeft, ArrowRight, AlertCircle, Timer, Zap, Plus, X, Clock,
  Bell, MessageSquare, Check, Pencil, CheckCircle, Loader2,
} from "lucide-react";

const BET_TYPES = [
  { value: "SPORT_BET", label: "Aposta Esportiva", icon: "🏀" },
  { value: "CASINO_BET", label: "Aposta Cassino", icon: "🎰" },
];

const OPERATORS = [
  { value: "EQUAL", label: "= Igual" },
  { value: "NOT_EQUAL", label: "!= Diferente" },
  { value: "GREATER", label: "> Maior" },
  { value: "GREATER_EQUAL", label: ">= Maior ou igual" },
  { value: "LESS", label: "< Menor" },
  { value: "LESS_EQUAL", label: "<= Menor ou igual" },
];

const AVAILABLE_FIELDS = [
  { value: "bet_value", label: "Valor da aposta" },
  { value: "bet_return_value", label: "Valor do retorno" },
  { value: "bet_odds", label: "Odds" },
  { value: "bet_events_count", label: "Qtd eventos" },
  { value: "user_credits", label: "Creditos do usuario" },
  { value: "casino_bet_value", label: "Valor aposta cassino" },
];

const STEP_LABELS = [
  { label: "Info", icon: Lock },
  { label: "Condicoes", icon: Zap },
  { label: "Notificacoes", icon: Bell },
  { label: "Revisao", icon: CheckCircle },
];

interface TriggerFilter {
  field: string;
  operator: string;
  value: string;
  logicGate: string | null;
}

interface TimeSlot {
  startHour: number;
  endHour: number;
  lockSeconds: number;
}

const opLabel = (op: string) => {
  const m: Record<string, string> = { EQUAL: "=", NOT_EQUAL: "!=", GREATER: ">", GREATER_EQUAL: ">=", LESS: "<", LESS_EQUAL: "<=" };
  return m[op] ?? op;
};

export default function NewGroupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [name, setName] = useState("");
  const [lockSeconds, setLockSeconds] = useState("300");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [useTimeSlots, setUseTimeSlots] = useState(false);

  // Trigger conditions
  const [triggerTypes, setTriggerTypes] = useState<string[]>(["SPORT_BET", "CASINO_BET"]);
  const [triggerFilters, setTriggerFilters] = useState<TriggerFilter[]>([]);
  const [noLimit, setNoLimit] = useState(true);

  // Notifications
  const [notifyPanel, setNotifyPanel] = useState(false);
  const [notifyChat, setNotifyChat] = useState(false);
  const [chatWebhookUrl, setChatWebhookUrl] = useState("");

  const toggleType = (type: string) => {
    setTriggerTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const addFilter = () => {
    setTriggerFilters([
      ...triggerFilters,
      { field: "bet_value", operator: "GREATER", value: "", logicGate: null },
    ]);
    setNoLimit(false);
  };

  const updateFilter = (index: number, key: keyof TriggerFilter, value: string | null) => {
    const updated = [...triggerFilters];
    updated[index] = { ...updated[index]!, [key]: value };
    setTriggerFilters(updated);
  };

  const removeFilter = (index: number) => {
    const updated = triggerFilters.filter((_, i) => i !== index);
    setTriggerFilters(updated);
    if (updated.length === 0) setNoLimit(true);
  };

  const canNext = (s: number) => {
    if (s === 1) return name.trim().length >= 2 && Number(lockSeconds) >= 1;
    if (s === 2) return triggerTypes.length > 0;
    return true;
  };

  const handleSubmit = async () => {
    if (triggerTypes.length === 0) {
      setError("Selecione pelo menos um tipo de aposta");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const group = await api.fetch<{ id: string }>("/groups", {
        method: "POST",
        body: JSON.stringify({
          name,
          lockSeconds: Number(lockSeconds),
          notifyPanel,
          notifyChat,
          chatWebhookUrl: notifyChat ? chatWebhookUrl : null,
          triggerTypes,
          triggerFilters: noLimit
            ? []
            : triggerFilters.map((f, i) => ({
                field: f.field,
                operator: f.operator,
                value: f.value,
                logicGate: i < triggerFilters.length - 1 ? f.logicGate || "AND" : null,
              })),
          timeSlots: useTimeSlots ? timeSlots : [],
        }),
      });
      router.push(`/groups/${group.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar grupo");
    } finally {
      setLoading(false);
    }
  };

  // Navigation
  const Nav = ({ back, next, nextLabel, nextDisabled }: { back?: number; next?: number | (() => void); nextLabel?: string; nextDisabled?: boolean }) => (
    <div className="flex items-center gap-3 pt-2">
      {back && <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => setStep(back)}><ArrowLeft className="h-3.5 w-3.5" />Voltar</Button>}
      {next && (
        <Button size="sm" className="gap-1.5 rounded-xl" disabled={nextDisabled} onClick={() => typeof next === "function" ? next() : setStep(next)}>
          {nextLabel ?? "Proximo"}<ArrowRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex gap-8">
      {/* Left - Wizard */}
      <div className="flex-1 max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/groups")} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-card text-muted-foreground hover:bg-muted"><ArrowLeft className="h-4 w-4" /></button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Novo Grupo de Bloqueio</h1>
            <p className="text-sm text-muted-foreground">Passo {step} de 4</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1">
          {STEP_LABELS.map((s, i) => {
            const num = i + 1;
            const Icon = s.icon;
            const active = num === step;
            const done = num < step;
            return (
              <button key={num} onClick={() => num <= step && setStep(num)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-medium transition-all
                  ${active ? "bg-primary text-primary-foreground" : done ? "bg-primary/15 text-primary cursor-pointer" : "bg-muted text-muted-foreground"}`}>
                {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* ═══ Step 1: Info ═══ */}
        {step === 1 && (
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 text-foreground"><Lock className="h-5 w-5 text-violet-500" /><h2 className="text-lg font-semibold">Informacoes do Grupo</h2></div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Nome do Grupo</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Grupo de Risco 1" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Tempo de Bloqueio (segundos)</Label>
                <div className="relative">
                  <Timer className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="number" min="1" value={lockSeconds} onChange={(e) => setLockSeconds(e.target.value)} className="h-11 rounded-xl pl-10" />
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
                  <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    {Math.floor(Number(lockSeconds) / 60)} minutos e {Number(lockSeconds) % 60} segundos
                    {useTimeSlots ? " (fallback quando nenhuma faixa bater)" : ""}
                  </p>
                </div>
              </div>

              {/* Time Slots */}
              <div className="space-y-3 pt-2 border-t border-border/50">
                <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all ${useTimeSlots ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/50"}`}>
                  <input type="checkbox" checked={useTimeSlots} onChange={(e) => {
                    setUseTimeSlots(e.target.checked);
                    if (e.target.checked && timeSlots.length === 0) {
                      setTimeSlots([
                        { startHour: 0, endHour: 6, lockSeconds: 240 },
                        { startHour: 6, endHour: 24, lockSeconds: 120 },
                      ]);
                    }
                  }} className="h-4 w-4 accent-primary rounded" />
                  <div>
                    <p className="text-sm font-medium"><Clock className="h-3.5 w-3.5 inline mr-1" />Faixas de horario</p>
                    <p className="text-xs text-muted-foreground">Definir tempo de bloqueio diferente por faixa de horario</p>
                  </div>
                </label>

                {useTimeSlots && (
                  <div className="space-y-2">
                    {timeSlots.map((slot, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 flex-1">
                          <select className="h-9 rounded-lg border border-border/60 bg-transparent px-2 text-sm" value={slot.startHour}
                            onChange={(e) => { const u = [...timeSlots]; u[i] = { ...u[i]!, startHour: Number(e.target.value) }; setTimeSlots(u); }}>
                            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                          </select>
                          <span className="text-xs text-muted-foreground">ate</span>
                          <select className="h-9 rounded-lg border border-border/60 bg-transparent px-2 text-sm" value={slot.endHour}
                            onChange={(e) => { const u = [...timeSlots]; u[i] = { ...u[i]!, endHour: Number(e.target.value) }; setTimeSlots(u); }}>
                            {Array.from({ length: 24 }, (_, h) => <option key={h + 1} value={h + 1}>{String(h + 1 === 24 ? 0 : h + 1).padStart(2, "0")}:00</option>)}
                          </select>
                          <span className="text-xs text-muted-foreground mx-1">=</span>
                          <Input type="number" min="1" value={slot.lockSeconds}
                            onChange={(e) => { const u = [...timeSlots]; u[i] = { ...u[i]!, lockSeconds: Number(e.target.value) }; setTimeSlots(u); }}
                            className="h-9 w-24 rounded-lg text-sm" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">seg ({Math.floor(slot.lockSeconds / 60)}min)</span>
                        </div>
                        <button onClick={() => setTimeSlots(timeSlots.filter((_, j) => j !== i))} className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setTimeSlots([...timeSlots, { startHour: 0, endHour: 24, lockSeconds: 120 }])}>
                      <Plus className="h-3.5 w-3.5" /> Adicionar faixa
                    </Button>

                    {/* Visual timeline */}
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Preview das faixas</p>
                      <div className="flex h-8 rounded-lg overflow-hidden border border-border/30">
                        {timeSlots.slice().sort((a, b) => a.startHour - b.startHour).map((slot, i) => {
                          const span = slot.endHour - slot.startHour;
                          const width = (span / 24) * 100;
                          const colors = ["bg-red-500/70", "bg-emerald-500/70", "bg-amber-500/70", "bg-violet-500/70", "bg-rose-500/70"];
                          return (
                            <div key={i} className={`${colors[i % colors.length]} flex items-center justify-center text-[10px] font-semibold text-white`}
                              style={{ width: `${width}%` }} title={`${slot.startHour}h-${slot.endHour}h: ${slot.lockSeconds}s`}>
                              {span >= 3 && `${String(slot.startHour).padStart(2, "0")}-${String(slot.endHour === 24 ? 0 : slot.endHour).padStart(2, "0")}h ${Math.floor(slot.lockSeconds / 60)}min`}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <Nav next={2} nextDisabled={!canNext(1)} />
            </CardContent>
          </Card>
        )}

        {/* ═══ Step 2: Trigger Conditions ═══ */}
        {step === 2 && (
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 text-foreground"><Zap className="h-5 w-5 text-emerald-500" /><h2 className="text-lg font-semibold">Condicoes de Ativacao</h2></div>
              <p className="text-sm text-muted-foreground">Quando um membro do grupo realizar uma aposta que satisfaca essas condicoes, todos serao bloqueados automaticamente.</p>

              {/* Bet types */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Tipos de Aposta</Label>
                <div className="grid grid-cols-2 gap-2">
                  {BET_TYPES.map((t) => (
                    <button key={t.value} onClick={() => toggleType(t.value)}
                      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${triggerTypes.includes(t.value) ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border/50 hover:bg-muted/50"}`}>
                      <span className="text-xl">{t.icon}</span>
                      <span className={`text-sm ${triggerTypes.includes(t.value) ? "font-semibold text-foreground" : "text-foreground"}`}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* No limit toggle */}
              <label className={`flex items-center gap-3 cursor-pointer rounded-xl border p-4 transition-all ${noLimit ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/50"}`}>
                <input type="checkbox" checked={noLimit} onChange={(e) => { setNoLimit(e.target.checked); if (e.target.checked) setTriggerFilters([]); }} className="h-4 w-4 accent-primary rounded" />
                <div><p className="text-sm font-medium">Sem limite de valor</p><p className="text-xs text-muted-foreground">Qualquer aposta ativa o bloqueio</p></div>
              </label>

              {/* Filters */}
              {!noLimit && (
                <div className="space-y-3">
                  {triggerFilters.map((filter, i) => (
                    <div key={i} className="space-y-2">
                      {i > 0 && (
                        <div className="flex justify-center">
                          <select className="rounded-lg border border-border/60 bg-transparent px-3 py-1 text-xs font-semibold" value={triggerFilters[i - 1]?.logicGate || "AND"}
                            onChange={(e) => updateFilter(i - 1, "logicGate", e.target.value)}>
                            <option value="AND">E (AND)</option><option value="OR">OU (OR)</option>
                          </select>
                        </div>
                      )}
                      <div className="flex gap-2 items-center">
                        <select className="flex-1 h-9 rounded-xl border border-border/60 bg-transparent px-3 text-sm" value={filter.field}
                          onChange={(e) => updateFilter(i, "field", e.target.value)}>
                          {AVAILABLE_FIELDS.map((f) => <option key={f.value} value={f.value}>{getFieldLabel(f.value)}</option>)}
                        </select>
                        <select className="h-9 rounded-xl border border-border/60 bg-transparent px-3 text-sm" value={filter.operator}
                          onChange={(e) => updateFilter(i, "operator", e.target.value)}>
                          {OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                        </select>
                        <Input placeholder="0,00" value={filter.value ? formatCurrency(String(Math.round(Number(filter.value) * 100))) : ""} onChange={(e) => updateFilter(i, "value", parseCurrency(e.target.value))} className="flex-1 h-9 rounded-xl" />
                        <button onClick={() => removeFilter(i)} className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}

                  <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={addFilter}>
                    <Plus className="h-3.5 w-3.5" /> Adicionar Condicao
                  </Button>

                  {triggerFilters.length > 0 && (
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Preview</p>
                      <p className="text-sm font-mono text-foreground">{triggerFilters.map((f, i) => `${getFieldLabel(f.field)} ${opLabel(f.operator)} ${f.value ? formatCurrency(String(Math.round(Number(f.value) * 100))) : "?"}${i < triggerFilters.length - 1 ? ` ${f.logicGate || "AND"} ` : ""}`).join("")}</p>
                    </div>
                  )}
                </div>
              )}
              <Nav back={1} next={3} nextDisabled={!canNext(2)} />
            </CardContent>
          </Card>
        )}

        {/* ═══ Step 3: Notifications ═══ */}
        {step === 3 && (
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 text-foreground"><Bell className="h-5 w-5 text-amber-500" /><h2 className="text-lg font-semibold">Notificacoes</h2></div>
              <p className="text-sm text-muted-foreground">Configure onde enviar o aviso quando o bloqueio for ativado.</p>

              {[
                { checked: notifyPanel, set: setNotifyPanel, title: "Painel da Dashboard", desc: "Exibir no sino de notificacoes do dashboard" },
                { checked: notifyChat, set: setNotifyChat, title: "Google Chat", desc: "Enviar para um webhook do Google Chat" },
              ].map((opt) => (
                <label key={opt.title} className={`flex items-center gap-3 cursor-pointer rounded-xl border p-4 transition-all ${opt.checked ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/50"}`}>
                  <input type="checkbox" checked={opt.checked} onChange={(e) => opt.set(e.target.checked)} className="h-4 w-4 accent-primary rounded" />
                  <div><p className="text-sm font-medium">{opt.title}</p><p className="text-xs text-muted-foreground">{opt.desc}</p></div>
                </label>
              ))}

              {notifyChat && (
                <div className="space-y-2 pl-2 border-l-2 border-primary/30 ml-2">
                  <Label className="text-xs text-muted-foreground">URL do Webhook</Label>
                  <Input value={chatWebhookUrl} onChange={(e) => setChatWebhookUrl(e.target.value)} placeholder="https://chat.googleapis.com/v1/spaces/..." className="h-10 rounded-xl text-sm" />
                </div>
              )}
              <Nav back={2} next={4} nextLabel="Revisar" />
            </CardContent>
          </Card>
        )}

        {/* ═══ Step 4: Review ═══ */}
        {step === 4 && (
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 text-foreground"><CheckCircle className="h-5 w-5 text-emerald-500" /><h2 className="text-lg font-semibold">Revisao Final</h2></div>

              <div className="space-y-4">
                {[
                  { label: "Nome", value: name },
                  { label: "Tempo de Bloqueio", value: useTimeSlots ? `Variavel (${timeSlots.length} faixas)` : `${Math.floor(Number(lockSeconds) / 60)}min ${Number(lockSeconds) % 60}s` },
                ].map((r) => (
                  <div key={r.label} className="flex items-start justify-between rounded-xl bg-muted/30 p-3">
                    <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.label}</p><p className="text-sm font-medium mt-0.5">{r.value}</p></div>
                  </div>
                ))}

                <div className="flex gap-2">
                  {triggerTypes.map((t) => <Badge key={t} variant="secondary" className="rounded-lg">{BET_TYPES.find((bt) => bt.value === t)?.label}</Badge>)}
                </div>

                {!noLimit && triggerFilters.length > 0 && (
                  <div className="rounded-xl bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Condicoes</p>
                    <p className="text-sm font-mono">{triggerFilters.map((f, i) => `${getFieldLabel(f.field)} ${opLabel(f.operator)} ${f.value ? formatCurrency(String(Math.round(Number(f.value) * 100))) : "?"}${i < triggerFilters.length - 1 ? ` ${f.logicGate || "AND"} ` : ""}`).join("")}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  {notifyPanel && <Badge variant="secondary" className="rounded-lg">Painel</Badge>}
                  {notifyChat && <Badge variant="secondary" className="rounded-lg">Google Chat</Badge>}
                  {!notifyPanel && !notifyChat && <span className="text-xs text-muted-foreground">Sem notificacoes</span>}
                </div>
              </div>

              {error && <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{error}</div>}

              <div className="flex items-center gap-3 pt-2">
                <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => setStep(3)}><ArrowLeft className="h-3.5 w-3.5" />Voltar</Button>
                <Button size="sm" className="gap-1.5 rounded-xl" onClick={handleSubmit} disabled={loading}>
                  {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Criando...</> : <><CheckCircle className="h-3.5 w-3.5" />Criar Grupo</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right - Summary Panel */}
      <div className="w-72 shrink-0 hidden lg:block">
        <div className="sticky top-8 space-y-3">
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-5 space-y-3 text-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo</p>

              {[
                { label: "Nome", value: name || "—", step: 1 },
                { label: "Tempo", value: useTimeSlots ? `Variavel (${timeSlots.length} faixas)` : lockSeconds ? `${Math.floor(Number(lockSeconds) / 60)}min ${Number(lockSeconds) % 60}s` : "—", step: 1 },
              ].map((r) => (
                <div key={r.label} className="flex items-start justify-between group cursor-pointer rounded-lg p-2 -mx-2 hover:bg-muted" onClick={() => setStep(r.step)}>
                  <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.label}</p><p className="text-xs font-medium mt-0.5">{r.value}</p></div>
                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 mt-1" />
                </div>
              ))}

              <div className="border-t border-border" />

              <div className="flex items-start justify-between group cursor-pointer rounded-lg p-2 -mx-2 hover:bg-muted" onClick={() => setStep(2)}>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Condicoes</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {triggerTypes.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{BET_TYPES.find((bt) => bt.value === t)?.label}</Badge>)}
                  </div>
                  {!noLimit && triggerFilters.length > 0 && (
                    <p className="text-[10px] font-mono text-muted-foreground mt-1">{triggerFilters.length} filtro(s)</p>
                  )}
                  {noLimit && <p className="text-[10px] text-muted-foreground mt-0.5">Qualquer valor</p>}
                </div>
                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 mt-1" />
              </div>

              <div className="flex items-start justify-between group cursor-pointer rounded-lg p-2 -mx-2 hover:bg-muted" onClick={() => setStep(3)}>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Notificacoes</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {notifyPanel && <Badge variant="secondary" className="text-[10px]">Painel</Badge>}
                    {notifyChat && <Badge variant="secondary" className="text-[10px]">Chat</Badge>}
                    {!notifyPanel && !notifyChat && <span className="text-muted-foreground italic text-xs">—</span>}
                  </div>
                </div>
                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 mt-1" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
