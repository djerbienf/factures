import { Client, Invoice, Company } from '../types';

const STORAGE_KEYS = {
  CLIENTS: 'factupro_clients',
  INVOICES: 'factupro_invoices',
  SETTINGS: 'factupro_settings', // Ancien format (objet unique)
  COMPANIES: 'factupro_companies', // Nouveau format (tableau)
};

const DEFAULT_COMPANY: Company = {
  id: 'default_1',
  name: "Ma Société Exemplaire",
  mf: "1234567/A/M/000",
  address: "123 Rue du Commerce, 1000 Tunis",
  email: "contact@masociete.com",
  phone: "+216 71 000 000",
  isDefault: true,
  currency: 'TND'
};

export const triggerJsonDownload = (data: any, filename: string) => {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const storageService = {
  getClients: (): Client[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CLIENTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Error loading clients", e);
      return [];
    }
  },

  saveClients: (clients: Client[]) => {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  },

  getInvoices: (): Invoice[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.INVOICES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Error loading invoices", e);
      return [];
    }
  },

  saveInvoices: (invoices: Invoice[]) => {
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
  },

  // --- Multi-Entreprises ---

  getCompanies: (): Company[] => {
    try {
      const companiesData = localStorage.getItem(STORAGE_KEYS.COMPANIES);
      if (companiesData) {
        return JSON.parse(companiesData);
      }

      const oldSettingsData = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (oldSettingsData) {
        const oldSettings = JSON.parse(oldSettingsData);
        const migratedCompany: Company = {
          ...oldSettings,
          id: Date.now().toString(),
          isDefault: true,
          currency: 'TND'
        };
        localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify([migratedCompany]));
        return [migratedCompany];
      }

      return [DEFAULT_COMPANY];
    } catch (e) {
      return [DEFAULT_COMPANY];
    }
  },

  saveCompanies: (companies: Company[]) => {
    localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(companies));
  },

  getDefaultCompany: (): Company => {
    const companies = storageService.getCompanies();
    return companies.find(c => c.isDefault) || companies[0] || DEFAULT_COMPANY;
  },

  getSettings: (): Company => {
    return storageService.getDefaultCompany();
  },

  // --- Export / Import & Duplication d'une Facture ---

  exportInvoiceJSON: (invoice: Invoice) => {
    const safeDocNumber = (invoice.number || 'document').replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `${invoice.type === 'devis' ? 'devis' : 'facture'}-${safeDocNumber}.json`;
    triggerJsonDownload(invoice, filename);
  },

  importInvoiceData: (raw: any): Invoice => {
    if (!raw || typeof raw !== 'object') {
      throw new Error("Le fichier fourni n'est pas un fichier JSON valide.");
    }
    
    // Auto-save client if present
    const clients = storageService.getClients();
    let client = raw.clientSnap || clients.find(c => c.id === raw.clientId);
    if (!client && raw.clientId) {
      client = {
        id: raw.clientId,
        name: raw.clientSnap?.name || "Client Importé",
        mf: raw.clientSnap?.mf || "",
        address: raw.clientSnap?.address || "",
        email: raw.clientSnap?.email || "",
        phone: raw.clientSnap?.phone || ""
      };
      storageService.saveClients([...clients, client]);
    } else if (client && !clients.some(c => c.id === client.id)) {
      storageService.saveClients([...clients, client]);
    }

    // Auto-save company if present
    const companies = storageService.getCompanies();
    let company = raw.companySnap || companies.find(c => c.id === raw.companySnap?.id);
    if (company && !companies.some(c => c.id === company.id)) {
      storageService.saveCompanies([...companies, company]);
    }

    const defaultComp = storageService.getDefaultCompany();
    const importedInvoice: Invoice = {
      id: raw.id || Date.now().toString(),
      type: raw.type === 'devis' ? 'devis' : 'facture',
      number: raw.number || `IMP-${Date.now().toString().slice(-4)}`,
      date: raw.date || new Date().toISOString().split('T')[0],
      dueDate: raw.dueDate || '',
      clientId: client?.id || (clients[0]?.id || ''),
      clientSnap: client || clients[0] || { id: 'temp', name: 'Client Inconnu', mf: '', address: '' },
      companySnap: company || defaultComp,
      items: Array.isArray(raw.items) && raw.items.length > 0 ? raw.items.map((it: any, idx: number) => ({
        id: it.id || `item_${idx}_${Date.now()}`,
        description: it.description || '',
        unit: it.unit || 'U',
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0
      })) : [{ id: '1', description: 'Prestation', unit: 'U', quantity: 1, unitPrice: 0 }],
      tvaApplicable: raw.tvaApplicable !== false,
      tvaRate: typeof raw.tvaRate === 'number' ? raw.tvaRate : 19,
      timbreFiscal: Boolean(raw.timbreFiscal),
      notes: raw.notes || '',
      status: raw.status || 'en_attente',
      currency: raw.currency === 'EUR' ? 'EUR' : 'TND'
    };

    const existing = storageService.getInvoices();
    const existsIndex = existing.findIndex(inv => inv.id === importedInvoice.id);
    if (existsIndex >= 0) {
      existing[existsIndex] = importedInvoice;
      storageService.saveInvoices(existing);
    } else {
      storageService.saveInvoices([importedInvoice, ...existing]);
    }

    return importedInvoice;
  },

  duplicateInvoice: (invoiceId: string): Invoice | null => {
    const invoices = storageService.getInvoices();
    const source = invoices.find(inv => inv.id === invoiceId);
    if (!source) return null;

    const year = new Date().getFullYear();
    const nextNum = invoices.length + 1;
    const newNumber = `${year}-${String(nextNum).padStart(4, '0')}`;

    const newInvoice: Invoice = {
      ...source,
      id: Date.now().toString(),
      number: newNumber,
      date: new Date().toISOString().split('T')[0],
      dueDate: '',
      status: 'en_attente'
    };

    storageService.saveInvoices([newInvoice, ...invoices]);
    return newInvoice;
  },

  // --- Sauvegarde & Restauration Totale ---

  exportFullBackup: () => {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      clients: storageService.getClients(),
      companies: storageService.getCompanies(),
      invoices: storageService.getInvoices()
    };
    const dateStr = new Date().toISOString().split('T')[0];
    triggerJsonDownload(backup, `factupro-sauvegarde-complete-${dateStr}.json`);
  },

  restoreFullBackup: (jsonData: any) => {
    if (!jsonData || typeof jsonData !== 'object') {
      throw new Error("Fichier de sauvegarde invalide.");
    }
    if (Array.isArray(jsonData.clients)) {
      storageService.saveClients(jsonData.clients);
    }
    if (Array.isArray(jsonData.companies) && jsonData.companies.length > 0) {
      storageService.saveCompanies(jsonData.companies);
    }
    if (Array.isArray(jsonData.invoices)) {
      storageService.saveInvoices(jsonData.invoices);
    }
  }
};