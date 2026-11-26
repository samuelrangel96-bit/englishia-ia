
import { useState, useRef } from "react";
import "./App.css";

type Message = {
  role: "user" | "assistant";
  content: string;
};

function App() {
  const [history, setHistory] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [translation, setTranslation] = useState("");
  const [translated, setTranslated] = useState("");
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("Pronto para conversar!");
  const recognition = useRef<any>(null);

  async function requestAPI(path: string, data: object) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Erro na conexão.");
    }

    return result;
  }

  function speak(text: string) {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const englishPart = text.split(
      /(?:Correção|Correction|Explicação|Explanation):/i
    )[0].trim();

    if (!englishPart) return;

    const utterance = new SpeechSynthesisUtterance(englishPart);
    utterance.lang = "en-US";
    utterance.rate = 0.9;

    window.speechSynthesis.speak(utterance);
  }

  async function sendMessage(text?: string) {
    const current = (text ?? message).trim();

    if (!current || loading) return;

    const previousHistory = history;

    setLoading(true);
    setMessage("");

    try {
      const data = await requestAPI("/api/chat", {
        message: current,
        history: previousHistory,
      });

      if (!data.reply) throw new Error("Resposta vazia.");

      setHistory([
        ...previousHistory,
        { role: "user", content: current },
        { role: "assistant", content: data.reply },
      ]);

      speak(data.reply);
    } catch (error: any) {
      setHistory([
        ...previousHistory,
        { role: "user", content: current },
        {
          role: "assistant",
          content: "Não consegui conectar ao professor. " +
            error.message,
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
      setStatus("Reconhecimento de voz indisponível. Use o Chrome.");
      return;
    }

    if (listening || loading) return;

    const instance = new SpeechRecognition();

    instance.lang = "en-US";
    instance.continuous = false;
    instance.interimResults = false;

    instance.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setStatus("Você disse: " + text);
      void sendMessage(text);
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
      setListening(false);
      setStatus("Não foi possível iniciar o microfone.");
    }
  }

  function stopVoice() {
    recognition.current?.stop();
    window.speechSynthesis?.cancel();
    setListening(false);
    setStatus("Conversa pausada.");
  }

  async function translateText() {
    if (!translation.trim() || translating) return;

    setTranslating(true);
    setTranslated("Traduzindo...");

    try {
      const data = await requestAPI("/api/translate", {
        text: translation,
      });

      setTranslated(data.translation);
    } catch (error: any) {
      setTranslated("Erro: " + error.message);
    } finally {
      setTranslating(false);
    }
  }

  return (
    <main className="app">

      <header className="header">
        <div className="brand-icon">AI</div>
        <h1>English AI</h1>
        <p>Seu professor particular de inglês</p>
        <span className="online">● Seu aprendizado começa aqui</span>
      </header>

      <section className="card">
        <h2>🎙️ Conversação</h2>
        <p>Fale em inglês e pratique com seu professor.</p>

        <button
          className="primary"
          onClick={startVoice}
          disabled={listening || loading}
        >
          {listening ? "Ouvindo você..." : "Começar a falar"}
        </button>

        <button className="secondary" onClick={stopVoice}>
          Parar conversa
        </button>

        <p className="status">{status}</p>
      </section>

      <section className="card">
        <h2>💬 Professor de inglês</h2>
        <p>Converse naturalmente e receba correções.</p>

        <div className="chat">
          {history.length === 0 && (
            <div className="welcome">
              Hello! I'm your English teacher.
              <br />
              What would you like to talk about today?
            </div>
          )}

          {history.map((item, index) => (
            <div key={index} className={`bubble ${item.role}`}>
              <strong>
                {item.role === "user" ? "Você" : "Professor"}
              </strong>
              <p>{item.content}</p>
            </div>
          ))}

          {loading && (
            <div className="thinking">Professor está pensando...</div>
          )}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write something in English..."
        />

        <button
          className="primary"
          onClick={() => void sendMessage()}
          disabled={loading || !message.trim()}
        >
          {loading ? "Enviando..." : "Enviar mensagem"}
        </button>

        <button
          className="secondary"
          onClick={() => setHistory([])}
        >
          Nova conversa
        </button>
      </section>

      <section className="card">
        <h2>🌎 Tradutor inteligente</h2>
        <p>Traduza entre português e inglês.</p>

        <input
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          placeholder="Digite sua frase..."
        />

        <button
          className="primary"
          onClick={() => void translateText()}
          disabled={translating || !translation.trim()}
        >
          {translating ? "Traduzindo..." : "Traduzir"}
        </button>

        {translated && (
          <div className="translation">
            <strong>Tradução:</strong>
            <p>{translated}</p>
          </div>
        )}
      </section>

      <footer>
        English AI © 2026
        <p>Aprenda inglês no seu ritmo.</p>
      </footer>

    </main>
  );
}

export default App;
