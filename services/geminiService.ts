
import { GoogleGenAI, Type } from "@google/genai";
import type { InvoiceData, DetailedInvoiceData } from '../types';

// O cliente é inicializado usando a chave de API do ambiente
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        prestador: { 
            type: Type.STRING, 
            description: 'Nome completo, Razão Social ou Nome Fantasia do prestador de serviço.' 
        },
        numeroNota: { 
            type: Type.STRING, 
            description: 'O número da nota fiscal ou número do documento.' 
        },
        dataEmissao: { 
            type: Type.STRING, 
            description: 'A data de emissão no formato DD/MM/AAAA.' 
        },
        valorLiquido: { 
            type: Type.NUMBER, 
            description: 'O valor líquido ou total da nota, apenas números (ex: 1250.50).' 
        },
    },
    required: ['prestador', 'numeroNota', 'dataEmissao', 'valorLiquido'],
};

// FIX: Added detailedResponseSchema for the extractDetailedInvoiceData function
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
    console.error("Erro na API Gemini:", error);
    if (error instanceof Error) {
        if (error.message.includes('429')) return "Limite de requisições atingido. Tente novamente em instantes.";
        return `Erro na extração: ${error.message}`;
    }
    return "Erro desconhecido na comunicação com a IA.";
}

export const extractInvoiceDataFromImage = async (base64Image: string, userPrompt: string = ''): Promise<InvoiceData> => {
    const imagePart = {
        inlineData: {
            mimeType: 'image/png',
            data: base64Image,
        },
    };

    const textPart = {
        text: `Extraia os dados desta nota fiscal brasileira. 
        - Prestador: Procure por Razão Social ou Nome do Emitente.
        - Número: Procure por Número da Nota ou NFS-e.
        - Data: Procure por Data de Emissão.
        - Valor Líquido: Procure por Valor Líquido, Valor Total dos Serviços ou Total da Nota.
        
        Instruções extras do usuário: ${userPrompt}`
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
        if (!jsonText) throw new Error("Resposta vazia da IA.");
        
        return JSON.parse(jsonText.trim()) as InvoiceData;
    } catch (error) {
       throw new Error(handleApiError(error));
    }
};

// FIX: Exported extractDetailedInvoiceData to resolve the missing member error in DetailedExtractTab
export const extractDetailedInvoiceData = async (base64Image: string): Promise<DetailedInvoiceData> => {
    const imagePart = {
        inlineData: {
            mimeType: 'image/png',
            data: base64Image,
        },
    };

    const textPart = {
        text: `Analise a nota fiscal brasileira e extraia EXATAMENTE os seguintes campos em formato JSON conforme o esquema fornecido.`
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

    const metaPrompt = `Analise a estrutura desta nota fiscal e crie um guia curto de onde encontrar o Prestador, Número, Data e Valor Total.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [imagePart, { text: metaPrompt }] },
        });
        return response.text?.trim() || "Não foi possível gerar instruções automáticas.";
    } catch (error) {
       throw new Error(handleApiError(error));
    }
}
