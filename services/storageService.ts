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

  // --- Nouvelle gestion Multi-Entreprises ---

  getCompanies: (): Company[] => {
    try {
      // 1. Essayer de charger la liste des entreprises
      const companiesData = localStorage.getItem(STORAGE_KEYS.COMPANIES);
      if (companiesData) {
        return JSON.parse(companiesData);
      }

      // 2. Si pas de liste, vérifier s'il y a d'anciens paramètres (migration)
      const oldSettingsData = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (oldSettingsData) {
        const oldSettings = JSON.parse(oldSettingsData);
        const migratedCompany: Company = {
          ...oldSettings,
          id: Date.now().toString(),
          isDefault: true,
          currency: 'TND'
        };
        // Sauvegarder dans le nouveau format
        localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify([migratedCompany]));
        return [migratedCompany];
      }

      // 3. Sinon, retourner l'entreprise par défaut
      return [DEFAULT_COMPANY];
    } catch (e) {
      return [DEFAULT_COMPANY];
    }
  },

  saveCompanies: (companies: Company[]) => {
    localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(companies));
  },

  // Helper pour récupérer l'entreprise par défaut ou la première disponible
  getDefaultCompany: (): Company => {
    const companies = storageService.getCompanies();
    return companies.find(c => c.isDefault) || companies[0] || DEFAULT_COMPANY;
  },

  // Deprecated but kept for compatibility if needed elsewhere temporarily
  getSettings: (): Company => {
    return storageService.getDefaultCompany();
  }
};