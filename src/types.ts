
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
  totalPages?: number;
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

export interface GlobalProcessingState {
    isActive: boolean;
    current: number;
    total: number;
    filename: string;
}

// FIX: Added ComparisonFieldResult, ComparisonResultItem, and ComparisonHistoryItem to support comparison and history features.
export interface ComparisonFieldResult {
  extracted: any;
  groundTruth: any;
  status: 'match' | 'mismatch' | 'missing';
}

export interface ComparisonResultItem {
  numeroNota: string;
  comparisonStatus: 'perfect_match' | 'partial_mismatch' | 'not_found_in_truth';
  fields: {
    prestador: ComparisonFieldResult;
    dataEmissao: ComparisonFieldResult;
    valorLiquido: ComparisonFieldResult;
  };
}

export interface ComparisonHistoryItem {
  id: string;
  timestamp: string;
  results: ComparisonResultItem[];
  summary: {
    total: number;
    matches: number;
    mismatches: number;
    notFound: number;
  };
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      API_KEY: string;
    }
  }
}
