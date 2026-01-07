
import { GoogleGenAI, Type } from "@google/genai";
import type { InvoiceData, DetailedInvoiceData } from '../types';

// O cliente é inicializado usando a chave de API injetada pelo ambiente
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        prestador: { 
            type: Type.STRING, 
            description: 'Nome completo ou Razão Social do prestador de serviço.' 
        },
        numeroNota: { 
            type: Type.STRING, 
            description: 'O número da nota fiscal.' 
        },
        dataEmissao: { 
            type: Type.STRING, 
            description: 'A data de emissão no formato DD/MM/AAAA.' 
        },
        valorLiquido: { 
            type: Type.NUMBER, 
            description: 'O valor líquido da nota (apenas números).' 
        },
    },
    required: ['prestador', 'numeroNota', 'dataEmissao', 'valorLiquido'],
};

const detailedResponseSchema = {
    type: Type.OBJECT,
    properties: {
        numeroNota: { type: Type.STRING },
        dataEmissao: { type: Type.STRING },
        cnpjPrestador: { type: Type.STRING },
        razaoSocialPrestador: { type: Type.STRING },
        cnpjTomador: { type: Type.STRING },
        razaoSocialTomador: { type: Type.STRING },
        localPrestacao: { type: Type.STRING },
        localIncidencia: { type: Type.STRING },
        codigoServico: { type: Type.STRING },
        valorTotalNota: { type: Type.NUMBER },
        aliquotaIssqn: { type: Type.NUMBER },
        inss: { type: Type.NUMBER },
        issRetido: { type: Type.NUMBER },
    },
    required: [
        'numeroNota', 'dataEmissao', 'cnpjPrestador', 'razaoSocialPrestador',
        'cnpjTomador', 'razaoSocialTomador', 'valorTotalNota'
    ],
};

const handleApiError = (error: any): string => {
    console.error("Erro Gemini:", error);
    if (error?.message?.includes('429')) return "Limite de requisições atingido. Aguarde um momento.";
    return `Erro na extração: ${error?.message || 'Erro desconhecido'}`;
};

export const extractInvoiceDataFromImage = async (base64Image: string, promptExtra: string = ''): Promise<InvoiceData> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: base64Image } },
                    { text: `Extraia os dados desta nota fiscal. ${promptExtra}` }
                ]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema
            }
        });
        return JSON.parse(response.text || '{}');
    } catch (error) {
        throw new Error(handleApiError(error));
    }
};

export const extractDetailedInvoiceData = async (base64Image: string): Promise<DetailedInvoiceData> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: base64Image } },
                    { text: "Extraia todos os detalhes técnicos e impostos desta nota fiscal." }
                ]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: detailedResponseSchema
            }
        });
        return JSON.parse(response.text || '{}');
    } catch (error) {
        throw new Error(handleApiError(error));
    }
};

export const generateLayoutPromptFromImage = async (base64Image: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: base64Image } },
                    { text: "Descreva brevemente a estrutura desta nota fiscal para ajudar na extração futura." }
                ]
            }
        });
        return response.text || "Layout padrão detectado.";
    } catch (error) {
        throw new Error(handleApiError(error));
    }
};
