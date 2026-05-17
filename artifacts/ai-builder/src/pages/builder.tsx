import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useSearch } from "wouter";
import {
  Play, Download, Wand2, Wrench, Terminal, Send, Settings,
  FolderOpen, CheckCircle2, AlertCircle, Loader2, Zap,
  FileCode, FileText, Globe, RefreshCw, Square,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { SandpackProvider, SandpackPreview } from "@codesandbox/sandpack-react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocalStore, type Project } from "@/hooks/use-local-store";
import {
  useListModels,
  useGetOllamaStatus,
  getGetOllamaStatusQueryKey,
  useFixErrors,
  useImproveDesign,
  type ProjectFile,
  type ChatMessage,
} from "@workspace/api-client-react";

const TEMPLATE_PROMPTS: Record<string, string> = {
  "Landing Page": "Create a modern, beautiful landing page for a SaaS product with a hero section, features, pricing, and footer.",
  "SaaS Dashboard": "Build a modern SaaS admin dashboard with sidebar navigation, metrics cards, charts placeholder, and a data table.",
  "Booking App": "Create a booking/appointment app with a calendar view, time slot selection, and booking form.",
  "E-commerce": "Build an e-commerce product listing page with product cards, filter sidebar, cart, and checkout flow.",
  "Trading Dashboard": "Create a trading/finance dashboard with price charts, portfolio overview, and transaction history.",
  "Portfolio": "Build a personal developer portfolio with hero, about, skills, projects, and contact sections.",
  "Blog": "Create a clean blog homepage with featured article, article list, sidebar, and tags filter.",
};

const GENERATE_SYSTEM_PROMPT = `You are an expert full-stack developer. Generate complete, working web project files based on the user's description.

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "projectName": "my-project",
  "description": "Brief description of the project",
  "files": [
    { "path": "index.html", "content": "<!DOCTYPE html>...", "language": "html" },
    { "path": "styles.css", "content": "...", "language": "css" },
    { "path": "script.js", "content": "...", "language": "javascript" }
  ]
}

Rules:
- Generate real, working, complete code — not placeholders
- Use vanilla HTML/CSS/JS unless the user asks for a framework
- Include at least index.html, styles.css, and script.js
- Make the UI look modern and professional
- Do not include any explanation text outside the JSON`;

const DEFAULT_FILES: ProjectFile[] = [
  {
    path: "index.html",
    language: "html",
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My App</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div id="app">
    <h1>Hello, World!</h1>
    <p>Start building your app by chatting with AI below.</p>
  </div>
  <script src="script.js"></script>
</body>
</html>`,
  },
  {
    path: "styles.css",
    language: "css",
    content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #0f0f13; color: #f0f0f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
#app { text-align: center; padding: 2rem; }
h1 { font-size: 2.5rem; margin-bottom: 1rem; background: linear-gradient(135deg, #6366f1, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
p { color: #a1a1aa; font-size: 1.1rem; }`,
  },
  {
    path: "script.js",
    language: "javascript",
    content: `// Your app logic goes here\nconsole.log("App started!");`,
  },
];

function getFileIcon(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "html") return <Globe className="w-3.5 h-3.5 text-orange-400" />;
  if (ext === "css") return <FileText className="w-3.5 h-3.5 text-blue-400" />;
  if (ext === "js" || ext === "ts" || ext === "jsx" || ext === "tsx")
    return <FileCode className="w-3.5 h-3.5 text-yellow-400" />;
  return <FileText className="w-3.5 h-3.5 text-muted-foreground" />;
}

function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    html: "html", css: "css", js: "javascript", ts: "typescript",
    jsx: "javascript", tsx: "typescript", json: "json", md: "markdown",
  };
  return map[ext ?? ""] ?? "plaintext";
}

function sandpackFilesFromProject(files: ProjectFile[]) {
  const result: Record<string, { code: string }> = {};
  for (const f of files) {
    result[`/${f.path}`] = { code: f.content };
  }
  return result;
}

