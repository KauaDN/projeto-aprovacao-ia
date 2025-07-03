const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Carrega as variáveis do arquivo .env
dotenv.config();

const app = express();
const port = 3000;

// Configuração para aceitar JSONs maiores (por causa da imagem em Base64)
app.use(express.json({ limit: '10mb' }));

// Inicializa o cliente do Gemini com a chave da API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Serve os arquivos estáticos (HTML, CSS, JS) da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- O NOVO ENDPOINT DE CORREÇÃO ---
app.post('/api/corrigir', async (req, res) => {
    try {
        const { promptParts } = req.body;

        if (!promptParts) {
            return res.status(400).json({ error: 'Payload da requisição inválido.' });
        }

        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash-latest",
            generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent({
            contents: [{ parts: promptParts }]
        });
        
        const response = result.response;
        const text = response.text();

        // Envia a resposta JSON perfeita e completa de volta para o navegador
        res.json(JSON.parse(text));

    } catch (error) {
        console.error('ERRO NO SERVIDOR AO CHAMAR A API GEMINI:', error);
        res.status(500).json({ error: 'Falha ao se comunicar com a API do Gemini no servidor.', details: error.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 Super Corretor rodando! Acesse em http://localhost:${port}`);
});