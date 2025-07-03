document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores de Elementos (permanecem os mesmos) ---
    const redacaoForm = document.getElementById('redacao-form');
    const corrigirBtn = document.getElementById('corrigir-btn');
    const btnText = document.getElementById('btn-text');
    const loader = document.getElementById('loader');
    const correcaoOutput = document.getElementById('correcao-output');
    const alertContainer = document.getElementById('alert-container');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const fotoInput = document.getElementById('foto-redacao-input');
    const fotoBtn = document.getElementById('foto-redacao-btn');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const imageName = document.getElementById('image-name');
    const textoRedacaoTextarea = document.getElementById('texto-redacao');
    const initialOutput = correcaoOutput.innerHTML;
    
    let activeTab = 'digitar';
    let uploadedImageBase64 = null;

    // --- LÓGICA DAS ABAS E UPLOAD (permanece a mesma) ---
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            activeTab = button.dataset.tab;
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            tabContents.forEach(content => {
                content.id === `tab-${activeTab}` ? content.classList.add('active') : content.classList.remove('active');
            });
        });
    });
    fotoBtn.addEventListener('click', () => fotoInput.click());
    fotoInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imagePreviewContainer.style.display = 'block';
            imageName.textContent = file.name;
            uploadedImageBase64 = e.target.result.split(',')[1];
        };
        reader.readAsDataURL(file);
    });

    // --- LÓGICA PRINCIPAL DE CORREÇÃO (AGORA CHAMA NOSSO PRÓPRIO SERVIDOR) ---
    redacaoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const modelo = document.getElementById('modelo-vestibular').value;
        const tema = document.getElementById('tema').value.trim();
        const textoRedacao = textoRedacaoTextarea.value.trim();

        if ((activeTab === 'digitar' && !textoRedacao) || (activeTab === 'foto' && !uploadedImageBase64) || !tema) {
            showAlert('Por favor, preencha todos os campos necessários.');
            return;
        }

        clearAlert();
        toggleLoading(true);
        correcaoOutput.innerHTML = '<div class="placeholder"><p>Analisando sua redação... Isso pode demorar um pouco.</p></div>';

        try {
            const promptParts = generatePrompt(modelo, tema, textoRedacao, activeTab, uploadedImageBase64);
            const response = await callBackendApi(promptParts); // Chama nosso backend!
            displayCorrection(response);
        } catch (error) {
            console.error("Erro na Correção:", error);
            showAlert(`Ocorreu um erro: ${error.message}`);
            correcaoOutput.innerHTML = initialOutput;
        } finally {
            toggleLoading(false);
        }
    });

    // --- NOVA FUNÇÃO DE API (SIMPLES) ---
    async function callBackendApi(promptParts) {
        const response = await fetch('/api/corrigir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ promptParts: promptParts })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro desconhecido no servidor.');
        }
        return data;
    }

    // --- As outras funções permanecem praticamente as mesmas ---
    function generatePrompt(modelo, tema, texto, activeTab, imageBase64) {
        // Esta função não muda a lógica, apenas retorna o prompt.
        const baseJsonStructure = `
          "nota_final": "<uma nota final>", "analise_geral": {"pontos_fortes": [], "pontos_a_melhorar": []},
          "analise_criterios": [{"criterio": "<Nome>", "nota": "<Nota>", "analise": "<Análise detalhada>"}]`;
        let instruction = '';
        switch (modelo) { /* O switch case continua o mesmo */ 
            case 'enem': instruction = `Você é um corretor especialista no ENEM. Analise a redação com base nas 5 competências do ENEM. A nota final deve ser de 0 a 1000 e a nota de cada competência, de 0 a 200. Os critérios são: 'Competência 1: Domínio da norma culta', 'Competência 2: Compreensão do tema e estrutura', 'Competência 3: Coerência e argumentação', 'Competência 4: Coesão textual', 'Competência 5: Proposta de Intervenção'.`; break;
            case 'fuvest': instruction = `Você é um corretor especialista na FUVEST. Analise a redação com base nos 3 critérios da FUVEST. A nota final deve ser de 0 a 50. Os critérios são: 'Critério A: Desenvolvimento do tema e tipologia textual', 'Critério B: Coerência dos argumentos e articulação das partes do texto', 'Critério C: Correção gramatical e adequação vocabular'.`; break;
            default: instruction = `Você é um corretor de redações geral. Analise a redação com base em critérios universais. A nota final deve ser de 0 a 10. Os critérios são: 'Estrutura e Tese', 'Qualidade da Argumentação', 'Coesão e Coerência', 'Norma Culta e Vocabulário'.`; break;
        }
        
        let promptParts = [];
        if (activeTab === 'digitar') {
            promptParts.push({ "text": `${instruction}\nO tema proposto foi: "${tema}"\nA redação do aluno é:\n---\n${texto}\n---\nSua resposta DEVE ser um objeto JSON válido. Estrutura: {${baseJsonStructure}}` });
        } else {
            const ocrInstruction = `Sua tarefa é transcrever o texto manuscrito de uma folha de redação. Ignore cabeçalhos e junte palavras com hífen. Após ter o texto transcrito em mente, use-o para a seguinte análise:\n${instruction}\nO tema proposto foi: "${tema}"\n\nSua resposta final DEVE ser apenas o objeto JSON da análise. Estrutura: {${baseJsonStructure}}`;
            promptParts.push({ "text": ocrInstruction });
            promptParts.push({ "inline_data": { "mime_type": "image/jpeg", "data": imageBase64 } });
        }
        return promptParts;
    }

