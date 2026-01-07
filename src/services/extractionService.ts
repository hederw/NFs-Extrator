
import type { InvoiceData, DetailedInvoiceData } from '../types';

const MINDEE_INVOICE_URL = 'https://api.mindee.net/v1/products/mindee/invoices/v4/predict';

const handleApiError = async (response: Response): Promise<string> => {
    try {
        const errorData = await response.json();
        const mindeeMessage = errorData.api_request?.error?.message;
        const details = errorData.api_request?.error?.details;
        
        if (response.status === 401) {
            return "Erro de Autorização (401): A chave informada é inválida ou não tem permissão para o produto 'Invoices'. Verifique no seu painel da Mindee.";
        }
        if (response.status === 403) {
            return "Acesso Negado (403): Verifique se o produto 'Invoices' está ativado e se você tem créditos disponíveis.";
        }
        if (response.status === 429) {
            return "Limite atingido (429): Muitas requisições simultâneas ou limite da sua conta Mindee excedido.";
        }
        
        return mindeeMessage || `Erro HTTP ${response.status}${details ? `: ${JSON.stringify(details)}` : ''}`;
    } catch {
        return `Erro de comunicação com o Mindee (HTTP ${response.status})`;
    }
};

/**
 * Extrai dados básicos usando Mindee Invoices API
 */
export const extractInvoiceDataWithMindee = async (file: File, apiKey: string): Promise<InvoiceData> => {
    // Remove espaços e garante que a chave existe
    const cleanKey = apiKey?.trim();
    if (!cleanKey) throw new Error("API Key do Mindee não configurada.");

    const formData = new FormData();
    formData.append('document', file);

    try {
        const response = await fetch(MINDEE_INVOICE_URL, {
            method: 'POST',
            headers: {
                // FORMATO CRÍTICO: 'Token <chave>'
                'Authorization': `Token ${cleanKey}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorMessage = await handleApiError(response);
            throw new Error(errorMessage);
        }

        const result = await response.json();
        const prediction = result.document.inference.prediction;

        // Mapeamento dos campos da Mindee para nossa interface
        return {
            prestador: prediction.supplier_name?.value || "Não identificado",
            numeroNota: prediction.invoice_number?.value || "S/N",
            dataEmissao: prediction.date?.value || "",
            valorLiquido: prediction.total_amount?.value || 0,
        };
    } catch (error: any) {
        console.error("Erro Mindee API:", error);
        throw new Error(error.message || "Erro desconhecido na conexão com o Mindee");
    }
};

/**
 * Extrai dados detalhados usando Mindee
 */
export const extractDetailedInvoiceDataWithMindee = async (file: File, apiKey: string): Promise<DetailedInvoiceData> => {
    const cleanKey = apiKey?.trim();
    if (!cleanKey) throw new Error("API Key do Mindee não configurada.");

    const formData = new FormData();
    formData.append('document', file);

    try {
        const response = await fetch(MINDEE_INVOICE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${cleanKey}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorMessage = await handleApiError(response);
            throw new Error(errorMessage);
        }

        const result = await response.json();
        const prediction = result.document.inference.prediction;

        return {
            numeroNota: prediction.invoice_number?.value || "",
            dataEmissao: prediction.date?.value || "",
            cnpjPrestador: prediction.supplier_registration?.[0]?.value || "",
            razaoSocialPrestador: prediction.supplier_name?.value || "",
            cnpjTomador: prediction.customer_registration?.[0]?.value || "",
            razaoSocialTomador: prediction.customer_name?.value || "",
            localPrestacao: prediction.supplier_address?.value || "",
            localIncidencia: "", 
            codigoServico: "", 
            valorTotalNota: prediction.total_amount?.value || 0,
            aliquotaIssqn: 0,
            inss: 0,
            issRetido: 0
        };
    } catch (error: any) {
        throw new Error(error.message || "Falha na conexão com o Mindee");
    }
};
