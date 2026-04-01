"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, Mail, Eye, EyeOff, AlertCircle, Shield } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#0a0a0f] p-4 overflow-hidden">
      {/* Animated grid background */}
      <div className="pointer-events-none fixed inset-0">
        {/* Dark gradient base */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#111118] to-[#0a0a0f]" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `linear-gradient(rgba(239,68,68,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(239,68,68,0.3) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Scanning line animation */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent"
            style={{
              animation: "scanline 4s linear infinite",
              top: "0%",
            }}
          />
        </div>

        {/* Glow orbs */}
        <div className="absolute top-1/4 -left-20 h-96 w-96 rounded-full bg-red-600/8 blur-[120px]" />
        <div className="absolute bottom-1/4 -right-20 h-96 w-96 rounded-full bg-red-500/6 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-red-900/5 blur-[150px]" />

        {/* Floating data particles */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-[10px] font-mono text-red-500/20 select-none"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `float ${8 + Math.random() * 12}s linear infinite`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            >
              {["0x4F2A", "ALERT", "SCAN", "0xFF", "RISK", "AUTH", "CPF", "PIX", "LOCK", "0x00", "BLOCK", "FRAUD", "LOG", "BET", "SLA", "CHECK", "DENY", "FLAG", "TRACE", "NODE"][i % 20]}
            </div>
          ))}
        </div>

        {/* Hexagonal pattern overlay */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="hex" width="56" height="100" patternUnits="userSpaceOnUse" patternTransform="scale(2)">
              <path d="M28 66L0 50L0 16L28 0L56 16L56 50L28 66L28 100" fill="none" stroke="rgba(239,68,68,0.5)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hex)" />
        </svg>
      </div>

      <style jsx>{`
        @keyframes scanline {
          0% { top: -2%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 102%; opacity: 0; }
        }
        @keyframes float {
          0% { transform: translateY(100vh); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh); opacity: 0; }
        }
      `}</style>

      <div className="relative z-10 w-full max-w-md">
        {/* Top accent line */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-red-500/50 to-transparent mb-8" />

        <Card className="rounded-2xl border-red-500/10 bg-[#111118]/90 shadow-2xl shadow-red-950/20 backdrop-blur-xl">
          <CardHeader className="space-y-4 pb-2 pt-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
              <Shield className="h-8 w-8 text-red-500" />
            </div>
            <div className="space-y-1.5">
              <CardTitle className="text-2xl font-bold tracking-tight text-white">
                JBD Risk Panel
              </CardTitle>
              <CardDescription className="text-zinc-500">
                Painel de risco e monitoramento de fraudes
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-8 pb-8 pt-4">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-zinc-300">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 rounded-xl border-zinc-800 bg-zinc-900/50 pl-10 text-white placeholder:text-zinc-600 transition-all duration-200 focus:border-red-500/40 focus:bg-zinc-900 focus:ring-2 focus:ring-red-500/20"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-zinc-300">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 rounded-xl border-zinc-800 bg-zinc-900/50 pl-10 pr-10 text-white placeholder:text-zinc-600 transition-all duration-200 focus:border-red-500/40 focus:bg-zinc-900 focus:ring-2 focus:ring-red-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 transition-colors hover:text-zinc-300"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="h-11 w-full rounded-xl bg-red-600 text-sm font-semibold text-white transition-all duration-200 hover:bg-red-500 hover:shadow-lg hover:shadow-red-600/20"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Entrando...
                  </span>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Bottom accent line */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-red-500/30 to-transparent mt-8" />

        <p className="text-center text-[11px] text-zinc-700 mt-4 font-mono">
          SISTEMA DE MONITORAMENTO DE RISCO v2.0
        </p>
      </div>
    </div>
  );
}
