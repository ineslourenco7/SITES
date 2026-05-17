import { useState } from "react";
import { Link } from "wouter";
import { Settings, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { useLocalStore } from "@/hooks/use-local-store";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { settings, saveSettings } = useLocalStore();
  const [endpoint, setEndpoint] = useState(settings.endpoint || "http://localhost:11434");
  const { toast } = useToast();

  const { data: status, refetch, isFetching } = useQuery({
    queryKey: ["ollama-status-settings", endpoint],
    queryFn: async () => {
      try {
        const res = await fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          return { connected: true, error: null };
        }
        return { connected: false, error: `HTTP ${res.status}` };
      } catch (err) {
        return { connected: false, error: err instanceof Error ? err.message : "Cannot reach Ollama" };
      }
    },
    retry: false,
  });

  const handleSave = () => {
    saveSettings({ ...settings, endpoint });
    refetch();
    toast({
      title: "Settings saved",
      description: "Ollama endpoint updated successfully.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border flex items-center px-4">
        <Link href="/" className="font-bold mr-8 hover:text-primary transition-colors">
          AI Builder
        </Link>
        <div className="flex-1" />
      </header>

      <main className="container mx-auto max-w-2xl py-12 px-4">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Configure your local AI environment.</p>
          </div>
        </div>

        <Card className="bg-card">
          <CardHeader>
            <CardTitle>Ollama Configuration</CardTitle>
            <CardDescription>
              Connect to your local Ollama instance to enable AI generation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
                <Button onClick={handleSave} className="gap-2">
                  <Save className="w-4 h-4" /> Save
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 bg-muted/30">
              <h3 className="font-semibold mb-2">Connection Status</h3>
              <div className="flex items-center gap-3">
                {isFetching ? (
                  <span className="text-sm text-muted-foreground">Checking...</span>
                ) : status?.connected ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-green-500 font-medium">Connected to Ollama</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-destructive" />
                    <span className="text-sm text-destructive font-medium">
                      {status?.error || "Could not connect to Ollama"}
                    </span>
                  </>
                )}
              </div>
              {!status?.connected && !isFetching && (
                <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground/70">To connect:</p>
                  <p>1. Install Ollama from <span className="font-mono text-primary">ollama.com</span></p>
                  <p>2. Run with CORS enabled:</p>
                  <code className="block bg-background rounded px-2 py-1 font-mono text-xs border border-border">
                    OLLAMA_ORIGINS="*" ollama serve
                  </code>
                  <p>3. Pull a model: <span className="font-mono">ollama pull llama3</span></p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
