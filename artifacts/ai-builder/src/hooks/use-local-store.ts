import { useState, useEffect } from "react";
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

export function useLocalStore() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({});

  useEffect(() => {
    const savedProjects = localStorage.getItem("ai-builder-projects");
    if (savedProjects) {
      try { setProjects(JSON.parse(savedProjects)); } catch (e) {}
    }

    const savedSettings = localStorage.getItem("ai-builder-settings");
    if (savedSettings) {
      try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) }); } catch (e) {}
    }

    const savedChats = localStorage.getItem("ai-builder-chats");
    if (savedChats) {
      try { setChats(JSON.parse(savedChats)); } catch (e) {}
    }
  }, []);

  const saveProjects = (newProjects: Project[]) => {
    setProjects(newProjects);
    localStorage.setItem("ai-builder-projects", JSON.stringify(newProjects));
  };

  const saveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    localStorage.setItem("ai-builder-settings", JSON.stringify(newSettings));
  };

  const saveChats = (newChats: Record<string, ChatMessage[]>) => {
    setChats(newChats);
    localStorage.setItem("ai-builder-chats", JSON.stringify(newChats));
  };

  const addProject = (project: Omit<Project, "id" | "createdAt" | "updatedAt">) => {
    const newProject: Project = {
      ...project,
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveProjects([newProject, ...projects]);
    return newProject;
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    const newProjects = projects.map((p) =>
      p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
    );
    saveProjects(newProjects);
  };

  const addChatMessage = (projectId: string, message: ChatMessage) => {
    const projectChats = chats[projectId] || [];
    saveChats({ ...chats, [projectId]: [...projectChats, message] });
  };

  return {
    projects,
    settings,
    chats,
    saveSettings,
    addProject,
    updateProject,
    addChatMessage,
  };
}
