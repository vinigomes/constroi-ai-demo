import React, { useState } from 'react';
import { Send, Bot, User } from 'lucide-react';

function App() {
    const [messages, setMessages] = useState<Array<{ role: 'user' | 'model', text: string }>>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const sendMessage = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setLoading(true);

        try {
            // Chama nosso Client Backend
            const response = await fetch('http://localhost:3000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMsg,
                    // Convertendo histórico para formato do Gemini se necessário
                    history: messages.map(m => ({
                        role: m.role,
                        parts: [{ text: m.text }]
                    }))
                })
            });

            const data = await response.json();
            setMessages(prev => [...prev, { role: 'model', text: data.text }]);
        } catch (error) {
            console.error("Erro no chat", error);
            setMessages(prev => [...prev, { role: 'model', text: "Erro ao conectar com a IA. Verifique se o backend está rodando." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen max-w-2xl mx-auto bg-gray-50 border-x font-sans">
            <header className="bg-white border-b p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                    CA
                </div>
                <div>
                    <h1 className="font-bold text-gray-800">Constroi AI</h1>
                    <p className="text-xs text-gray-500">Powered by Gemini & MCP</p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center text-gray-400 mt-20">
                        <Bot size={48} className="mx-auto mb-4 opacity-20" />
                        <p>Olá! Sou o assistente da Constroi AI.</p>
                        <p className="text-sm">Pergunte sobre estoques, obras ou cronogramas.</p>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-green-600'
                            }`}>
                            {msg.role === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
                        </div>
                        <div className={`p-3 rounded-lg max-w-[80%] ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border shadow-sm text-gray-800'
                            }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                            <Bot size={16} className="text-white" />
                        </div>
                        <div className="bg-white border shadow-sm p-3 rounded-lg text-gray-500 text-sm animate-pulse">
                            Consultando ferramentas e processando...
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 bg-white border-t flex gap-2">
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    placeholder="Ex: Como está o estoque de cimento?"
                    disabled={loading}
                    className="flex-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <button
                    onClick={sendMessage}
                    disabled={loading || !input.trim()}
                    className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Send size={20} />
                </button>
            </div>
        </div>
    );
}

export default App
