import { useState, useEffect, useContext, createContext, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import type { ProjectFile, ChatMessage } from "@workspace/api-client-react";

export interface Project {
  id: string;
  name: string;
  description: string;
  files: ProjectFile[];
  createdAt: number;
  updatedAt: number;
  template?: string;
}

export interface Settings {
  endpoint: string;
  model: string;
}

const DEFAULT_SETTINGS: Settings = {
  endpoint: "http://localhost:11434",
  model: "",
};

export interface LocalStoreValue {
  projects: Project[];
  settings: Settings;
  chats: Record<string, ChatMessage[]>;
  saveSettings: (s: Settings) => void;
  addProject: (p: Omit<Project, "id" | "createdAt" | "updatedAt">) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  addChatMessage: (projectId: string, message: ChatMessage) => void;
}

export const LocalStoreContext = createContext<LocalStoreValue | null>(null);

export function useLocalStore(): LocalStoreValue {
  const ctx = useContext(LocalStoreContext);
  if (!ctx) throw new Error("useLocalStore must be used within LocalStoreProvider");
  return ctx;
}

export function useLocalStoreState(): LocalStoreValue {
  const [projects, setProjects] = useState<Project[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({});

  useEffect(() => {
    const savedProjects = localStorage.getItem("ai-builder-projects");
    if (savedProjects) {
      try { setProjects(JSON.parse(savedProjects)); } catch (_) {}
    }

    const savedSettings = localStorage.getItem("ai-builder-settings");
    if (savedSettings) {
      try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) }); } catch (_) {}
    }

    const savedChats = localStorage.getItem("ai-builder-chats");
    if (savedChats) {
      try { setChats(JSON.parse(savedChats)); } catch (_) {}
    }
  }, []);

  const saveProjects = useCallback((newProjects: Project[]) => {
    setProjects(newProjects);
    localStorage.setItem("ai-builder-projects", JSON.stringify(newProjects));
  }, []);

  const saveSettings = useCallback((newSettings: Settings) => {
    setSettings(newSettings);
    localStorage.setItem("ai-builder-settings", JSON.stringify(newSettings));
  }, []);

  const saveChats = useCallback((newChats: Record<string, ChatMessage[]>) => {
    setChats(newChats);
    localStorage.setItem("ai-builder-chats", JSON.stringify(newChats));
  }, []);

  const addProject = useCallback((project: Omit<Project, "id" | "createdAt" | "updatedAt">) => {
    const newProject: Project = {
      ...project,
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setProjects((prev) => {
      const updated = [newProject, ...prev];
      localStorage.setItem("ai-builder-projects", JSON.stringify(updated));
      return updated;
    });
    return newProject;
  }, []);

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    setProjects((prev) => {
      const updated = prev.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
      );
      localStorage.setItem("ai-builder-projects", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const addChatMessage = useCallback((projectId: string, message: ChatMessage) => {
    setChats((prev) => {
      const projectChats = prev[projectId] || [];
      const updated = { ...prev, [projectId]: [...projectChats, message] };
      localStorage.setItem("ai-builder-chats", JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { projects, settings, chats, saveSettings, addProject, updateProject, addChatMessage };
}
