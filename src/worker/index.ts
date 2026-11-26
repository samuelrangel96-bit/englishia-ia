
import { Hono } from "hono";

interface AIResult {
  response?: string;
}

interface AIModel {
  run(
    model: string,
    options: {
      messages: Array<{
        role: "system" | "user" | "assistant";
        content: string;
      }>;
      max_tokens?: number;
    }
  ): Promise<AIResult>;
}

type Bindings = {
  AI: AIModel;
};

const app = new Hono<{ Bindings: Bindings }>();

const MODEL = "@cf/meta/llama-3.1-8b-instruct";

const TEACHER_PROMPT = `
You are English AI, a friendly and natural English teacher.

Your job:
1. Continue conversations naturally. Never just repeat what the student says.
2. Answer the student's message with a relevant response.
3. Ask a natural follow-up question when appropriate.
4. Correct English mistakes gently AFTER answering.
5. Explain corrections briefly in Brazilian Portuguese.
6. Adapt your English to the student's level.
7. Encourage the student to speak more.
8. Do not invent corrections when the sentence is already correct.

Use this format when a correction is needed:

[Your natural response in English]

Correction: [corrected sentence]
Explanation: [short explanation in Portuguese]

Keep conversations friendly and natural.
`;

app.get("/api/", (c) => {
  return c.json({
    name: "English AI",
    status: "online",
    message: "Professor de inglês disponível"
  });
});

app.post("/api/chat", async (c) => {
  try {
    const body = await c.req.json<{
      message?: string;
      history?: Array<{
        role: string;
        content: string;
      }>;
    }>();

    const message = body.message?.trim();

    if (!message) {
      return c.json({ error: "Digite uma mensagem." }, 400);
    }

    if (!c.env.AI) {
      return c.json({
        error: "Workers AI não está conectado. Configure o binding AI."
      }, 503);
    }

    const history = Array.isArray(body.history)
      ? body.history
          .filter(
            (item) =>
              (item.role === "user" ||
                item.role === "assistant") &&
              typeof item.content === "string"
          )
          .slice(-12)
          .map((item) => ({
            role: item.role as "user" | "assistant",
            content: item.content.slice(0, 3000)
          }))
      : [];

    const messages = [
      {
        role: "system" as const,
        content: TEACHER_PROMPT
      },
      ...history,
      {
        role: "user" as const,
        content: message
      }
    ];

    const result = await c.env.AI.run(MODEL, {
      messages,
      max_tokens: 500
    });

    const reply = result.response?.trim();

    if (!reply) {
      return c.json({
        error: "O professor não conseguiu gerar uma resposta."
      }, 502);
    }

    return c.json({ reply });

  } catch (error) {
    console.error("Chat error:", error);

    return c.json({
      error: "Erro ao conversar com o professor."
    }, 500);
  }
});

app.post("/api/translate", async (c) => {
  try {
    const body = await c.req.json<{
      text?: string;
    }>();

    const text = body.text?.trim();

    if (!text) {
      return c.json({
        error: "Digite um texto para traduzir."
      }, 400);
    }

    if (!c.env.AI) {
      return c.json({
        error: "Workers AI não está conectado. Configure o binding AI."
      }, 503);
    }

    const result = await c.env.AI.run(MODEL, {
      messages: [
        {
          role: "system",
          content:
            "Translate the user's text into Brazilian Portuguese. " +
            "Preserve the original meaning and tone. " +
            "Return only the translation."
        },
        {
          role: "user",
          content: text.slice(0, 5000)
        }
      ],
      max_tokens: 500
    });

    const translation = result.response?.trim();

    if (!translation) {
      return c.json({
        error: "Não foi possível realizar a tradução."
      }, 502);
    }

    return c.json({ translation });

  } catch (error) {
    console.error("Translation error:", error);

    return c.json({
      error: "Erro ao traduzir o texto."
    }, 500);
  }
});

export default app;
