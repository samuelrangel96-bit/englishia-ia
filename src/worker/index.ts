
import { Hono } from "hono";
import { cors } from "hono/cors";

type ChatRole = "system" | "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type Bindings = {
  AI: {
    run(
      model: string,
      options: {
        messages: ChatMessage[];
        max_tokens: number;
      }
    ): Promise<{ response?: string }>;
  };
};

const app = new Hono<{ Bindings: Bindings }>();

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

app.use(
  "/api/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

app.get("/api/health", (c) => {
  return c.json({
    status: "online",
    app: "English AI",
    ai: "configured"
  });
});

app.post("/api/chat", async (c) => {
  try {
    const body = await c.req.json<{
      message?: unknown;
      history?: unknown[];
    }>();

    if (
      typeof body.message !== "string" ||
      !body.message.trim()
    ) {
      return c.json({ error: "Digite uma mensagem." }, 400);
    }

    const message = body.message.trim();

    if (message.length > 2000) {
      return c.json({
        error: "A mensagem deve ter até 2000 caracteres."
      }, 400);
    }

    const history: ChatMessage[] = (body.history ?? [])
      .filter((item): item is ChatMessage => {
        if (!item || typeof item !== "object") return false;

        const value = item as Record<string, unknown>;

        return (
          (value.role === "user" || value.role === "assistant") &&
          typeof value.content === "string"
        );
      })
      .slice(-12)
      .map((item) => ({
        role: item.role,
        content: item.content.slice(0, 2000)
      }));

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `
You are English AI, a friendly and natural English teacher.

RULES:
- Continue the conversation naturally.
- Never simply repeat the student's message.
- Answer the student's actual question.
- Speak in simple, natural English.
- Ask a relevant follow-up question when appropriate.
- Correct mistakes AFTER answering.
- Explain corrections briefly in Brazilian Portuguese.
- If the student's English is correct, say something encouraging.
- Adapt to beginner and intermediate students.

Use this format:

Natural response in English.

Correção: (only when necessary)
Corrected sentence: ...
Explanation: (brief explanation in Portuguese)

Keep the conversation friendly and educational.
`
      },
      ...history,
      {
        role: "user",
        content: message
      }
    ];

    const result = await c.env.AI.run(MODEL, {
      messages,
      max_tokens: 500
    });

    if (!result.response?.trim()) {
      return c.json({
        error: "O professor não conseguiu responder."
      }, 502);
    }

    return c.json({
      reply: result.response.trim()
    });

  } catch (error) {
    console.error("CHAT ERROR:", error);

    return c.json({
      error: "Falha ao conectar com o professor."
    }, 500);
  }
});

app.post("/api/translate", async (c) => {
  try {
    const body = await c.req.json<{ text?: unknown }>();

    if (
      typeof body.text !== "string" ||
      !body.text.trim()
    ) {
      return c.json({ error: "Digite um texto." }, 400);
    }

    if (body.text.length > 5000) {
      return c.json({
        error: "O texto deve ter até 5000 caracteres."
      }, 400);
    }

    const result = await c.env.AI.run(MODEL, {
      messages: [
        {
          role: "system",
          content: `
You are a professional English-Portuguese translator.

Detect the language automatically:
- If the input is English, translate into Brazilian Portuguese.
- If the input is Portuguese, translate into natural English.
- Preserve the original meaning and tone.
- Return only the translation.
`
        },
        {
          role: "user",
          content: body.text.trim()
        }
      ],
      max_tokens: 700
    });

    if (!result.response?.trim()) {
      return c.json({
        error: "Não foi possível traduzir."
      }, 502);
    }

    return c.json({
      translation: result.response.trim()
    });

  } catch (error) {
    console.error("TRANSLATE ERROR:", error);

    return c.json({
      error: "Falha na tradução."
    }, 500);
  }
});

app.notFound((c) => {
  return c.json({
    error: "Rota não encontrada."
  }, 404);
});

export default app;
