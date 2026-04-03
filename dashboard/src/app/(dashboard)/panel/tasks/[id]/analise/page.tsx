"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getFieldLabel } from "@/lib/field-labels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ArrowRight, CheckCircle, Circle, Shield, Loader2, X,
  ChevronDown, Image, FileText, Trophy, Sparkles, Zap, Target,
  Eye, Bold, Italic, Underline, Paperclip, Send,
} from "lucide-react";

interface ChecklistItem { label: string; checked: boolean; }
interface TaskDetail {
  id: string; title: string; description: string | null; status: string;
  data: Record<string, unknown> | null; checklist: ChecklistItem[];
  parecer: string | null;
  assignedTo: string | null; completedBy: string | null; completedAt: string | null;
  assignedUser: { id: string; name: string } | null;
  completedByUser: { id: string; name: string } | null;
  comments: Array<{ id: string; userName: string; message: string; imageUrl: string | null; createdAt: string }>;
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Sim" : "Nao";
  if ((key.includes("value") || key.includes("credits") || key.includes("prize")) && typeof value === "number")
    return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  return String(value);
}

export default function AnalysisWizardPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [stepComment, setStepComment] = useState("");
  const [stepImage, setStepImage] = useState<File | null>(null);
  const [stepImagePreview, setStepImagePreview] = useState<string | null>(null);
  const [submittingStep, setSubmittingStep] = useState(false);
  const [parecer, setParecer] = useState("");
  const [submittingFinal, setSubmittingFinal] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [showData, setShowData] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const commentTextRef = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = (prefix: string, suffix: string) => {
    const el = commentTextRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = stepComment;
    const selected = text.slice(start, end);
    const before = text.slice(0, start);
    const after = text.slice(end);
    if (selected) {
      setStepComment(before + prefix + selected + suffix + after);
      setTimeout(() => { el.focus(); el.setSelectionRange(start + prefix.length, end + prefix.length); }, 0);
    } else {
      setStepComment(before + prefix + suffix + after);
      setTimeout(() => { el.focus(); el.setSelectionRange(start + prefix.length, start + prefix.length); }, 0);
    }
  };

  const uploadAttachment = async (file: globalThis.File) => {
    const formData = new FormData();
    formData.append("message", `[Passo ${currentStep + 1}] 📎 ${file.name}`);
    formData.append("image", file);
    try {
      await fetch(`${apiUrl}/panel/tasks/${taskId}/comments`, { method: "POST", headers: { Authorization: `Bearer ${api.getAccessToken()}` }, body: formData });
      const updated = await api.fetch<TaskDetail>(`/panel/tasks/${taskId}`);
      setTask(updated);
    } catch (err) { console.error(err); }
  };

  const totalSteps = (task?.checklist?.length ?? 0) + 1;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

  const goBack = () => router.back();

  useEffect(() => {
    (async () => {
      try {
        const data = await api.fetch<TaskDetail>(`/panel/tasks/${taskId}`);
        setTask(data);
        if (data.status === "done") {
          setCompleted(true);
          setParecer(data.parecer || "");
        } else {
          await api.fetch(`/panel/tasks/${taskId}/start-analysis`, { method: "POST" });
          const refreshed = await api.fetch<TaskDetail>(`/panel/tasks/${taskId}`);
          setTask(refreshed);
          const firstUnchecked = (refreshed.checklist ?? []).findIndex((c) => !c.checked);
          setCurrentStep(firstUnchecked >= 0 ? firstUnchecked : refreshed.checklist?.length ?? 0);
        }
      } catch (err: any) { setError(err.message || "Erro ao carregar"); }
      finally { setLoading(false); }
    })();
  }, [taskId]);

  const handleStepImage = (file: File) => {
    setStepImage(file);
    const reader = new FileReader();
    reader.onload = () => setStepImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const confirmStep = async () => {
    if (!task) return;
    setSubmittingStep(true);
    try {
      await api.fetch(`/panel/tasks/${taskId}/checklist`, { method: "PATCH", body: JSON.stringify({ index: currentStep, checked: true }) });
      const stepPrefix = `[Passo ${currentStep + 1}]`;
      if (stepComment.trim() || stepImage) {
        if (stepImage) {
          const formData = new FormData();
          formData.append("message", `${stepPrefix} ${stepComment.trim()}`);
          formData.append("image", stepImage);
          await fetch(`${apiUrl}/panel/tasks/${taskId}/comments`, { method: "POST", headers: { Authorization: `Bearer ${api.getAccessToken()}` }, body: formData });
        } else {
          await api.fetch(`/panel/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ message: `${stepPrefix} ${stepComment.trim()}` }) });
        }
      }
      const updated = await api.fetch<TaskDetail>(`/panel/tasks/${taskId}`);
      setTask(updated);
      setStepComment(""); setStepImage(null); setStepImagePreview(null);
      setCurrentStep((s) => s + 1);
    } catch (err: any) { setError(err.message || "Erro"); }
    finally { setSubmittingStep(false); }
  };

  const submitParecer = async () => {
    if (!parecer.trim()) return;
    setSubmittingFinal(true);
    try {
      await api.fetch(`/panel/tasks/${taskId}/complete-analysis`, { method: "POST", body: JSON.stringify({ parecer: parecer.trim() }) });
      setCompleted(true);
    } catch (err: any) { setError(err.message || "Erro"); }
    finally { setSubmittingFinal(false); }
  };

  const checklist = task?.checklist ?? [];
  const isParecerStep = currentStep >= checklist.length;
  const completedSteps = checklist.filter((c) => c.checked).length;
  const progress = totalSteps > 0 ? Math.round(((isParecerStep ? checklist.length : completedSteps) / totalSteps) * 100) : 0;
  const dataEntries = task?.data ? Object.entries(task.data).filter(([k]) => k !== "type").filter(([, v]) => v !== null && v !== undefined && v !== "") : [];

  // ═══ MODAL WRAPPER ═══
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-1/4 left-1/3 h-96 w-96 rounded-full bg-primary/5 blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/3 h-96 w-96 rounded-full bg-emerald-500/5 blur-[150px]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] mx-4 flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-400">
        {/* ═══ TOP BAR (game-style) ═══ */}
        <div className="rounded-t-2xl bg-card/95 border border-border/50 border-b-0 px-5 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            {/* XP / Progress */}
            <div className="flex items-center gap-2 flex-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                {completed ? <Trophy className="h-4 w-4 text-emerald-500" /> : <Target className="h-4 w-4 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-foreground truncate">{task?.title || "Carregando..."}</p>
                  <span className="text-[10px] font-bold text-primary ml-2 shrink-0">{completed ? "100" : progress}%</span>
                </div>
                {/* XP bar */}
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${completed ? "bg-emerald-500" : "bg-gradient-to-r from-primary to-primary/70"}`}
                    style={{ width: `${completed ? 100 : progress}%` }}
                  />
                </div>
              </div>
            </div>
            {/* Step counter */}
            {!completed && task && (
              <Badge variant="secondary" className="rounded-lg text-[10px] font-bold shrink-0">
                {Math.min(currentStep + 1, totalSteps)}/{totalSteps}
              </Badge>
            )}
            {/* Close */}
            <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ═══ CONTENT ═══ */}
        <div className="flex-1 overflow-y-auto rounded-b-2xl bg-card/95 border border-border/50 border-t-0 backdrop-blur-xl">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                <Zap className="h-5 w-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-xs text-muted-foreground">Preparando analise...</p>
            </div>
          )}

          {/* Error */}
          {error && !task && (
            <div className="flex flex-col items-center py-20 gap-4">
              <Shield className="h-10 w-10 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={goBack}>Voltar</Button>
            </div>
          )}

          {/* ═══ COMPLETED SUMMARY ═══ */}
          {completed && task && (
            <div className="p-6 space-y-5">
              {/* Success header */}
              <div className="text-center space-y-3">
                <div className="relative mx-auto w-16 h-16">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-pulse" />
                  <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10">
                    <Trophy className="h-8 w-8 text-emerald-500" />
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center justify-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-amber-500" /> Analise Concluida <Sparkles className="h-4 w-4 text-amber-500" />
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {task.completedByUser?.name && `por ${task.completedByUser.name}`}
                    {task.completedAt && ` em ${new Date(task.completedAt).toLocaleString("pt-BR")}`}
                  </p>
                </div>
              </div>

              {/* Parecer */}
              <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4">
                <p className="text-[10px] text-emerald-600 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1"><FileText className="h-3 w-3" />Parecer Final</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{parecer || "Sem parecer"}</p>
              </div>

              {/* Steps review */}
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Verificacoes</p>
                {checklist.map((item, i) => {
                  const prefix = `[Passo ${i + 1}]`;
                  const stepComments = (task.comments ?? []).filter((c) => c.message.startsWith(prefix));
                  return (
                    <div key={i} className="rounded-xl border border-border/50 overflow-hidden">
                      <div className="flex items-center gap-2.5 px-3 py-2 bg-emerald-500/5">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 font-bold text-[10px]">{i + 1}</div>
                        <span className="text-xs font-medium flex-1">{item.label}</span>
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      </div>
                      {stepComments.length > 0 && (
                        <div className="px-3 py-2 space-y-1.5 border-t border-border/30">
                          {stepComments.map((c) => (
                            <div key={c.id}>
                              <p className="text-[11px] text-muted-foreground">{c.message.replace(prefix + " ", "")}</p>
                              {c.imageUrl && <img src={`${apiUrl}/uploads/${c.imageUrl}`} alt="" className="max-h-24 rounded-lg border border-border mt-1" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Webhook data */}
              {dataEntries.length > 0 && (
                <div>
                  <button className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground" onClick={() => setShowData(!showData)}>
                    <ChevronDown className={`h-3 w-3 transition-transform ${showData ? "rotate-180" : ""}`} /> Dados do alerta
                  </button>
                  {showData && (
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 p-3 rounded-lg bg-muted/30">
                      {dataEntries.slice(0, 12).map(([k, v]) => (
                        <div key={k}><p className="text-[9px] text-muted-foreground">{getFieldLabel(k)}</p><p className="text-[11px] font-medium truncate">{formatValue(k, v)}</p></div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ CHECKLIST STEP ═══ */}
          {!loading && !completed && task && !isParecerStep && (
            <div className="p-6 space-y-5">
              {/* Step header */}
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                  <span className="text-lg font-bold text-primary">{currentStep + 1}</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-foreground">{checklist[currentStep]?.label}</h2>
                  <p className="text-[11px] text-muted-foreground">Verifique e registre sua analise</p>
                </div>
                {checklist[currentStep]?.checked && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-0 gap-1"><CheckCircle className="h-3 w-3" />Feito</Badge>
                )}
              </div>

              {/* Step progress pills */}
              <div className="flex gap-1">
                {checklist.map((item, i) => (
                  <button key={i} onClick={() => i <= completedSteps && setCurrentStep(i)}
                    className={`flex-1 h-1.5 rounded-full transition-all ${item.checked ? "bg-emerald-500" : i === currentStep ? "bg-primary" : "bg-muted"}`} />
                ))}
                <div className={`flex-1 h-1.5 rounded-full ${isParecerStep ? "bg-primary" : "bg-muted"}`} />
              </div>

              {/* Context data (collapsed by default) */}
              {dataEntries.length > 0 && (
                <div>
                  <button className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground" onClick={() => setShowData(!showData)}>
                    <Eye className="h-3 w-3" /> {showData ? "Ocultar" : "Ver"} dados do alerta
                  </button>
                  {showData && (
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 p-3 rounded-lg bg-muted/20 border border-border/30">
                      {dataEntries.slice(0, 12).map(([k, v]) => (
                        <div key={k}><p className="text-[9px] text-muted-foreground">{getFieldLabel(k)}</p><p className="text-[11px] font-medium truncate">{formatValue(k, v)}</p></div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Comment */}
              {!checklist[currentStep]?.checked && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Observacao</p>
                  <div className="rounded-lg border border-input bg-muted/30 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all">
                    {/* Formatting toolbar */}
                    <div className="flex items-center gap-0.5 px-2 pt-1.5 border-b border-border/50 pb-1">
                      <button type="button" onClick={() => wrapSelection("**", "**")} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Negrito (Ctrl+B)"><Bold className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => wrapSelection("*", "*")} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Italico (Ctrl+I)"><Italic className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => wrapSelection("__", "__")} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Sublinhado (Ctrl+U)"><Underline className="h-3.5 w-3.5" /></button>
                    </div>
                    <textarea
                      ref={commentTextRef}
                      value={stepComment}
                      onChange={(e) => setStepComment(e.target.value)}
                      placeholder={stepImage ? "Adicionar legenda (opcional)..." : "Descreva sua verificacao ou cole imagem (Ctrl+V)..."}
                      rows={2}
                      className="w-full bg-transparent px-3 py-2 text-sm resize-none outline-none min-h-[52px]"
                      onKeyDown={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                          if (e.key === "b") { e.preventDefault(); wrapSelection("**", "**"); }
                          if (e.key === "i") { e.preventDefault(); wrapSelection("*", "*"); }
                          if (e.key === "u") { e.preventDefault(); wrapSelection("__", "__"); }
                        }
                      }}
                      onPaste={(e) => {
                        const items = e.clipboardData?.items;
                        if (!items) return;
                        for (const item of Array.from(items)) {
                          if (item.type.startsWith("image/")) {
                            e.preventDefault();
                            const file = item.getAsFile();
                            if (file) handleStepImage(file);
                            return;
                          }
                        }
                      }}
                    />
                    {/* Image preview */}
                    {stepImagePreview && (
                      <div className="px-3 pb-2">
                        <div className="relative inline-block rounded-lg overflow-hidden border border-border">
                          <img src={stepImagePreview} alt="Preview" className="max-h-32 max-w-full object-contain" />
                          <button
                            onClick={() => { setStepImage(null); setStepImagePreview(null); }}
                            className="absolute top-1 right-1 p-0.5 rounded-md bg-black/60 text-white hover:bg-destructive transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                    {/* Actions bar */}
                    <div className="flex items-center justify-between px-2 pb-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Anexar imagem"
                        >
                          <Image className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"; input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) uploadAttachment(f); }; input.click(); }}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Anexar arquivo"
                        >
                          <Paperclip className="h-4 w-4" />
                        </button>
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleStepImage(f); e.target.value = ""; }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && <p className="text-xs text-destructive">{error}</p>}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-1">
                <Button variant="ghost" size="sm" className="rounded-xl gap-1 text-xs" disabled={currentStep === 0} onClick={() => setCurrentStep((s) => s - 1)}>
                  <ArrowLeft className="h-3 w-3" /> Voltar
                </Button>
                {!checklist[currentStep]?.checked ? (
                  <Button size="sm" className="rounded-xl gap-1.5 text-xs bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20" onClick={confirmStep} disabled={submittingStep}>
                    {submittingStep ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                    {submittingStep ? "Salvando..." : "Confirmar"}
                  </Button>
                ) : (
                  <Button size="sm" className="rounded-xl gap-1 text-xs" onClick={() => setCurrentStep((s) => s + 1)}>
                    Proximo <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ═══ PARECER FINAL ═══ */}
          {!loading && !completed && task && isParecerStep && (
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20">
                  <FileText className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Parecer Final</h2>
                  <p className="text-[11px] text-muted-foreground">Resuma sua conclusao</p>
                </div>
              </div>

              {/* Completed steps mini review */}
              <div className="flex flex-wrap gap-1.5">
                {checklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 text-[10px] font-medium">
                    <CheckCircle className="h-2.5 w-2.5" />{item.label}
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Seu parecer *</p>
                <textarea
                  value={parecer} onChange={(e) => setParecer(e.target.value)}
                  placeholder="Descreva seu parecer final..."
                  rows={4}
                  className="w-full rounded-xl border border-input bg-muted/20 px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
                />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex items-center justify-between pt-1">
                <Button variant="ghost" size="sm" className="rounded-xl gap-1 text-xs" onClick={() => setCurrentStep(checklist.length - 1)}>
                  <ArrowLeft className="h-3 w-3" /> Voltar
                </Button>
                <Button size="sm" className="rounded-xl gap-1.5 text-xs bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-lg shadow-emerald-500/20" onClick={submitParecer} disabled={submittingFinal || !parecer.trim()}>
                  {submittingFinal ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trophy className="h-3 w-3" />}
                  {submittingFinal ? "Finalizando..." : "Concluir Analise"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
