document.addEventListener('DOMContentLoaded', () => {
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
            const response = await callBackendApi(promptParts); 
            displayCorrection(response);
        } catch (error) {
            console.error("Erro na Correção:", error);
            showAlert(`Ocorreu um erro: ${error.message}`);
            correcaoOutput.innerHTML = initialOutput;
        } finally {
            toggleLoading(false);
        }
    });

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

    function generatePrompt(modelo, tema, texto, activeTab, imageBase64) {
        const baseJsonStructure = `
          "nota_final": "<uma nota final, ex: 850/1000, 8/10, ou um conceito como 'Bom'>",
          "analise_geral": {
            "pontos_fortes": ["<Ponto forte 1>", "<Ponto forte 2>"],
            "pontos_a_melhorar": ["<Ponto a melhorar 1, citando trecho>", "<Ponto a melhorar 2>"]
          },
          "analise_criterios": [
            {
              "criterio": "<Nome do Critério 1>",
              "nota": "<Nota para este critério>",
              "analise": "<Análise detalhada do critério com exemplos do texto.>"
            }
          ]
        `;

        let instruction = '';
        switch (modelo) {
            case 'enem':
                instruction = `Você é um corretor especialista no ENEM. Analise a redação com base nas 5 competências do ENEM. A nota final deve ser de 0 a 1000. Para cada competência, você deve atribuir uma das seguintes pontuações: 0, 40, 80, 120, 160 ou 200. A nota de cada competência deve refletir o nível de desempenho do candidato. ...`;
                break;
            case 'fuvest':
                instruction = `Você é um corretor especialista na FUVEST. Analise a redação com base nos 3 critérios da FUVEST. A nota final deve ser de 0 a 50. Os critérios são: 'Critério A: Desenvolvimento do tema e tipologia textual', 'Critério B: Coerência dos argumentos e articulação das partes do texto', 'Critério C: Correção gramatical e adequação vocabular'.`;
                break;
            case 'unicamp':
                instruction = `Você é um corretor especialista na UNICAMP. A UNICAMP valoriza a originalidade, a adequação ao gênero textual solicitado e o diálogo com os textos-base. Analise a redação com base nesses aspectos. A nota final deve ser de 0 a 12. Os critérios são: 'Proposta Temática', 'Gênero Textual', 'Leitura e Uso dos Textos de Apoio', 'Correção e Adequação'.`;
                break;
            case 'vunesp':
                instruction = `Você é um corretor especialista da banca VUNESP. Analise a redação com base nos 3 critérios da VUNESP. A nota final deve ser de 0 a 28 (ou outra, dependendo do edital, use o bom senso). Os critérios são: 'Critério A: Tema e Gênero/Tipologia Textual', 'Critério B: Coerência e Coesão', 'Critério C: Modalidade (Norma Padrão)'.`;
                break;
            default: 
                instruction = `Você é um corretor de redações geral. Analise a redação com base em critérios universais de um bom texto dissertativo-argumentativo. A nota final deve ser de 0 a 10. Os critérios são: 'Estrutura e Tese', 'Qualidade da Argumentação', 'Coesão e Coerência', 'Norma Culta e Vocabulário'.`;
                break;
        }
        
        let promptParts = [];
        if (activeTab === 'digitar') {
            promptParts.push({ "text": `${instruction}\nO tema proposto foi: "${tema}"\nA redação do aluno é:\n---\n${texto}\n---\nSua resposta DEVE ser um objeto JSON válido e completo. A estrutura é: {${baseJsonStructure}}` });
        } else { 
            const ocrInstruction = `Sua tarefa é transcrever o texto manuscrito de uma folha de redação. Siga estas regras:\n1. Ignore o cabeçalho (ex: "FOLHA DE REDAÇÃO", "Data:", etc.).\n2. Transcreva APENAS o corpo da redação.\n3. Junte palavras separadas por hífen no final da linha (ex: "contemporâ-neo" vira "contemporâneo").\n\nApós ter o texto transcrito em mente, use-o para a seguinte análise:\n${instruction}\nO tema proposto foi: "${tema}"\n\nSua resposta final DEVE ser apenas o objeto JSON da análise. A estrutura é: {${baseJsonStructure}}`;
            promptParts.push({ "text": ocrInstruction });
            promptParts.push({ "inline_data": { "mime_type": "image/jpeg", "data": imageBase64 } });
        }
        return promptParts;
    }

    function displayCorrection(data) {
        if (!data || !data.analise_geral) {
            showAlert("A resposta da IA foi recebida, mas está incompleta.");
            console.error("Objeto de dados inválido recebido:", data);
            correcaoOutput.innerHTML = initialOutput;
            return;
        }

        let html = `<div style="width: 100%; text-align: left;"><div style="text-align: center;"><p style="margin: 0; font-size: 1.2rem; color: var(--text-muted-color);">Nota Final Estimada</p><div class="nota-final">${data.nota_final || "N/A"}</div></div>`;
        html += '<div class="feedback-section">';
        
        if (data.analise_geral.pontos_fortes && data.analise_geral.pontos_fortes.length > 0) {
            html += '<h4>Pontos Fortes</h4><ul>';
            data.analise_geral.pontos_fortes.forEach(ponto => html += `<li>${ponto}</li>`);
            html += '</ul>';
        }

        if (data.analise_geral.pontos_a_melhorar && data.analise_geral.pontos_a_melhorar.length > 0) {
            html += '<h4>Pontos a Melhorar</h4><ul>';
            data.analise_geral.pontos_a_melhorar.forEach(ponto => html += `<li>${ponto}</li>`);
            html += '</ul>';
        }
        html += '</div>';

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