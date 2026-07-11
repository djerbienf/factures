
export interface Client {
  id: string;
  name: string;
  mf: string; // Matricule Fiscal
  address: string;
  email?: string;
  phone?: string;
}

export interface Company {
  id: string;
  name: string;
  mf: string;
  address: string;
  email?: string;
  phone?: string;
  logoUrl?: string;
  isDefault?: boolean;
  currency?: 'TND' | 'EUR'; // Devise par défaut de l'entreprise
  
  // Nouveaux champs pour le papier en tête
  letterheadUrl?: string; // Image de fond (Base64)
  hideCompanyInfoOnPdf?: boolean; // Masquer les infos textes si le papier en tête les contient déjà
}

export interface InvoiceItem {
  id: string;
  description: string;
  unit: string; // Ajout de l'unité (U, Kg, M, etc.)
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  type: 'facture' | 'devis'; // Distinction Facture / Devis
  number: string;
  date: string;
  dueDate: string;
  clientId: string;
  clientSnap: Client;
  companySnap: Company;
  items: InvoiceItem[];
  tvaApplicable: boolean; // Option Sans TVA
  tvaRate: number;
  timbreFiscal?: boolean; // Option Timbre Fiscal (1.000)
  notes?: string;
  status: 'brouillon' | 'payée' | 'en_attente' | 'accepté' | 'refusé';
  currency: 'TND' | 'EUR'; // La devise spécifique de cette facture
}

export type ViewState = 'dashboard' | 'clients' | 'create-invoice' | 'history' | 'settings';
