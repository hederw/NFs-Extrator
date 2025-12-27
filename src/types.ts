
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
  // FIX: Added index signature to allow dynamic property access (e.g., in ResultsTable)
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
  data?: InvoiceData | DetailedInvoiceData; // Atualizado para suportar ambos os tipos
  error?: string;
}

// Uma versão do ExtractionResult que pode ser armazenada com segurança no localStorage (sem o objeto File)
export interface StoredExtractionResult {
  id: string;
  fileName: string;
  pageNumber?: number;
  status: ExtractionStatus;
  data?: InvoiceData; // Mantido como simples para extrações salvas por enquanto
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
  detectedColumns?: string[]; // Adicionado para feedback ao usuário
}

// FIX: Add missing types for comparison results and history.
export type FieldComparisonStatus = 'match' | 'mismatch' | 'missing';

export interface FieldComparison {
    status: FieldComparisonStatus;
    extracted: string | number | null;
    groundTruth: string | number | null;
}

export type OverallComparisonStatus = 'perfect_match' | 'partial_mismatch' | 'not_found_in_truth';

export interface ComparisonResultItem {
    numeroNota: string;
    comparisonStatus: OverallComparisonStatus;
    fields: {
        prestador: FieldComparison;
        dataEmissao: FieldComparison;
        valorLiquido: FieldComparison;
    };
}

export interface ComparisonSummary {
    total: number;
    matches: number;
    mismatches: number;
    notFound: number;
}

export interface ComparisonHistoryItem {
    id: string;
    timestamp: string;
    results: ComparisonResultItem[];
    summary: ComparisonSummary;
}
