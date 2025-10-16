
export interface Layout {
  id: string;
  name: string;
  prompt: string;
}

export interface InvoiceData {
  prestador: string;
  numeroNota: string;
  dataEmissao: string;
  valorLiquido: number;
}

export type ExtractionStatus = 'pending' | 'processing' | 'success' | 'error';

export interface ExtractionResult {
  id: string;
  file: File;
  status: ExtractionStatus;
  data?: InvoiceData;
  error?: string;
}
