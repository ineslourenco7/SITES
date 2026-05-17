import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Settings, Save, CheckCircle2, AlertCircle, Loader2, Infinity } from "lucide-react";
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

export default function SettingsPage() {
  const { settings, saveSettings } = useLocalStore();
  const [endpoint, setEndpoint] = useState(settings.endpoint || "http://localhost:11434");
  const [selectedModel, setSelectedModel] = useState(settings.model || "");
  const { toast } = useToast();

  // Sync when context finishes loading from localStorage
  useEffect(() => {
    setEndpoint(settings.endpoint || "http://localhost:11434");
    setSelectedModel(settings.model || "");
  }, [settings.endpoint, settings.model]);

  const { data: status, refetch: refetchStatus, isFetching: isCheckingStatus } = useQuery({
    queryKey: ["ollama-status-settings", endpoint],
    queryFn: async () => {
      try {
        const res = await fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) return { connected: true, error: null };
        return { connected: false, error: `HTTP ${res.status}` };
      } catch (err) {
        return { connected: false, error: err instanceof Error ? err.message : "Cannot reach Ollama" };
      }
    },
    retry: false,
  });

  const { data: modelsData, isFetching: isLoadingModels, refetch: refetchModels } = useQuery({
    queryKey: ["ollama-models-settings", endpoint],
    queryFn: async () => {
      const res = await fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return { models: [] as { name: string }[] };
      const data = await res.json() as { models?: { name: string }[] };
      return { models: data.models ?? [] };
    },
    retry: false,
    enabled: !!status?.connected,
  });

  const models = modelsData?.models ?? [];

  // Auto-select first model if none selected and models are available
  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0].name);
    }
  }, [models, selectedModel]);

  const handleSave = () => {
    saveSettings({ endpoint, model: selectedModel });
    refetchStatus();
    refetchModels();
    toast({
      title: "Settings saved",
      description: "Your Ollama configuration has been saved.",
    });
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
            <p className="text-muted-foreground">Configure your local Ollama instance. No API keys, no credits, no limits.</p>
          </div>
        </div>

        <Card className="bg-card">
          <CardHeader>
            <CardTitle>Ollama Configuration</CardTitle>
            <CardDescription>
              All AI runs on your machine — completely free and private.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Endpoint */}
            <div className="space-y-2">
              <Label htmlFor="endpoint">Ollama Endpoint URL</Label>
              <Input
                id="endpoint"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="http://localhost:11434"
                className="font-mono text-sm"
              />
            </div>

            {/* Connection status */}
            <div className="rounded-lg border border-border p-4 bg-muted/30">
              <h3 className="font-semibold mb-2">Connection Status</h3>
              <div className="flex items-center gap-3">
                {isCheckingStatus ? (
                  <><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /><span className="text-sm text-muted-foreground">Checking…</span></>
                ) : status?.connected ? (
                  <><CheckCircle2 className="w-5 h-5 text-green-500" /><span className="text-sm text-green-500 font-medium">Connected to Ollama</span></>
                ) : (
                  <><AlertCircle className="w-5 h-5 text-destructive" /><span className="text-sm text-destructive font-medium">{status?.error || "Could not connect to Ollama"}</span></>
                )}
              </div>
              {!status?.connected && !isCheckingStatus && (
                <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground/70">To connect:</p>
                  <p>1. Install Ollama from <span className="font-mono text-primary">ollama.com</span></p>
                  <p>2. Run with CORS enabled:</p>
                  <code className="block bg-background rounded px-2 py-1 font-mono border border-border">
                    OLLAMA_ORIGINS="*" ollama serve
                  </code>
                  <p>3. Pull a model: <span className="font-mono">ollama pull llama3</span></p>
                </div>
              )}
            </div>

            {/* Model selection */}
            <div className="space-y-2">
              <Label htmlFor="model">Default Model</Label>
              {isLoadingModels ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading models…
                </div>
              ) : models.length > 0 ? (
                <Select value={selectedModel} onValueChange={setSelectedModel}>
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
                <div className="text-sm text-muted-foreground rounded-lg border border-border p-3 bg-muted/20">
                  {status?.connected
                    ? "No models installed. Run: ollama pull llama3"
                    : "Connect to Ollama first to see available models."}
                </div>
              )}
              {selectedModel && (
                <p className="text-xs text-muted-foreground">
                  This model will be pre-selected in the builder.
                </p>
              )}
            </div>

            <Button onClick={handleSave} className="w-full gap-2">
              <Save className="w-4 h-4" /> Save Settings
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
