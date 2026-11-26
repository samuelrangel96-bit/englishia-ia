
import { useState, useRef } from "react";
import "./App.css";

type Message = {
  role: "user" | "assistant";
  content: string;
};

function App() {
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Message[]>([]);
  const [translation, setTranslation] = useState("");
  const [translated, setTranslated] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("Aguardando você começar...");
  const recognition = useRef<any>(null);

  async function api(path: string, data: object) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Erro no servidor");
    }

    return result;
  }

  function speak(text: string) {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const voice = new SpeechSynthesisUtterance(text);
    voice.lang = "en-US";
    voice.rate = 0.9;

    window.speechSynthesis.speak(voice);
  }

  async function sendMessage(text?: string) {
    const current = (text ?? message).trim();

    if (!current || loading) return;

    setLoading(true);
    setMessage("");

    setHistory((old) => [
      ...old,
      { role: "user", content: current },
    ]);

    try {
      const data = await api("/api/chat", {
        message: current,
        history: history,
      });

      if (!data.reply) throw new Error("Resposta vazia");

      setHistory((old) => [
        ...old,
        { role: "assistant", content: data.reply },
      ]);

      speak(data.reply);

    } catch (error: any) {
      setHistory((old) => [
        ...old,
        {
          role: "assistant",
          content: "Não consegui conectar ao professor. " +
            (error.message || "Tente novamente."),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function startVoice() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatus("Use o Google Chrome para reconhecimento de voz.");
      return;
    }

    if (listening) return;

    const instance = new SpeechRecognition();

    instance.lang = "en-US";
    instance.continuous = false;
    instance.interimResults = false;

    instance.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setStatus("Você disse: " + text);
      sendMessage(text);
    };

    instance.onerror = (event: any) => {
      setStatus("Erro no microfone: " + event.error);
      setListening(false);
    };

    instance.onend = () => {
      setListening(false);
    };

    recognition.current = instance;

    try {
      instance.start();
      setListening(true);
      setStatus("Estou ouvindo você...");
    } catch {
      setStatus("Não foi possível iniciar o microfone.");
      setListening(false);
    }
  }

  function stopVoice() {
    if (recognition.current) {
      recognition.current.stop();
    }

    window.speechSynthesis?.cancel();
    setListening(false);
    setStatus("Conversa pausada.");
  }

  async function translateText() {
    if (!translation.trim()) return;

    setTranslated("Traduzindo...");

    try {
      const data = await api("/api/translate", {
        text: translation,
      });

      setTranslated(data.translation);
    } catch {
      setTranslated("Erro ao traduzir. Verifique o servidor.");
    }
  }

  return (
    <main className="english-app">
      <header className="app-header">
        <h1>English AI</h1>
        <p>Seu professor particular de inglês com IA</p>
      </header>

      <section className="app-card">
        <h2>🎙️ Conversação</h2>
        <p>Pratique inglês falando naturalmente.</p>

        <button className="primary" onClick={startVoice}
          disabled={listening}>
          {listening ? "Ouvindo você..." : "Começar a falar"}
        </button>

        <button className="secondary" onClick={stopVoice}>
          Parar conversa
        </button>

        <p className="status">{status}</p>
      </section>

      <section className="app-card">
        <h2>💬 Professor de inglês</h2>

        <div className="chat-history">
          {history.map((item, index) => (
            <div
              key={index}
              className={"chat-message " + item.role}
            >
              <strong>
                {item.role === "user" ? "Você" : "Professor"}
              </strong>
              <p>{item.content}</p>
            </div>
          ))}

          {loading && <p>Professor está pensando...</p>}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Escreva sua frase em inglês..."
        />

        <button
          className="primary"
          onClick={() => sendMessage()}
          disabled={loading || !message.trim()}
        >
          Enviar mensagem
        </button>
      </section>

      <section className="app-card">
        <h2>🌎 Tradutor</h2>

        <input
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          placeholder="Digite uma frase para traduzir"
        />

        <button className="primary" onClick={translateText}>
          Traduzir
        </button>

        <p className="translation-result">{translated}</p>
      </section>

      <footer>
        <p>English AI • Aprenda inglês conversando</p>
      </footer>
    </main>
  );
}

export default App;