// A VERSÃO CORRIGIDA E MAIS SEGURA
function displayCorrection(data) {
    // Garante que temos um objeto válido antes de tentar ler
    if (!data || !data.analise_geral) {
        showAlert("A resposta da IA foi recebida, mas está incompleta.");
        console.error("Objeto de dados inválido recebido:", data);
        return;
    }

    let html = `<div style="width: 100%; text-align: left;"><div style="text-align: center;"><p style="margin: 0; font-size: 1.2rem; color: var(--text-muted-color);">Nota Final Estimada</p><div class="nota-final">${data.nota_final || "N/A"}</div></div>`;
    html += '<div class="feedback-section">';
    
    // Adiciona verificação para pontos_fortes
    if (data.analise_geral.pontos_fortes && data.analise_geral.pontos_fortes.length > 0) {
        html += '<h4>Pontos Fortes</h4><ul>';
        data.analise_geral.pontos_fortes.forEach(ponto => html += `<li>${ponto}</li>`);
        html += '</ul>';
    }

    // Adiciona verificação para pontos_a_melhorar e CORRIGE O ERRO DE DIGITAÇÃO
    if (data.analise_geral.pontos_a_melhorar && data.analise_geral.pontos_a_melhorar.length > 0) {
        html += '<h4>Pontos a Melhorar</h4><ul>';
        data.analise_geral.pontos_a_melhorar.forEach(ponto => html += `<li>${ponto}</li>`);
        html += '</ul></div>';
    }

    // Adiciona verificação para analise_criterios
    if (data.analise_criterios && data.analise_criterios.length > 0) {
        html += '<h4 style="margin-top: 2rem;">Análise por Critério</h4>';
        data.analise_criterios.forEach(item => {
            html += `<div class="criterio-card"><h3>${item.criterio} <span>${item.nota}</span></h3><p><strong>Análise:</strong> ${item.analise}</p></div>`;
        });
    }

    html += `</div>`;
    correcaoOutput.innerHTML = html;
}
    
    function toggleLoading(isLoading) {
        corrigirBtn.disabled = isLoading;
        btnText.textContent = isLoading ? 'Corrigindo...' : 'Corrigir Redação';
        loader.style.display = isLoading ? 'inline-block' : 'none';
    }
    function showAlert(message) { alertContainer.innerHTML = `<div class="alert">${message}</div>`; }
    function clearAlert() { alertContainer.innerHTML = ''; }
});