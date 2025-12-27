
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
  // Add index signature for dynamic field access
  [key: string]: any;
}

// FIX: Added DetailedInvoiceData to support the detailed extraction functionality
export interface DetailedInvoiceData {
  numeroNota: string;
  dataEmissao: string;
  cnpjPrestador: string;
  razaoSocialPrestador: string;
  cnpjTomador: string;
  razaoSocialTomador: string;
  localPrestacao: string;
  localIncidencia: string;
  codigoServico: string;
  valorTotalNota: number;
  aliquotaIssqn: number;
  inss: number;
  issRetido: number;
}

export type ExtractionStatus = 'pending' | 'processing' | 'success' | 'error';

// FIX: Added optional pageNumber and updated data type to support DetailedInvoiceData
export interface ExtractionResult {
  id: string;
  file: File;
  pageNumber?: number;
  status: ExtractionStatus;
  data?: InvoiceData | DetailedInvoiceData;
  error?: string;
}

// FIX: Added StoredExtractionResult for history and persistence
export interface StoredExtractionResult {
  id: string;
  fileName: string;
  pageNumber?: number;
  status: ExtractionStatus;
  data?: InvoiceData;
  error?: string;
}

// FIX: Added types for validation results against spreadsheets
export type ValidationStatus = 'OK' | 'Divergente' | 'Não Encontrado';

export interface ValidationResult {
    status: ValidationStatus;
    source: string;
    expectedValue?: number;
}

// FIX: Added GroundTruth to represent spreadsheet data for validation
export interface GroundTruth {
  file: File | null;
  data: InvoiceData[];
  status: 'idle' | 'success' | 'error';
  message: string;
  detectedColumns?: string[];
}
