import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Settings, Save, CheckCircle2, AlertCircle, Loader2, Infinity, RefreshCw } from "lucide-react";
import { useLocalStore } from "@/hooks/use-local-store";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

async function fetchOllamaTags(endpoint: string): Promise<{ models: { name: string }[]; error: string | null }> {
  try {
    const res = await fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { models: [], error: `HTTP ${res.status}` };
    const data = await res.json() as { models?: { name: string }[] };
    return { models: data.models ?? [], error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { models: [], error: msg };
  }
}

export default function SettingsPage() {
  const { settings, saveSettings } = useLocalStore();
  const [endpoint, setEndpoint] = useState(settings.endpoint || "http://localhost:11434");
  const [selectedModel, setSelectedModel] = useState(settings.model || "");
  const [manualModel, setManualModel] = useState(settings.model || "");
  const [useManual, setUseManual] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setEndpoint(settings.endpoint || "http://localhost:11434");
    setSelectedModel(settings.model || "");
    setManualModel(settings.model || "");
  }, [settings.endpoint, settings.model]);

  const { data: result, refetch, isFetching } = useQuery({
    queryKey: ["ollama-tags", endpoint],
    queryFn: () => fetchOllamaTags(endpoint),
    retry: false,
  });

  const connected = result ? result.error === null : null;
  const models = result?.models ?? [];
  const fetchError = result?.error ?? null;

  const isCorsError = fetchError !== null && (
    fetchError.toLowerCase().includes("cors") ||
    fetchError.toLowerCase().includes("failed to fetch") ||
    fetchError.toLowerCase().includes("networkerror") ||
    fetchError.toLowerCase().includes("load failed")
  );

  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0].name);
      setManualModel(models[0].name);
    }
    if (fetchError) setUseManual(true);
  }, [models, selectedModel, fetchError]);

  const effectiveModel = useManual ? manualModel : selectedModel;

  const handleSave = () => {
    saveSettings({ endpoint, model: effectiveModel });
    toast({ title: "Settings saved", description: "Your Ollama configuration has been saved." });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border flex items-center px-4">
        <Link href="/" className="font-bold mr-8 hover:text-primary transition-colors">
          AI Builder
        </Link>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 text-xs text-green-500 font-medium bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">
          <Infinity className="w-3.5 h-3.5" />
          Unlimited · Runs locally
        </div>
      </header>

      <main className="container mx-auto max-w-2xl py-12 px-4">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">No API keys, no credits, no limits.</p>
          </div>
        </div>

        <Card className="bg-card">
          <CardHeader>
            <CardTitle>Ollama Configuration</CardTitle>
            <CardDescription>All AI runs on your machine — completely free and private.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Endpoint */}
            <div className="space-y-2">
              <Label htmlFor="endpoint">Ollama Endpoint URL</Label>
              <div className="flex gap-2">
                <Input
                  id="endpoint"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} title="Test connection">
                  {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Connection status */}
            <div className="rounded-lg border border-border p-4 bg-muted/30 space-y-3">
              <h3 className="font-semibold">Connection Status</h3>
              <div className="flex items-center gap-3">
                {isFetching ? (
                  <><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /><span className="text-sm text-muted-foreground">Checking…</span></>
                ) : connected === null ? (
                  <span className="text-sm text-muted-foreground">Not tested yet</span>
                ) : connected ? (
                  <><CheckCircle2 className="w-5 h-5 text-green-500" /><span className="text-sm text-green-500 font-medium">Connected — {models.length} model{models.length !== 1 ? "s" : ""} found</span></>
                ) : (
                  <><AlertCircle className="w-5 h-5 text-destructive" /><span className="text-sm text-destructive font-medium">{fetchError}</span></>
                )}
              </div>

              {/* CORS help */}
              {isCorsError && (
                <div className="space-y-2 text-xs border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-3">
                  <p className="font-semibold text-yellow-500">CORS is blocking the connection.</p>
                  <p className="text-muted-foreground">Restart Ollama with CORS enabled:</p>
                  <code className="block bg-background rounded px-2 py-1.5 font-mono border border-border select-all">
                    OLLAMA_ORIGINS="*" ollama serve
                  </code>
                  <p className="text-muted-foreground">On Windows (PowerShell):</p>
                  <code className="block bg-background rounded px-2 py-1.5 font-mono border border-border select-all">
                    $env:OLLAMA_ORIGINS="*"; ollama serve
                  </code>
                </div>
              )}

              {/* Not connected general help */}
              {!connected && !isCorsError && connected !== null && !isFetching && (
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground/70">Make sure Ollama is running:</p>
                  <code className="block bg-background rounded px-2 py-1.5 font-mono border border-border select-all">
                    OLLAMA_ORIGINS="*" ollama serve
                  </code>
                  <p>Then pull a model: <span className="font-mono">ollama pull llama3</span></p>
                </div>
              )}
            </div>

            {/* Model selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="model">Model</Label>
                {models.length > 0 && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                    onClick={() => setUseManual(!useManual)}
                  >
                    {useManual ? "Pick from list" : "Type manually"}
                  </button>
                )}
              </div>

              {!useManual && models.length > 0 ? (
                <Select value={selectedModel} onValueChange={(v) => { setSelectedModel(v); setManualModel(v); }}>
                  <SelectTrigger id="model" className="font-mono text-sm">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.name} value={m.name} className="font-mono text-sm">
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-1.5">
                  <Input
                    id="model"
                    value={manualModel}
                    onChange={(e) => setManualModel(e.target.value)}
                    placeholder="e.g. llama3, mistral, codellama"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Type the exact model name as shown in <span className="font-mono">ollama list</span>.
                    {isCorsError && " Auto-discovery is blocked by CORS — type the name manually."}
                  </p>
                </div>
              )}
            </div>

            <Button onClick={handleSave} className="w-full gap-2" disabled={!effectiveModel}>
              <Save className="w-4 h-4" /> Save Settings
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
