
import { GoogleGenAI, Type } from "@google/genai";
import type { InvoiceData, DetailedInvoiceData } from '../types';

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

const detailedResponseSchema = {
    type: Type.OBJECT,
    properties: {
        numeroNota: { type: Type.STRING, description: 'O número da nota fiscal.' },
        dataEmissao: { type: Type.STRING, description: 'A data de emissão.' },
        cnpjPrestador: { type: Type.STRING, description: 'CNPJ do prestador de serviço.' },
        razaoSocialPrestador: { type: Type.STRING, description: 'Razão Social do prestador.' },
        cnpjTomador: { type: Type.STRING, description: 'CNPJ do tomador de serviço.' },
        razaoSocialTomador: { type: Type.STRING, description: 'Razão Social do tomador.' },
        localPrestacao: { type: Type.STRING, description: 'Local onde o serviço foi prestado.' },
        localIncidencia: { type: Type.STRING, description: 'Local de incidência do ISSQN.' },
        codigoServico: { type: Type.STRING, description: 'Código do serviço prestado.' },
        valorTotalNota: { type: Type.NUMBER, description: 'Valor total bruto da nota.' },
        aliquotaIssqn: { type: Type.NUMBER, description: 'Alíquota do ISSQN em porcentagem.' },
        inss: { type: Type.NUMBER, description: 'Valor do INSS.' },
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
             friendlyMessage = "Limite de requisições atingido. Tente novamente em breve.";
        } else {
             friendlyMessage = `Falha na comunicação com a IA: ${errorMessage}`;
        }
    }
    console.error("Erro na API Gemini:", error);
    return friendlyMessage;
}

export const extractInvoiceDataFromImage = async (base64Image: string, userPrompt: string): Promise<InvoiceData> => {
    // Inicialização interna para garantir que a API_KEY esteja pronta
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const imagePart = {
        inlineData: {
            mimeType: 'image/png',
            data: base64Image,
        },
    };

    const textPart = {
        text: `Com base na imagem da nota fiscal, extraia as seguintes informações em JSON. Instruções adicionais: ${userPrompt}`
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            }
        });

        const jsonText = response.text;
        if (!jsonText) throw new Error("A IA retornou uma resposta vazia.");
        return JSON.parse(jsonText.trim()) as InvoiceData;
    } catch (error) {
       throw new Error(handleApiError(error));
    }
};

export const extractDetailedInvoiceData = async (base64Image: string): Promise<DetailedInvoiceData> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const imagePart = {
        inlineData: {
            mimeType: 'image/png',
            data: base64Image,
        },
    };

    const textPart = {
        text: `Analise a nota fiscal e extraia os campos solicitados no formato JSON conforme o schema definido.`
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
        if (!jsonText) throw new Error("A IA retornou uma resposta vazia.");
        return JSON.parse(jsonText.trim()) as DetailedInvoiceData;
    } catch (error) {
       throw new Error(handleApiError(error));
    }
};

export const generateLayoutPromptFromImage = async (base64Image: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const imagePart = {
        inlineData: {
            mimeType: 'image/png',
            data: base64Image,
        },
    };

    const textPart = { 
        text: `Analise a imagem desta nota fiscal e crie um prompt de texto descrevendo onde encontrar: prestador, número da nota, data de emissão e valor líquido.`
    };

     try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [imagePart, textPart] },
        });

        const generatedPrompt = response.text;
        if (!generatedPrompt) throw new Error("Falha ao gerar prompt.");
        return generatedPrompt.trim();
    } catch (error) {
       throw new Error(handleApiError(error));
    }
}
