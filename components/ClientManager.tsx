
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Search, MapPin, Hash, Building2 } from 'lucide-react';
import { Client } from '../types';
import { storageService } from '../services/storageService';

const ClientManager: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState<Client>({
    id: '',
    name: '',
    mf: '',
    address: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    setClients(storageService.getClients());
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    let updatedClients;
    const clientToSave: Client = {
      ...formData,
      name: formData.name.trim(),
    };
    
    if (isEditing) {
      updatedClients = clients.map(c => c.id === formData.id ? clientToSave : c);
    } else {
      const newClient = { ...clientToSave, id: Date.now().toString() };
      updatedClients = [...clients, newClient];
    }
    
    setClients(updatedClients);
    storageService.saveClients(updatedClients);
    resetForm();
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le client "${name}" ?`)) {
      const updatedClients = clients.filter(c => c.id !== id);
      setClients(updatedClients);
      storageService.saveClients(updatedClients);
    }
  };

  const handleEdit = (client: Client) => {
    setFormData(client);
    setIsEditing(true);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({ id: '', name: '', mf: '', address: '', email: '', phone: '' });
    setIsEditing(false);
    setShowForm(false);
  };

  const filteredClients = clients.filter(c => 
    (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) || 
    (c.mf && c.mf.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gestion des Clients</h2>
          <p className="text-gray-500 text-sm mt-1">Gérez les coordonnées et informations de facturation de vos clients.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium"
        >
          <Plus size={18} /> Nouveau Client
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all">
            <h3 className="text-xl font-bold mb-4 text-gray-800">{isEditing ? 'Modifier le Client' : 'Ajouter un Client'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nom / Raison Sociale (Optionnel)</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="Ex : Société ABC ou Jean Dupont"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Matricule Fiscal (MF) (Optionnel)</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-mono"
                  value={formData.mf}
                  onChange={e => setFormData({...formData, mf: e.target.value})}
                  placeholder="Ex : 1234567/A/M/000"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Adresse Complète (Optionnel)</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  rows={3}
                  placeholder="Adresse de facturation (optionnelle)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    placeholder="client@exemple.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Téléphone</label>
                  <input
                    type="tel"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    placeholder="+216 ..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm text-sm font-semibold"
                >
                  {isEditing ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mb-6 relative">
        <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Rechercher par nom ou Matricule Fiscal..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-xs outline-none text-sm"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredClients.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
          <Building2 className="mx-auto text-gray-300 mb-3" size={40} />
          <p className="text-gray-600 font-medium">Aucun client trouvé.</p>
          <p className="text-gray-400 text-xs mt-1">Ajoutez votre premier client pour faciliter la création de vos factures.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredClients.map(client => (
            <div key={client.id} className="bg-white p-5 rounded-xl shadow-xs border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-gray-900">
                    {client.name?.trim() || (client.mf ? `Client (${client.mf})` : 'Client')}
                  </h3>
                  {client.mf && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
                      <Hash size={13} />
                      <span>MF : {client.mf}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-1.5 text-xs text-gray-600">
                    <MapPin size={13} className="mt-0.5 text-gray-400 shrink-0" />
                    <span>{client.address}</span>
                  </div>
                  {(client.email || client.phone) && (
                    <div className="text-xs text-gray-400 pt-1">
                      {client.email && <span>{client.email}</span>}
                      {client.email && client.phone && <span> • </span>}
                      {client.phone && <span>{client.phone}</span>}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(client)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Modifier le client"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(client.id, client.name)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Supprimer le client"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientManager;
