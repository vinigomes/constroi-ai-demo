# Constroi AI - Demo MCP

Este projeto demonstra uma implementação completa do **Model Context Protocol (MCP)** aplicada a um cenário de ERP de Construção Civil.

Ele é composto por 3 microsserviços:

1.  **mcp-server**: O Servidor MCP que conecta ao ERP (Supabase/Mock).
2.  **client-backend**: O Backend do Cliente que orquestra a LLM Gemini e chama o servidor MCP.
3.  **frontend-react**: A interface de chat para o usuário final.

---

## Pré-requisitos

*   Node.js (v18+)
*   Chave de API do Google Gemini (Obtenha em [aistudio.google.com](https://aistudio.google.com/))
*   (Opcional) Chave de API de um projeto Supabase, se quiser conectar ao ERP real.

---

## Como Rodar o Projeto

Você precisará de 3 terminais abertos, um para cada serviço.

### 1. Iniciar o MCP Server (Porta 3001)

Este serviço expõe as ferramentas (`verificar_estoque`, `consultar_cronograma`) via protocolo MCP (SSE).

```bash
cd mcp-server
npm install
npm run dev
```

> **Nota**: Crie um arquivo `.env` baseado no código se quiser conectar a um Supabase real. Caso contrário, o servidor pode rodar com mocks ou falhar graciosamente dependendo da implementação do `server.ts`.

### 2. Iniciar o Client Backend (Porta 3000)

Este serviço recebe as mensagens do chat, fala com o Gemini, e executa as ferramentas no MCP Server.

```bash
cd client-backend
npm install
# Crie um arquivo .env com sua chave do Gemini: GEMINI_API_KEY=sua_chave_aqui
npm run dev
```

### 3. Iniciar o Frontend (Porta 5173)

A interface visual onde você conversa com a IA.

```bash
cd frontend-react
npm install
npm run dev
```

---

## Testando

1.  Abra o frontend no navegador (geralmente `http://localhost:5173`).
2.  Digite: *"Verifique o estoque de cimento e me diga se precisamos comprar mais."*
3.  O fluxo será:
    *   Frontend -> Client Backend
    *   Client Backend -> Gemini (Analisa intenção)
    *   Client Backend -> MCP Server (Executa ferramenta `verificar_estoque`)
    *   MCP Server -> Retorna dados JSON
    *   Client Backend -> Gemini (Gera resposta final)
    *   Frontend <- Exibe resposta

## Estrutura de Pastas

*   `/mcp-server`: Node.js + Express + MCP SDK (Server)
*   `/client-backend`: Node.js + Express + MCP SDK (Client) + Gemini SDK
*   `/frontend-react`: React + Vite + TailwindCSS
