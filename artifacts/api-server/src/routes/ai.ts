import { Router } from "express";
import {
  ChatWithAiBody,
  GenerateProjectBody,
  FixErrorsBody,
  ImproveDesignBody,
} from "@workspace/api-zod";

const router = Router();

const DEFAULT_OLLAMA_ENDPOINT = "http://localhost:11434";

function getOllamaEndpoint(requestEndpoint?: string | null): string {
  return requestEndpoint || DEFAULT_OLLAMA_ENDPOINT;
}

router.get("/ai/status", async (req, res) => {
  const endpoint = DEFAULT_OLLAMA_ENDPOINT;
  try {
    const response = await fetch(`${endpoint}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      res.json({ connected: true, endpoint, error: null });
    } else {
      res.json({ connected: false, endpoint, error: `HTTP ${response.status}` });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.json({ connected: false, endpoint, error: message });
  }
});

router.get("/ai/models", async (req, res) => {
  const endpoint = DEFAULT_OLLAMA_ENDPOINT;
  try {
    const response = await fetch(`${endpoint}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      res.status(503).json({ error: `Ollama returned HTTP ${response.status}` });
      return;
    }
    const data = (await response.json()) as { models?: unknown[] };
    res.json({
      models: data.models ?? [],
      ollamaEndpoint: endpoint,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.warn({ err }, "Ollama not reachable");
    res.status(503).json({ error: `Cannot reach Ollama at ${endpoint}: ${message}` });
  }
});

router.post("/ai/chat", async (req, res) => {
  const parsed = ChatWithAiBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { model, messages, ollamaEndpoint: clientEndpoint } = parsed.data;
  const endpoint = getOllamaEndpoint(clientEndpoint);

  try {
    const response = await fetch(`${endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(503).json({ error: `Ollama error: ${text}` });
      return;
    }

    const data = (await response.json()) as {
      message?: { role: string; content: string };
      done?: boolean;
    };

    res.json({
      message: data.message ?? { role: "assistant", content: "" },
      done: data.done ?? true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "AI chat error");
    res.status(503).json({ error: `Cannot reach Ollama: ${message}` });
  }
});

router.post("/ai/generate", async (req, res) => {
  const parsed = GenerateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { prompt, model, template, ollamaEndpoint: clientEndpoint } = parsed.data;
  const endpoint = getOllamaEndpoint(clientEndpoint);

  const systemPrompt = `You are an expert full-stack developer. Generate complete, working web project files based on the user's description.
${template ? `The user wants to start from a ${template} template.` : ""}

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "projectName": "my-project",
  "description": "Brief description of the project",
  "files": [
    {
      "path": "index.html",
      "content": "<!DOCTYPE html>...",
      "language": "html"
    },
    {
      "path": "styles.css",
      "content": "...",
      "language": "css"
    },
    {
      "path": "script.js",
      "content": "...",
      "language": "javascript"
    }
  ]
}

Rules:
- Generate real, working, complete code — not placeholders
- Use vanilla HTML/CSS/JS unless the user asks for a framework
- Include at least index.html, styles.css, and script.js
- Make the UI look modern and professional with good styling
- Do not include any explanation text outside the JSON`;

  try {
    const response = await fetch(`${endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Build this: ${prompt}` },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(180000),
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(503).json({ error: `Ollama error: ${text}` });
      return;
    }

    const data = (await response.json()) as {
      message?: { content: string };
    };
    const content = data.message?.content ?? "{}";

    let parsed2: { projectName?: string; description?: string; files?: unknown[] };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed2 = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      parsed2 = {};
    }

    res.json({
      files: parsed2.files ?? [],
      projectName: parsed2.projectName ?? "my-project",
      description: parsed2.description ?? prompt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Generate project error");
    res.status(503).json({ error: `Cannot reach Ollama: ${message}` });
  }
});

router.post("/ai/fix", async (req, res) => {
  const parsed = FixErrorsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { files, errors, model, ollamaEndpoint: clientEndpoint } = parsed.data;
  const endpoint = getOllamaEndpoint(clientEndpoint);

  const filesContext = files
    .map((f) => `File: ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\``)
    .join("\n\n");

  const systemPrompt = `You are an expert developer fixing code errors. 
Given the project files and error messages, fix the issues and return the corrected files.

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "explanation": "What was fixed and why",
  "files": [
    {
      "path": "file.js",
      "content": "fixed content here",
      "language": "javascript"
    }
  ]
}

Only include files that were changed. Return complete file contents.`;

  try {
    const response = await fetch(`${endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Fix these errors:\n\nErrors:\n${errors}\n\nProject files:\n${filesContext}`,
          },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(503).json({ error: `Ollama error: ${text}` });
      return;
    }

    const data = (await response.json()) as {
      message?: { content: string };
    };
    const content = data.message?.content ?? "{}";

    let result: { explanation?: string; files?: unknown[] };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      result = {};
    }

    res.json({
      files: result.files ?? files,
      explanation: result.explanation ?? "Attempted to fix errors",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Fix errors error");
    res.status(503).json({ error: `Cannot reach Ollama: ${message}` });
  }
});

router.post("/ai/improve", async (req, res) => {
  const parsed = ImproveDesignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { files, model, ollamaEndpoint: clientEndpoint } = parsed.data;
  const endpoint = getOllamaEndpoint(clientEndpoint);

  const filesContext = files
    .map((f) => `File: ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\``)
    .join("\n\n");

  const systemPrompt = `You are an expert UI/UX designer and frontend developer. 
Improve the visual design and user experience of the provided code. 
Make it look modern, polished, and professional with better styling, layout, and visual hierarchy.

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "explanation": "What design improvements were made",
  "files": [
    {
      "path": "styles.css",
      "content": "improved styles here",
      "language": "css"
    }
  ]
}

Only include files that were changed. Return complete file contents.`;

  try {
    const response = await fetch(`${endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Improve the design of this project:\n\n${filesContext}`,
          },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(503).json({ error: `Ollama error: ${text}` });
      return;
    }

    const data = (await response.json()) as {
      message?: { content: string };
    };
    const content = data.message?.content ?? "{}";

    let result: { explanation?: string; files?: unknown[] };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      result = {};
    }

    res.json({
      files: result.files ?? files,
      explanation: result.explanation ?? "Design improvements applied",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Improve design error");
    res.status(503).json({ error: `Cannot reach Ollama: ${message}` });
  }
});

router.post("/ai/stream", async (req, res) => {
  const { model, messages, type = "chat", ollamaEndpoint: clientEndpoint } = req.body as {
    model?: string;
    messages?: { role: string; content: string }[];
    type?: "chat" | "generate" | "fix" | "improve";
    ollamaEndpoint?: string | null;
  };

  if (!model || !messages?.length) {
    res.status(400).json({ error: "model and messages are required" });
    return;
  }

  const endpoint = getOllamaEndpoint(clientEndpoint);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const sendDone = () => {
    res.write("data: [DONE]\n\n");
    res.end();
  };

  try {
    const response = await fetch(`${endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: AbortSignal.timeout(240000),
    });

    if (!response.ok || !response.body) {
      const text = await response.text();
      sendEvent({ error: `Ollama error: ${text}` });
      sendDone();
      return;
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
        if (!trimmed) continue;
        try {
          const chunk = JSON.parse(trimmed) as {
            message?: { content?: string };
            done?: boolean;
          };
          const token = chunk.message?.content ?? "";
          sendEvent({ token, done: chunk.done ?? false });
        } catch {
          // skip malformed lines
        }
      }
    }

    sendDone();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Streaming error");
    sendEvent({ error: `Streaming failed: ${message}` });
    sendDone();
  }
});

export default router;
