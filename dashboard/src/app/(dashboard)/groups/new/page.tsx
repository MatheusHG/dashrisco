"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, ArrowLeft, AlertCircle, Timer, Zap, Plus, X, Clock, Bell, MessageSquare, ChevronRight, ChevronLeft, Check } from "lucide-react";

const BET_TYPES = [
  { value: "SPORT_BET", label: "Aposta Esportiva" },
  { value: "CASINO_BET", label: "Aposta Cassino" },
];

const OPERATORS = [
  { value: "EQUAL", label: "Igual (=)" },
  { value: "GREATER", label: "Maior (>)" },
  { value: "LESS", label: "Menor (<)" },
];

const AVAILABLE_FIELDS = [
  { value: "bet_value", label: "Valor da aposta" },
  { value: "bet_return_value", label: "Valor do retorno" },
  { value: "bet_odds", label: "Odds" },
  { value: "bet_events_count", label: "Qtd eventos" },
  { value: "user_credits", label: "Creditos do usuario" },
  { value: "casino_bet_value", label: "Valor aposta cassino" },
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

export default function NewGroupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const totalSteps = 3;

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

  const operatorLabel = (op: string) =>
    op === "EQUAL" ? "=" : op === "GREATER" ? ">" : "<";

  const canAdvance = () => {
    if (step === 1) return name.trim().length >= 2 && Number(lockSeconds) >= 1;
    if (step === 2) return triggerTypes.length > 0;
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

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/groups")}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-card/80 text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
            <Lock className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Novo Grupo de Bloqueio</h1>
            <p className="text-sm text-muted-foreground">Configure o grupo, condicoes de ativacao e tempo de bloqueio</p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: "Informacoes", icon: <Lock className="h-3.5 w-3.5" /> },
          { n: 2, label: "Condicoes", icon: <Zap className="h-3.5 w-3.5" /> },
          { n: 3, label: "Notificacoes", icon: <Bell className="h-3.5 w-3.5" /> },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={() => s.n < step && setStep(s.n)}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200 w-full ${
                step === s.n
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : step > s.n
                  ? "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
                  : "bg-muted/50 text-muted-foreground"
              }`}
            >
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                step > s.n ? "bg-primary text-primary-foreground" : step === s.n ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {step > s.n ? <Check className="h-3 w-3" /> : s.n}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
              {s.icon}
            </button>
            {i < 2 && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {/* Step 1: Basic Info */}
        {step === 1 && (
        <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm backdrop-blur-sm">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Informacoes do Grupo</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Grupo de Risco 1"
                required
                className="h-11 rounded-xl border-border/60 bg-background/50 text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Tempo de Bloqueio (segundos)</Label>
              <div className="relative">
                <Timer className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  min="1"
                  value={lockSeconds}
                  onChange={(e) => setLockSeconds(e.target.value)}
                  required
                  className="h-11 rounded-xl border-border/60 bg-background/50 pl-10 text-foreground"
                />
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
                <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  {Math.floor(Number(lockSeconds) / 60)} minutos e{" "}
                  {Number(lockSeconds) % 60} segundos
                  {useTimeSlots ? " (fallback quando nenhuma faixa bater)" : ""}
                </p>
              </div>
            </div>

            {/* Time Slots */}
            <div className="space-y-3 pt-2 border-t border-border/50">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/50 px-4 py-3 transition-all duration-200 hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={useTimeSlots}
                  onChange={(e) => {
                    setUseTimeSlots(e.target.checked);
                    if (e.target.checked && timeSlots.length === 0) {
                      setTimeSlots([
                        { startHour: 0, endHour: 6, lockSeconds: 240 },
                        { startHour: 6, endHour: 24, lockSeconds: 120 },
                      ]);
                    }
                  }}
                  className="h-4 w-4 rounded accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Faixas de horario
                  </p>
                  <p className="text-xs text-muted-foreground">Definir tempo de bloqueio diferente por faixa de horario</p>
                </div>
              </label>

              {useTimeSlots && (
                <div className="space-y-2">
                  {timeSlots.map((slot, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 flex-1">
                        <select
                          className="h-9 rounded-lg border border-border/60 bg-background/50 px-2 text-sm text-foreground"
                          value={slot.startHour}
                          onChange={(e) => {
                            const updated = [...timeSlots];
                            updated[i] = { ...updated[i]!, startHour: Number(e.target.value) };
                            setTimeSlots(updated);
                          }}
                        >
                          {Array.from({ length: 24 }, (_, h) => (
                            <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                          ))}
                        </select>
                        <span className="text-xs text-muted-foreground">ate</span>
                        <select
                          className="h-9 rounded-lg border border-border/60 bg-background/50 px-2 text-sm text-foreground"
                          value={slot.endHour}
                          onChange={(e) => {
                            const updated = [...timeSlots];
                            updated[i] = { ...updated[i]!, endHour: Number(e.target.value) };
                            setTimeSlots(updated);
                          }}
                        >
                          {Array.from({ length: 24 }, (_, h) => (
                            <option key={h + 1} value={h + 1}>{String(h + 1 === 24 ? 0 : h + 1).padStart(2, "0")}:00</option>
                          ))}
                        </select>
                        <span className="text-xs text-muted-foreground mx-1">=</span>
                        <Input
                          type="number"
                          min="1"
                          value={slot.lockSeconds}
                          onChange={(e) => {
                            const updated = [...timeSlots];
                            updated[i] = { ...updated[i]!, lockSeconds: Number(e.target.value) };
                            setTimeSlots(updated);
                          }}
                          className="h-9 w-24 rounded-lg border-border/60 bg-background/50 text-sm text-foreground"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">seg ({Math.floor(slot.lockSeconds / 60)}min)</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-destructive/70 hover:text-destructive rounded-lg"
                        onClick={() => setTimeSlots(timeSlots.filter((_, j) => j !== i))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg gap-1.5 text-xs"
                    onClick={() => setTimeSlots([...timeSlots, { startHour: 0, endHour: 24, lockSeconds: 120 }])}
                  >
                    <Plus className="h-3 w-3" /> Adicionar faixa
                  </Button>

                  {/* Visual timeline */}
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Preview das faixas</p>
                    <div className="flex h-8 rounded-lg overflow-hidden border border-border/30">
                      {timeSlots
                        .slice()
                        .sort((a, b) => a.startHour - b.startHour)
                        .map((slot, i) => {
                          const span = slot.endHour - slot.startHour;
                          const width = (span / 24) * 100;
                          const colors = ["bg-blue-500/70", "bg-emerald-500/70", "bg-amber-500/70", "bg-violet-500/70", "bg-rose-500/70"];
                          return (
                            <div
                              key={i}
                              className={`${colors[i % colors.length]} flex items-center justify-center text-[10px] font-semibold text-white`}
                              style={{ width: `${width}%` }}
                              title={`${slot.startHour}h-${slot.endHour}h: ${slot.lockSeconds}s`}
                            >
                              {span >= 3 && `${String(slot.startHour).padStart(2, "0")}-${String(slot.endHour === 24 ? 0 : slot.endHour).padStart(2, "0")}h ${Math.floor(slot.lockSeconds / 60)}min`}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Step 2: Trigger Types */}
        {step === 2 && (
        <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm backdrop-blur-sm">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Condicoes de Ativacao</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Quando um membro do grupo realizar uma aposta que satisfaca essas condicoes, todos os membros serao bloqueados automaticamente.
            </p>

            {/* Bet types */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Tipos de Aposta</Label>
              <div className="flex gap-2">
                {BET_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => toggleType(type.value)}
                    className={`rounded-xl border px-4 py-2.5 text-sm transition-all duration-200 ${
                      triggerTypes.includes(type.value)
                        ? "border-primary bg-primary/15 text-foreground font-semibold"
                        : "border-border/50 text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* No limit toggle */}
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/50 px-4 py-3 transition-all duration-200 hover:bg-muted/50">
              <input
                type="checkbox"
                checked={noLimit}
                onChange={(e) => {
                  setNoLimit(e.target.checked);
                  if (e.target.checked) setTriggerFilters([]);
                }}
                className="h-4 w-4 rounded accent-primary"
              />
              <div>
                <p className="text-sm font-medium text-foreground">Sem limite de valor</p>
                <p className="text-xs text-muted-foreground">Qualquer aposta ativa o bloqueio</p>
              </div>
            </label>

            {/* Filters */}
            {!noLimit && (
              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground">Condicoes</Label>

                {triggerFilters.map((filter, index) => (
                  <div key={index} className="space-y-2">
                    {index > 0 && (
                      <div className="flex justify-center">
                        <select
                          className="rounded-lg border border-border/50 bg-background/50 px-3 py-1 text-xs font-semibold text-foreground"
                          value={triggerFilters[index - 1]?.logicGate || "AND"}
                          onChange={(e) => updateFilter(index - 1, "logicGate", e.target.value)}
                        >
                          <option value="AND">E (AND)</option>
                          <option value="OR">OU (OR)</option>
                        </select>
                      </div>
                    )}
                    <div className="flex gap-2 items-center">
                      <select
                        className="flex-1 h-10 rounded-xl border border-border/60 bg-background/50 px-3 text-sm text-foreground"
                        value={filter.field}
                        onChange={(e) => updateFilter(index, "field", e.target.value)}
                      >
                        {AVAILABLE_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                      <select
                        className="h-10 rounded-xl border border-border/60 bg-background/50 px-3 text-sm text-foreground"
                        value={filter.operator}
                        onChange={(e) => updateFilter(index, "operator", e.target.value)}
                      >
                        {OPERATORS.map((op) => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                      <Input
                        placeholder="Valor"
                        value={filter.value}
                        onChange={(e) => updateFilter(index, "value", e.target.value)}
                        className="flex-1 h-10 rounded-xl border-border/60 bg-background/50 text-foreground"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-xl"
                        onClick={() => removeFilter(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-1.5"
                  onClick={addFilter}
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar Condicao
                </Button>

                {/* Preview */}
                {triggerFilters.length > 0 && (
                  <div className="rounded-xl bg-muted/50 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Preview</p>
                    <p className="text-sm font-mono text-foreground">
                      {triggerFilters
                        .map((f, i) => {
                          const fieldLabel = AVAILABLE_FIELDS.find((af) => af.value === f.field)?.label || f.field;
                          const gate = i < triggerFilters.length - 1 ? ` ${f.logicGate || "AND"} ` : "";
                          return `${fieldLabel} ${operatorLabel(f.operator)} ${f.value || "?"}${gate}`;
                        })
                        .join("")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Summary */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-xs text-foreground">
                <span className="font-semibold">Resumo:</span> Quando um membro apostar em{" "}
                <span className="font-semibold">
                  {triggerTypes.map((t) => BET_TYPES.find((bt) => bt.value === t)?.label).join(" ou ")}
                </span>
                {noLimit
                  ? " (qualquer valor)"
                  : triggerFilters.length > 0
                  ? ` com ${triggerFilters.map((f, i) => {
                      const label = AVAILABLE_FIELDS.find((af) => af.value === f.field)?.label || f.field;
                      const gate = i < triggerFilters.length - 1 ? ` ${f.logicGate || "AND"} ` : "";
                      return `${label} ${operatorLabel(f.operator)} ${f.value || "?"}${gate}`;
                    }).join("")}`
                  : " (qualquer valor)"}
                , todos os membros serao bloqueados por{" "}
                {useTimeSlots && timeSlots.length > 0 ? (
                  <span className="font-semibold">
                    tempo variavel por faixa de horario ({timeSlots.length} faixas)
                  </span>
                ) : (
                  <span className="font-semibold">
                    {Math.floor(Number(lockSeconds) / 60)}min {Number(lockSeconds) % 60}s
                  </span>
                )}
                .
              </p>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Step 3: Notifications */}
        {step === 3 && (
        <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm backdrop-blur-sm">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Notificacoes</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure onde enviar o aviso quando um jogador do grupo apostar e o bloqueio for ativado.
            </p>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/50 px-4 py-3 transition-all duration-200 hover:bg-muted/50">
              <input
                type="checkbox"
                checked={notifyPanel}
                onChange={(e) => setNotifyPanel(e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Painel</p>
                  <p className="text-xs text-muted-foreground">Exibir no sino de notificacoes do dashboard</p>
                </div>
              </div>
            </label>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/50 px-4 py-3 transition-all duration-200 hover:bg-muted/50">
              <input
                type="checkbox"
                checked={notifyChat}
                onChange={(e) => setNotifyChat(e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Google Chat</p>
                  <p className="text-xs text-muted-foreground">Enviar notificacao para webhook do Google Chat</p>
                </div>
              </div>
            </label>

            {notifyChat && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">URL do Webhook</Label>
                <Input
                  value={chatWebhookUrl}
                  onChange={(e) => setChatWebhookUrl(e.target.value)}
                  placeholder="https://chat.googleapis.com/v1/spaces/..."
                  className="h-11 rounded-xl border-border/60 bg-background/50 text-foreground"
                />
              </div>
            )}

            {!notifyPanel && !notifyChat && (
              <div className="rounded-xl bg-muted/50 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Nenhuma notificacao configurada. Voce pode configurar depois na pagina do grupo.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between">
          <div className="flex gap-3">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl gap-2"
                onClick={() => setStep(step - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Voltar
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => router.push("/groups")}
              >
                Cancelar
              </Button>
            )}
          </div>

          <div>
            {step < totalSteps ? (
              <Button
                type="button"
                className="rounded-xl gap-2 shadow-sm"
                disabled={!canAdvance()}
                onClick={() => setStep(step + 1)}
              >
                Proximo
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                disabled={loading}
                className="rounded-xl shadow-sm transition-all duration-200 hover:shadow-md"
                onClick={handleSubmit}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Criando...
                  </span>
                ) : (
                  "Criar Grupo"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
