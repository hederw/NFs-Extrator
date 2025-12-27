
import { GoogleGenAI, Type } from "@google/genai";
// FIX: Corrected import to include DetailedInvoiceData
import type { InvoiceData, DetailedInvoiceData } from '../types';

// FIX: Initialized ai client using named parameters and directly referencing process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        prestador: { type: Type.STRING, description: 'Nome completo ou razão social do prestador de serviço.' },
        numeroNota: { type: Type.STRING, description: 'O número da nota fiscal.' },
        dataEmissao: { type: Type.STRING, description: 'A data de emissão no formato AAAA-MM-DD.' },
        valorLiquido: { type: Type.NUMBER, description: 'O valor líquido da nota, como um número.' },
    },
    required: ['prestador', 'numeroNota', 'dataEmissao', 'valorLiquido'],
};

// FIX: Added detailedResponseSchema for comprehensive extraction tasks
const detailedResponseSchema = {
    type: Type.OBJECT,
    properties: {
        numeroNota: { type: Type.STRING, description: 'O número da nota fiscal.' },
        dataEmissao: { type: Type.STRING, description: 'A data de emissão.' },
        cnpjPrestador: { type: Type.STRING, description: 'CNPJ do prestador de serviço (apenas números ou formatado).' },
        razaoSocialPrestador: { type: Type.STRING, description: 'Razão Social do prestador.' },
        cnpjTomador: { type: Type.STRING, description: 'CNPJ do tomador de serviço.' },
        razaoSocialTomador: { type: Type.STRING, description: 'Razão Social do tomador.' },
        localPrestacao: { type: Type.STRING, description: 'Local onde o serviço foi prestado (Cidade/UF).' },
        localIncidencia: { type: Type.STRING, description: 'Local de incidência do ISSQN.' },
        codigoServico: { type: Type.STRING, description: 'Código do serviço prestado.' },
        valorTotalNota: { type: Type.NUMBER, description: 'Valor total bruto da nota.' },
        aliquotaIssqn: { type: Type.NUMBER, description: 'Alíquota do ISSQN em porcentagem (ex: 5.0).' },
        inss: { type: Type.NUMBER, description: 'Valor do INSS retido ou calculado.' },
        issRetido: { type: Type.NUMBER, description: 'Valor do ISS retido.' },
    },
    required: [
        'numeroNota', 'dataEmissao',
        'cnpjPrestador', 'razaoSocialPrestador', 'cnpjTomador', 'razaoSocialTomador',
        'localPrestacao', 'localIncidencia', 'codigoServico', 'valorTotalNota',
        'aliquotaIssqn', 'inss', 'issRetido'
    ],
};

const handleApiError = (error: unknown): string => {
    let friendlyMessage = "Ocorreu um erro desconhecido durante a comunicação com a IA.";

    if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error as {message: string}).message;
        if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
             friendlyMessage = "Limite de requisições da API atingido. Por favor, aguarde um momento e tente novamente.";
        } else if (errorMessage.includes('json')) {
             friendlyMessage = "A IA retornou um formato inesperado. Por favor, verifique o prompt ou tente novamente."
        }
        else {
             friendlyMessage = `Falha na comunicação com a IA: ${errorMessage}`;
        }
    } else if (error instanceof Error) {
        friendlyMessage = `Falha na comunicação com a IA: ${error.message}`;
    }
    
    console.error("Erro na API Gemini:", error);
    return friendlyMessage;
}

export const extractInvoiceDataFromImage = async (base64Image: string, userPrompt: string): Promise<InvoiceData> => {
    const imagePart = {
        inlineData: {
            mimeType: 'image/png',
            data: base64Image,
        },
    };

    const textPart = {
        text: `Com base na imagem da nota fiscal, extraia as seguintes informações em formato JSON. Instruções adicionais: ${userPrompt}`
    };

    try {
        const response = await ai.models.generateContent({
            // FIX: Using gemini-3-flash-preview as recommended for text/extraction tasks
            model: 'gemini-3-flash-preview',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            }
        });

        // FIX: Replaced method call with property access for response.text
        const jsonText = response.text;
        if (!jsonText) throw new Error("A IA retornou uma resposta vazia.");
        
        const parsedData = JSON.parse(jsonText.trim()) as InvoiceData;

        if (!parsedData.prestador || !parsedData.numeroNota || !parsedData.dataEmissao || parsedData.valorLiquido == null) {
            throw new Error("Resposta da IA está incompleta ou mal formatada.");
        }

        return parsedData;

    } catch (error) {
       throw new Error(handleApiError(error));
    }
};

// FIX: Added missing extractDetailedInvoiceData function implementation
export const extractDetailedInvoiceData = async (base64Image: string): Promise<DetailedInvoiceData> => {
    const imagePart = {
        inlineData: {
            mimeType: 'image/png',
            data: base64Image,
        },
    };

    const textPart = {
        text: `Analise a nota fiscal e extraia EXATAMENTE os seguintes campos em formato JSON:
        1. Número da Nota
        2. Data de Emissão
        3. CNPJ do Prestador
        4. Razão Social do Prestador
        5. CNPJ do Tomador
        6. Razão Social do Tomador
        7. Local de Prestação de Serviço
        8. Local de Incidência do ISSQN
        9. Código do Serviço
        10. Valor Total da Nota
        11. Alíquota ISSQN
        12. INSS
        13. ISS Retido
        
        IMPORTANTE: Se algum valor monetário ou percentual não estiver explícito na imagem, use 0. Se algum campo de texto não for encontrado, use uma string vazia ("").`
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: detailedResponseSchema,
            }
        });

        const jsonText = response.text;
        if (!jsonText) {
            throw new Error("A IA retornou uma resposta de texto vazia ou inválida.");
        }
        return JSON.parse(jsonText.trim()) as DetailedInvoiceData;

    } catch (error) {
       throw new Error(handleApiError(error));
    }
};

export const generateLayoutPromptFromImage = async (base64Image: string): Promise<string> => {
    const imagePart = {
        inlineData: {
            mimeType: 'image/png',
            data: base64Image,
        },
    };

    const metaPrompt = `
      Analise a imagem desta nota fiscal. Seu objetivo é criar um prompt de texto eficaz para que OUTRO modelo de IA possa extrair as seguintes informações:
      - 'prestador': O nome ou razão social do prestador de serviços.
      - 'numeroNota': O número principal da nota fiscal.
      - 'dataEmissao': A data em que a nota foi emitida.
      - 'valorLiquido': O valor final ou total líquido da nota.

      Para cada campo, descreva sua localização precisa e quaisquer rótulos ou textos próximos que ajudem a identificá-lo.
      Seja conciso e direto.
    `;

    const textPart = { text: metaPrompt };

     try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [imagePart, textPart] },
        });

        // FIX: Corrected text extraction using property access
        const generatedPrompt = response.text;
        if (!generatedPrompt) {
            throw new Error("A IA não conseguiu gerar um prompt. A imagem pode estar ilegível.");
        }
        
        return generatedPrompt.trim();

    } catch (error) {
       throw new Error(handleApiError(error));
    }
}
