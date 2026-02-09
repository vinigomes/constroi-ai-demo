import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import cors from "cors";
import "dotenv/config";

// Configuração da API do ERP (Supabase)
// Em produção, use variáveis de ambiente reais. Aqui definimos um fallback para o exemplo.
const ERP_BASE_URL = process.env.ERP_API_URL || "https://vjzbhzjtiwnlogrssccd.supabase.co/functions/v1";
const ERP_KEY = process.env.ERP_API_KEY;

// Inicializa o servidor MCP
const server = new McpServer({
    name: "Constroi AI - ERP Gateway",
    version: "2.0.0"
});

// Helper para chamadas autenticadas ao ERP
async function fetchErp(endpoint: string, params: URLSearchParams) {
    const url = `${ERP_BASE_URL}/${endpoint}?${params.toString()}`;
    console.log(`[MCP] Fetching ERP: ${url}`);

    try {
        const resp = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${ERP_KEY}`,
                "Content-Type": "application/json"
            }
        });

        if (!resp.ok) {
            throw new Error(`Erro ERP (${resp.status}): ${resp.statusText}`);
        }
        return await resp.json();
    } catch (error) {
        console.error(`[MCP] Erro ao conectar ao ERP:`, error);
        // Retorna um erro amigável ou dados mockados se a conexão falhar (para teste)
        return { error: "Falha na conexão com o ERP", details: String(error) };
    }
}

// --- Tool 1: Estoque (Conectada ao ERP) ---
server.tool(
    "verificar_estoque",
    "Consulta disponibilidade e preço de materiais em tempo real",
    {
        busca: z.string().optional().describe("Nome do material (ex: cimento, tijolo)"),
        apenas_baixo_estoque: z.boolean().optional().describe("Filtrar apenas itens abaixo do mínimo")
    },
    async ({ busca, apenas_baixo_estoque }) => {
        const params = new URLSearchParams();
        if (busca) params.append("busca", busca);
        if (apenas_baixo_estoque) params.append("abaixo_minimo", "true");

        const dados = await fetchErp("estoque", params);

        return {
            content: [{ type: "text", text: JSON.stringify(dados, null, 2) }]
        };
    }
);

// --- Tool 2: Cronograma de Obras ---
server.tool(
    "consultar_cronograma",
    "Verifica o andamento e datas das etapas de uma obra",
    {
        obra_id: z.string().describe("ID da obra (ex: obra-001)")
    },
    async ({ obra_id }) => {
        const dados = await fetchErp(`cronograma/${obra_id}`, new URLSearchParams());
        return {
            content: [{ type: "text", text: JSON.stringify(dados, null, 2) }]
        };
    }
);

// --- Tool 3: Consultar Obras ---
server.tool(
    "consultar_obras",
    "Lista e consulta informações sobre obras em andamento ou concluídas",
    {
        status: z.enum(["em_andamento", "concluida", "pausada", "todas"]).optional().describe("Filtrar obras por status"),
        busca: z.string().optional().describe("Buscar obra por nome ou localização")
    },
    async ({ status, busca }) => {
        const params = new URLSearchParams();
        if (status && status !== "todas") params.append("status", status);
        if (busca) params.append("busca", busca);

        const dados = await fetchErp("obras", params);
        return {
            content: [{ type: "text", text: JSON.stringify(dados, null, 2) }]
        };
    }
);

// --- Transporte HTTP (SSE) ---
const app = express();
app.use(cors());
app.use(express.json());

let transport: SSEServerTransport | undefined;

// Endpoint SSE para conexão persistente
app.get("/sse", async (req, res) => {
    console.log("Nova conexão MCP (SSE) iniciada");
    transport = new SSEServerTransport("/messages", res);
    await server.connect(transport);
});

// Endpoint para receber comandos
app.post("/messages", async (req, res) => {
    console.log("Nova mensagem MCP recebida");
    if (transport) {
        await transport.handlePostMessage(req, res, req.body);
    } else {
        res.status(503).send("Server not connected");
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`🏗️  Constroi AI MCP Server rodando na porta ${PORT} via SSE`);
    console.log(`📡 Endpoint SSE: http://localhost:${PORT}/sse`);
});
