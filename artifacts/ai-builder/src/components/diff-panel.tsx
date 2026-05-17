import { useState, useMemo } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { X, Plus, Minus, FileDiff, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { ProjectFile } from "@workspace/api-client-react";

export interface FileDiffInfo {
  path: string;
  language: string;
  before: string;
  after: string;
  added: number;
  removed: number;
  isNew: boolean;
}

interface DiffPanelProps {
  diffs: FileDiffInfo[];
  onClose: () => void;
}

function countChanges(before: string, after: string): { added: number; removed: number } {
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);
  const added = newLines.filter((l) => !oldSet.has(l)).length;
  const removed = oldLines.filter((l) => !newSet.has(l)).length;
  return { added, removed };
}

export function computeDiffs(prevFiles: ProjectFile[], nextFiles: ProjectFile[]): FileDiffInfo[] {
  const prevMap = new Map(prevFiles.map((f) => [f.path, f]));
  const result: FileDiffInfo[] = [];

  for (const next of nextFiles) {
    const prev = prevMap.get(next.path);
    const before = prev?.content ?? "";
    const after = next.content;

    if (before === after) continue;

    const { added, removed } = countChanges(before, after);
    result.push({
      path: next.path,
      language: next.language,
      before,
      after,
      added,
      removed,
      isNew: !prev,
    });
  }

  return result;
}

function getLanguageForDiff(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    html: "html",
    css: "css",
    js: "javascript",
    ts: "typescript",
    jsx: "javascript",
    tsx: "typescript",
    json: "json",
    md: "markdown",
  };
  return map[ext ?? ""] ?? "plaintext";
}

export function DiffPanel({ diffs, onClose }: DiffPanelProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = diffs[activeIdx];

  const totalAdded = useMemo(() => diffs.reduce((s, d) => s + d.added, 0), [diffs]);
  const totalRemoved = useMemo(() => diffs.reduce((s, d) => s + d.removed, 0), [diffs]);

  if (!active) return null;

  return (
    <div className="flex flex-col h-full bg-background" data-testid="diff-panel">
      {/* Header */}
      <div className="h-9 flex-none border-b border-border bg-muted flex items-center px-3 gap-2">
        <FileDiff className="w-3.5 h-3.5 text-primary flex-none" />
        <span className="text-xs font-semibold text-foreground">Changes</span>

        <div className="flex items-center gap-2 ml-1">
          <Badge
            variant="outline"
            className="h-4 px-1.5 text-[10px] font-mono border-green-500/40 text-green-400 bg-green-500/10"
          >
            +{totalAdded}
          </Badge>
          <Badge
            variant="outline"
            className="h-4 px-1.5 text-[10px] font-mono border-red-500/40 text-red-400 bg-red-500/10"
          >
            -{totalRemoved}
          </Badge>
        </div>

        <span className="text-xs text-muted-foreground ml-1">
          {diffs.length} file{diffs.length !== 1 ? "s" : ""} changed
        </span>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          data-testid="button-close-diff"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* File tabs */}
      <div className="flex-none border-b border-border bg-card">
        <ScrollArea orientation="horizontal">
          <div className="flex items-end px-2 h-8">
            {diffs.map((d, i) => (
              <button
                key={d.path}
                onClick={() => setActiveIdx(i)}
                data-testid={`diff-tab-${d.path}`}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded-t border-x border-t shrink-0 transition-colors ${
                  i === activeIdx
                    ? "bg-background border-border text-foreground -mb-px"
                    : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {d.isNew && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-none" />
                )}
                {!d.isNew && d.added > 0 && d.removed === 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-none" />
                )}
                {!d.isNew && d.removed > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-none" />
                )}
                {d.path}
                <span className="font-mono text-[10px] text-green-400">+{d.added}</span>
                <span className="font-mono text-[10px] text-red-400">-{d.removed}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* File info bar */}
      <div className="flex-none px-3 py-1 bg-muted/30 border-b border-border flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground/70">{active.path}</span>
        {active.isNew && (
          <Badge variant="outline" className="h-3.5 px-1 text-[9px] border-green-500/40 text-green-400">
            new file
          </Badge>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-green-400">
            <Plus className="w-2.5 h-2.5" />
            {active.added} added
          </span>
          <span className="flex items-center gap-1 text-red-400">
            <Minus className="w-2.5 h-2.5" />
            {active.removed} removed
          </span>
        </div>
        <span className="text-muted-foreground/60">side-by-side</span>
      </div>

      {/* Diff editor */}
      <div className="flex-1 overflow-hidden">
        <DiffEditor
          key={active.path}
          height="100%"
          language={getLanguageForDiff(active.path)}
          original={active.before}
          modified={active.after}
          theme="vs-dark"
          options={{
            fontSize: 12,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: "on",
            wordWrap: "off",
            automaticLayout: true,
            renderSideBySide: true,
            ignoreTrimWhitespace: false,
            diffAlgorithm: "advanced",
            padding: { top: 8 },
            renderOverviewRuler: false,
            scrollbar: { vertical: "auto", horizontal: "auto" },
          }}
        />
      </div>
    </div>
  );
}
