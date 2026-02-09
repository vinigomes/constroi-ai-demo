import express from "express";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import cors from "cors";
import "dotenv/config";
// Polyfill for EventSource in Node.js environment required by MCP SDK SSE Client
import EventSource from "eventsource";
// @ts-ignore
global.EventSource = EventSource;

const app = express();
app.use(cors());
app.use(express.json());

// Configuração do Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("Erro: GEMINI_API_KEY não definida no .env");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Conexão Global MCP
let mcpClient: Client | null = null;

async function getMcpClient() {
    if (mcpClient) return mcpClient;

    const mcpServerUrl = "http://localhost:3001/sse";
    console.log(`🔌 Conectando ao MCP Server em ${mcpServerUrl}...`);

    try {
        const transport = new SSEClientTransport(new URL(mcpServerUrl));
        mcpClient = new Client(
            { name: "ConstroiGateway", version: "1.0" },
            { capabilities: {} }
        );

        await mcpClient.connect(transport);
        console.log("✅ Conectado ao MCP Server!");
        return mcpClient;
    } catch (error) {
        console.error("❌ Falha na conexão com MCP Server:", error);
        throw error;
    }
}

app.post("/chat", async (req, res) => {
    try {
        const { message, history } = req.body;
        const client = await getMcpClient();

        // 1. Descobrir ferramentas disponíveis no Server MCP
        const toolsList = await client.listTools();
        console.log(`🛠️  Ferramentas disponíveis: ${toolsList.tools.map(t => t.name).join(", ")}`);

        // Helper para limpar schema incompatível com Gemini
        const cleanSchema = (schema: any): any => {
            if (!schema || typeof schema !== "object") return schema;

            const { additionalProperties, $schema, ...rest } = schema;

            if (rest.properties) {
                for (const key in rest.properties) {
                    rest.properties[key] = cleanSchema(rest.properties[key]);
                }
            }
            if (rest.items) {
                rest.items = cleanSchema(rest.items);
            }

            return rest;
        };

        // 2. Converter formato MCP -> Formato Gemini Tools
        const geminiTools = {
            functionDeclarations: toolsList.tools.map(t => ({
                name: t.name,
                description: t.description,
                parameters: cleanSchema(t.inputSchema)
            }))
        };

        // 3. Iniciar Chat com o Gemini
        const chat = model.startChat({
            // Convertendo o histórico do frontend para o formato do Gemini
            history: history && Array.isArray(history) ? history.map((h: any) => ({
                role: h.role,
                parts: h.parts
            })) : [],
            tools: [geminiTools]
        });

        console.log(`👤 Usuário: ${message}`);

        // 4. Enviar mensagem do usuário
        let result = await chat.sendMessage(message);
        let response = result.response;

        // 5. Loop de Execução de Ferramentas (Agent Loop)
        while (true) {
            const functionCalls = response.functionCalls();
            if (!functionCalls || functionCalls.length === 0) {
                break;
            }

            const toolParts = [];

            for (const call of functionCalls) {
                console.log(`🤖 Gemini chamando tool: ${call.name}`, call.args);

                try {
                    // Executa a ferramenta via Protocolo MCP
                    const mcpResult = await client.callTool({
                        name: call.name,
                        arguments: call.args as any
                    });

                    console.log(`📦 Resultado MCP:`, JSON.stringify(mcpResult).substring(0, 100) + "...");

                    // Prepara resposta para o Gemini
                    // Extrai o conteúdo text do MCP result
                    const textContent = mcpResult.content
                        .filter((c: any) => c.type === "text")
                        .map((c: any) => c.text)
                        .join("\n");

                    toolParts.push({
                        functionResponse: {
                            name: call.name,
                            response: {
                                result: textContent || JSON.stringify(mcpResult.content)
                            }
                        }
                    });
                } catch (err) {
                    console.error(`❌ Erro ao chamar tool ${call.name}:`, err);
                    toolParts.push({
                        functionResponse: {
                            name: call.name,
                            response: {
                                error: String(err)
                            }
                        }
                    });
                }
            }

            // Devolve o resultado da ferramenta para a IA
            result = await chat.sendMessage(toolParts);
            response = result.response;
        }

        // 6. Resposta Final (Texto)
        const finalText = response.text();
        console.log(`🤖 Resposta: ${finalText}`);
        res.json({ text: finalText });

    } catch (error) {
        console.error("❌ Erro no processamento:", error);
        res.status(500).json({ error: "Erro no processamento da IA", details: String(error) });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Client Backend rodando na porta ${PORT}`));