function tryParseProjectJson(raw: string): { projectName?: string; description?: string; files?: ProjectFile[] } | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export default function BuilderPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const templateParam = params.get("template");

  const { projects, settings, chats, addProject, updateProject, addChatMessage } = useLocalStore();
  const { toast } = useToast();

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentFiles, setCurrentFiles] = useState<ProjectFile[]>(DEFAULT_FILES);
  const [activeFile, setActiveFile] = useState<string>("index.html");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hello! What would you like to build today? Describe your app or ask me to make changes." },
  ]);
  const [selectedModel, setSelectedModel] = useState(settings.model || "");
  const [previewKey, setPreviewKey] = useState(0);
  const [agentMode, setAgentMode] = useState<"agent" | "manual">("agent");

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: models } = useListModels();
  const { data: ollamaStatus } = useGetOllamaStatus({
    query: { queryKey: getGetOllamaStatusQueryKey(), refetchInterval: 10000 },
  });

  const fixMutation = useFixErrors();
  const improveMutation = useImproveDesign();

  const isLoading = isStreaming || fixMutation.isPending || improveMutation.isPending;

  useEffect(() => {
    if (templateParam && TEMPLATE_PROMPTS[templateParam]) {
      setChatInput(TEMPLATE_PROMPTS[templateParam]);
    }
  }, [templateParam]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, streamingContent]);

  useEffect(() => {
    if (models?.models?.length && !selectedModel) {
      setSelectedModel(models.models[0].name);
    }
  }, [models, selectedModel]);

  const activeFileContent = currentFiles.find((f) => f.path === activeFile)?.content ?? "";
  const activeFileLang = getLanguageFromPath(activeFile);

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return;
    setCurrentFiles((prev) =>
      prev.map((f) => (f.path === activeFile ? { ...f, content: value } : f))
    );
  };

  const pushMessage = useCallback(
    (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
      if (currentProjectId) {
        addChatMessage(currentProjectId, msg);
      }
    },
    [currentProjectId, addChatMessage]
  );

  const applyFiles = useCallback(
    (newFiles: ProjectFile[], projectName?: string, description?: string) => {
      setCurrentFiles((prev) => {
        const merged = [...prev];
        for (const nf of newFiles) {
          const idx = merged.findIndex((f) => f.path === nf.path);
          const withLang = { ...nf, language: nf.language || getLanguageFromPath(nf.path) };
          if (idx >= 0) merged[idx] = withLang;
          else merged.push(withLang);
        }
        if (merged.length > 0) setActiveFile(merged[0].path);
        return merged;
      });
      setPreviewKey((k) => k + 1);

      if (projectName) {
        setCurrentFiles((merged) => {
          if (currentProjectId) {
            updateProject(currentProjectId, { name: projectName, description: description ?? "", files: merged });
          } else {
            const p = addProject({ name: projectName, description: description ?? "", files: merged });
            setCurrentProjectId(p.id);
          }
          return merged;
        });
      } else if (currentProjectId) {
        setCurrentFiles((merged) => {
          updateProject(currentProjectId, { files: merged });
          return merged;
        });
      }
    },
    [currentProjectId, addProject, updateProject]
  );

  const stopStreaming = () => {
    abortRef.current?.abort();
  };

  const streamFromAI = useCallback(
    async (messages: { role: string; content: string }[], onComplete: (fullText: string) => void) => {
      setIsStreaming(true);
      setStreamingContent("");

      const controller = new AbortController();
      abortRef.current = controller;

      let fullText = "";

      try {
        const response = await fetch("/api/ai/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: selectedModel, messages }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const text = await response.text();
          throw new Error(`Server error: ${text}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") break;

            try {
              const event = JSON.parse(payload) as { token?: string; done?: boolean; error?: string };
              if (event.error) throw new Error(event.error);
              if (event.token) {
                fullText += event.token;
                setStreamingContent(fullText);
              }
            } catch (parseErr) {
              if ((parseErr as Error).message?.startsWith("Server error") || (parseErr as Error).message?.startsWith("Streaming")) {
                throw parseErr;
              }
            }
          }
        }

        onComplete(fullText);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          onComplete(fullText || "(stopped)");
        } else {
          const msg = err instanceof Error ? err.message : "Streaming failed";
          pushMessage({ role: "assistant", content: `Error: ${msg}` });
        }
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
        abortRef.current = null;
      }
    },
    [selectedModel, pushMessage]
  );

  const handleSend = async () => {
    const text = chatInput.trim();
    if (!text || !selectedModel) {
      if (!selectedModel) {
        toast({
          title: "No model selected",
          description: "Please configure a model in Settings or select one above.",
          variant: "destructive",
        });
      }
      return;
    }

    setChatInput("");
    pushMessage({ role: "user", content: text });

    if (agentMode === "agent") {
      const messages = [
        { role: "system", content: GENERATE_SYSTEM_PROMPT },
        { role: "user", content: `Build this: ${text}` },
      ];

      await streamFromAI(messages, (fullText) => {
        const parsed = tryParseProjectJson(fullText);
        if (parsed?.files?.length) {
          applyFiles(parsed.files, parsed.projectName, parsed.description);
          pushMessage({
            role: "assistant",
            content: `Generated "${parsed.projectName ?? "project"}" with ${parsed.files.length} file${parsed.files.length > 1 ? "s" : ""}. ${parsed.description ?? ""}`,
          });
        } else {
          pushMessage({
            role: "assistant",
            content: fullText || "The AI returned an empty response. Try rephrasing your prompt.",
          });
        }
      });
    } else {
      const messages = [
        ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: text },
      ];

      await streamFromAI(messages, (fullText) => {
        pushMessage({ role: "assistant", content: fullText });
      });
    }
  };

  const handleFixErrors = () => {
    if (!selectedModel) return;
    const filesSnapshot = currentFiles;
    const messages = [
      {
        role: "system",
        content: `You are an expert developer fixing code errors. Given the project files, fix any issues and return corrected files as JSON:
{"explanation":"...","files":[{"path":"file.js","content":"...","language":"javascript"}]}
Only include changed files. Return complete file contents.`,
      },
      {
        role: "user",
        content: `Fix errors in:\n\n${filesSnapshot.map((f) => `${f.path}:\n\`\`\`${f.language}\n${f.content}\n\`\`\``).join("\n\n")}`,
      },
    ];

    streamFromAI(messages, (fullText) => {
      const parsed = tryParseProjectJson(fullText) as { explanation?: string; files?: ProjectFile[] } | null;
      if (parsed?.files?.length) {
        applyFiles(parsed.files);
        toast({ title: "Errors fixed", description: parsed.explanation ?? "Code improved" });
      } else {
        toast({ title: "Fix complete", description: "Review the AI response in chat." });
        pushMessage({ role: "assistant", content: fullText });
      }
    });
  };

  const handleImproveDesign = () => {
    if (!selectedModel) return;
    const filesSnapshot = currentFiles;
    const messages = [
      {
        role: "system",
        content: `You are an expert UI designer. Improve the visual design of the provided code and return improved files as JSON:
{"explanation":"...","files":[{"path":"styles.css","content":"...","language":"css"}]}
Only include changed files. Return complete file contents.`,
      },
      {
        role: "user",
        content: `Improve the design of:\n\n${filesSnapshot.map((f) => `${f.path}:\n\`\`\`${f.language}\n${f.content}\n\`\`\``).join("\n\n")}`,
      },
    ];

    streamFromAI(messages, (fullText) => {
      const parsed = tryParseProjectJson(fullText) as { explanation?: string; files?: ProjectFile[] } | null;
      if (parsed?.files?.length) {
        applyFiles(parsed.files);
        toast({ title: "Design improved", description: parsed.explanation ?? "UI enhanced" });
      } else {
        toast({ title: "Improve complete", description: "Review the AI response in chat." });
        pushMessage({ role: "assistant", content: fullText });
      }
    });
  };

  const handleExportZip = async () => {
    const zip = new JSZip();
    for (const file of currentFiles) {
      zip.file(file.path, file.content);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "project.zip";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "project.zip downloaded." });
  };

  const loadProject = (p: Project) => {
    setCurrentProjectId(p.id);
    setCurrentFiles(p.files);
    setActiveFile(p.files[0]?.path ?? "index.html");
    const saved = chats[p.id] ?? [];
    setChatMessages(
      saved.length
        ? saved
        : [{ role: "assistant", content: `Loaded project "${p.name}". What would you like to change?` }]
    );
    setPreviewKey((k) => k + 1);
  };

  const sandpackFiles = sandpackFilesFromProject(currentFiles);
  const mainFile = currentFiles.find((f) => f.path === "index.html")
    ? "/index.html"
    : `/${currentFiles[0]?.path ?? "index.html"}`;

  return (
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden" data-testid="builder-page">
      {/* Toolbar */}
      <header className="h-11 flex-none border-b border-border bg-card flex items-center px-3 gap-3 z-10">
        <Link href="/" className="font-bold text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5">
          <Zap className="w-4 h-4" />
          AI Builder
        </Link>

        <div className="h-4 w-px bg-border" />

        <span className="text-xs font-mono text-muted-foreground truncate max-w-40">
          {projects.find((p) => p.id === currentProjectId)?.name ?? "Untitled Project"}
        </span>

        <div className="flex-1" />

        {/* Ollama status */}
        <div className="flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded border border-border bg-muted/50">
          {ollamaStatus?.connected ? (
            <>
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              <span className="text-green-500">Ollama</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3 text-destructive" />
              <span className="text-destructive">Offline</span>
            </>
          )}
        </div>

        {/* Model selector */}
        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger className="h-7 w-36 text-xs bg-muted border-border font-mono" data-testid="select-model">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {models?.models?.length ? (
              models.models.map((m) => (
                <SelectItem key={m.name} value={m.name} className="text-xs font-mono">
                  {m.name}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="__none__" disabled>No models found</SelectItem>
            )}
          </SelectContent>
        </Select>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-md p-0.5 border border-border">
          <Button
            variant={agentMode === "agent" ? "default" : "ghost"}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setAgentMode("agent")}
            data-testid="button-agent-mode"
          >
            Agent
          </Button>
          <Button
            variant={agentMode === "manual" ? "default" : "ghost"}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setAgentMode("manual")}
            data-testid="button-manual-mode"
          >
            Manual
          </Button>
        </div>

        <div className="h-4 w-px bg-border" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 gap-1.5 text-xs"
              onClick={handleFixErrors}
              disabled={isLoading}
              data-testid="button-fix-errors"
            >
              {fixMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
              Fix Errors
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fix bugs and errors with AI</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 gap-1.5 text-xs"
              onClick={handleImproveDesign}
              disabled={isLoading}
              data-testid="button-improve-design"
            >
              {improveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              Improve
            </Button>
          </TooltipTrigger>
          <TooltipContent>Improve design with AI</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 gap-1.5 text-xs"
              onClick={handleExportZip}
              data-testid="button-export-zip"
            >
              <Download className="w-3.5 h-3.5" />
              Export ZIP
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download project as ZIP</TooltipContent>
        </Tooltip>

        <Button
          size="sm"
          className="h-7 px-3 gap-1.5 text-xs"
          onClick={() => setPreviewKey((k) => k + 1)}
          data-testid="button-run"
        >
          <Play className="w-3.5 h-3.5" />
          Run
        </Button>

        <Link href="/settings">
          <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="button-settings">
            <Settings className="w-4 h-4" />
          </Button>
        </Link>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-56 flex-none border-r border-border bg-sidebar flex flex-col">
          {projects.length > 0 && (
            <div className="border-b border-sidebar-border">
              <div className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5" />
                Projects
              </div>
              <ScrollArea className="max-h-32">
                <div className="px-2 pb-2 space-y-0.5">
                  {projects.slice(0, 5).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => loadProject(p)}
                      data-testid={`button-project-${p.id}`}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs truncate transition-colors ${
                        currentProjectId === p.id
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5" />
            Files
          </div>
          <ScrollArea className="flex-1">
            <div className="px-2 pb-2 space-y-0.5">
              {currentFiles.map((f) => (
                <button
                  key={f.path}
                  onClick={() => setActiveFile(f.path)}
                  data-testid={`button-file-${f.path}`}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono flex items-center gap-2 transition-colors ${
                    activeFile === f.path
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                  }`}
                >
                  {getFileIcon(f.path)}
                  <span className="truncate">{f.path}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* Center — editor + chat */}
        <div className="flex-1 flex flex-col border-r border-border min-w-0">
          {/* File tabs */}
          <div className="h-9 flex-none border-b border-border bg-muted flex items-end px-2 overflow-x-auto">
            {currentFiles.slice(0, 8).map((f) => (
              <button
                key={f.path}
                onClick={() => setActiveFile(f.path)}
                data-testid={`tab-${f.path}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-t border-x border-t transition-colors shrink-0 ${
                  activeFile === f.path
                    ? "bg-background border-border text-foreground -mb-px"
                    : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {getFileIcon(f.path)}
                {f.path}
              </button>
            ))}
          </div>

          {/* Monaco editor */}
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              language={activeFileLang}
              value={activeFileContent}
              onChange={handleEditorChange}
              theme="vs-dark"
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: "on",
                wordWrap: "on",
                automaticLayout: true,
                tabSize: 2,
                padding: { top: 12 },
                renderLineHighlight: "line",
                cursorBlinking: "smooth",
              }}
            />
          </div>

          {/* Chat panel */}
          <div className="h-60 flex-none border-t border-border bg-card flex flex-col">
            <div className="px-3 py-1.5 border-b border-border flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground">
                AI Chat — {agentMode === "agent" ? "Agent mode" : "Manual mode"}
              </span>
              {isStreaming && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                  <span className="text-xs text-primary font-mono">streaming</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 ml-1 text-muted-foreground hover:text-destructive"
                    onClick={stopStreaming}
                    data-testid="button-stop-stream"
                  >
                    <Square className="w-3 h-3 fill-current" />
                  </Button>
                </div>
              )}
            </div>
            <ScrollArea className="flex-1 px-3 py-2">
              <div className="space-y-3">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}
                    data-testid={`chat-message-${i}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center text-primary flex-none mt-0.5">
                        <Zap className="w-3 h-3" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-none"
                          : "bg-muted text-foreground rounded-tl-none"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {/* Streaming bubble */}
                {isStreaming && (
                  <div className="flex gap-2" data-testid="chat-streaming-bubble">
                    <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center text-primary flex-none mt-0.5">
                      <Zap className="w-3 h-3" />
                    </div>
                    <div className="max-w-[85%] px-3 py-2 rounded-lg rounded-tl-none text-xs leading-relaxed whitespace-pre-wrap bg-muted text-foreground">
                      {streamingContent || (
                        <span className="flex gap-1 items-center text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                        </span>
                      )}
                      {streamingContent && (
                        <span className="inline-block w-0.5 h-3.5 bg-primary ml-0.5 animate-pulse align-middle" />
                      )}
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
            <div className="p-2 border-t border-border bg-background/50 flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={agentMode === "agent" ? "Describe what you want to build..." : "Ask AI anything..."}
                className="text-xs h-8 bg-card border-border font-mono"
                disabled={isLoading}
                data-testid="input-chat"
              />
              <Button
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleSend}
                disabled={isLoading || !chatInput.trim()}
                data-testid="button-send-chat"
              >
                {isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Right — Sandpack preview */}
        <div className="w-[42%] flex-none flex flex-col bg-background min-w-0">
          <div className="h-9 flex-none border-b border-border bg-muted flex items-center px-3 gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
            </div>
            <div className="flex-1 mx-2">
              <div className="h-5 bg-background rounded text-xs font-mono text-muted-foreground flex items-center justify-center border border-border px-2 truncate">
                preview
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setPreviewKey((k) => k + 1)}
                  data-testid="button-refresh-preview"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh preview</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex-1 overflow-hidden" key={previewKey}>
            <SandpackProvider
              files={sandpackFiles}
              template="vanilla"
              customSetup={{ entry: mainFile }}
              theme="dark"
            >
              <SandpackPreview
                showOpenInCodeSandbox={false}
                showRefreshButton={false}
                style={{ height: "100%", border: "none" }}
              />
            </SandpackProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
