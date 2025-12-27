
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
  [key: string]: any;
}

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

export interface ExtractionResult {
  id: string;
  file: File;
  pageNumber?: number;
  status: ExtractionStatus;
  data?: InvoiceData | DetailedInvoiceData;
  error?: string;
}

export interface StoredExtractionResult {
  id: string;
  fileName: string;
  pageNumber?: number;
  status: ExtractionStatus;
  data?: InvoiceData;
  error?: string;
}

export interface SavedExtractionItem {
  id: string;
  name: string;
  timestamp: string;
  results: StoredExtractionResult[];
  totalLiquidValue: number;
}

export type ValidationStatus = 'OK' | 'Divergente' | 'Não Encontrado';

export interface ValidationResult {
    status: ValidationStatus;
    source: string;
    expectedValue?: number;
}

export interface GroundTruth {
  file: File | null;
  data: InvoiceData[];
  status: 'idle' | 'success' | 'error';
  message: string;
  detectedColumns?: string[];
}

// FIX: Added ComparisonField, ComparisonResultItem and ComparisonHistoryItem to resolve import errors in HistoryTab and ComparisonResults
export interface ComparisonField {
  status: 'match' | 'mismatch' | 'missing';
  extracted: any;
  groundTruth: any;
}

export interface ComparisonResultItem {
  numeroNota: string;
  comparisonStatus: 'perfect_match' | 'partial_mismatch' | 'not_found_in_truth';
  fields: {
    prestador: ComparisonField;
    dataEmissao: ComparisonField;
    valorLiquido: ComparisonField;
  };
}

export interface ComparisonHistoryItem {
  id: string;
  timestamp: string;
  summary: {
    matches: number;
    mismatches: number;
    total: number;
  };
  results: ComparisonResultItem[];
}

// Resolução do erro TS2580 no Netlify
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      API_KEY: string;
    }
  }
}
