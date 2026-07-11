
import React, { useState, useEffect } from 'react';
import { Save, Building2, Plus, Trash2, Edit2, CheckCircle, Banknote, Image as ImageIcon, EyeOff, Upload } from 'lucide-react';
import { Company } from '../types';
import { storageService } from '../services/storageService';

const Settings: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState<Company>({
    id: '',
    name: '',
    mf: '',
    address: '',
    email: '',
    phone: '',
    isDefault: false,
    currency: 'TND',
    letterheadUrl: '',
    hideCompanyInfoOnPdf: false
  });

  useEffect(() => {
    setCompanies(storageService.getCompanies());
  }, []);

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      mf: '',
      address: '',
      email: '',
      phone: '',
      isDefault: false,
      currency: 'TND',
      letterheadUrl: '',
      hideCompanyInfoOnPdf: false
    });
    setIsEditing(false);
    setShowForm(false);
  };

  const handleEdit = (company: Company) => {
    setFormData({ 
      ...company, 
      currency: company.currency || 'TND',
      letterheadUrl: company.letterheadUrl || '',
      hideCompanyInfoOnPdf: company.hideCompanyInfoOnPdf || false
    });
    setIsEditing(true);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (companies.length <= 1) {
      alert("Impossible de supprimer la dernière entreprise.");
      return;
    }
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette entreprise ?")) {
      const newCompanies = companies.filter(c => c.id !== id);
      // Si on a supprimé l'entreprise par défaut, on met la première comme défaut
      if (!newCompanies.some(c => c.isDefault)) {
        newCompanies[0].isDefault = true;
      }
      setCompanies(newCompanies);
      storageService.saveCompanies(newCompanies);
    }
  };

  const handleSetDefault = (id: string) => {
    const newCompanies = companies.map(c => ({
      ...c,
      isDefault: c.id === id
    }));
    setCompanies(newCompanies);
    storageService.saveCompanies(newCompanies);
  };

  // Gestion de l'upload d'image
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Vérification basique taille (max 2MB conseillé pour localStorage)
      if (file.size > 2 * 1024 * 1024) {
        alert("L'image est trop volumineuse (max 2Mo conseillé).");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, letterheadUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let updatedCompanies: Company[];

    if (isEditing) {
      updatedCompanies = companies.map(c => c.id === formData.id ? formData : c);
    } else {
      const newCompany = { ...formData, id: Date.now().toString() };
      // Si c'est la première entreprise, elle devient défaut automatiquement
      if (companies.length === 0) newCompany.isDefault = true;
      updatedCompanies = [...companies, newCompany];
    }

    // Assurer qu'une seule entreprise est par défaut si celle-ci l'est
    if (formData.isDefault) {
      updatedCompanies = updatedCompanies.map(c => ({
        ...c,
        isDefault: c.id === (isEditing ? formData.id : updatedCompanies[updatedCompanies.length-1].id)
      }));
    } else if (!updatedCompanies.some(c => c.isDefault) && updatedCompanies.length > 0) {
       // Sécurité: toujours avoir un défaut
       updatedCompanies[0].isDefault = true;
    }

    setCompanies(updatedCompanies);
    storageService.saveCompanies(updatedCompanies);
    resetForm();
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Mes Entreprises Émettrices</h2>
          <p className="text-gray-500 text-sm mt-1">Gérez les différentes entités pour vos facturations.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={18} /> Ajouter une Entreprise
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
               <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                 <Building2 size={24} />
               </div>
               <h3 className="text-xl font-bold text-gray-800">{isEditing ? 'Modifier' : 'Ajouter'} une Entreprise</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Informations de base */}
                <div className="col-span-2 md:col-span-1 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la Société</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ex: Ma Société SARL"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Matricule Fiscal (MF)</label>
                      <input
                        type="text"
                        required
                        value={formData.mf}
                        onChange={e => setFormData({...formData, mf: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ex: 1234567/A/M/000"
                      />
                    </div>

                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Adresse Complète</label>
                       <textarea
                         rows={2}
                         required
                         value={formData.address}
                         onChange={e => setFormData({...formData, address: e.target.value})}
                         className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                       />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                          <input
                            type="text"
                            value={formData.phone || ''}
                            onChange={e => setFormData({...formData, phone: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                          <input
                            type="email"
                            value={formData.email || ''}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                    </div>
                </div>

                {/* Section Droite : Papier en tête & Devise */}
                <div className="col-span-2 md:col-span-1 space-y-6">
                    {/* Papier en tête */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <div className="flex items-center gap-2 mb-3 text-gray-800 font-semibold">
                         <ImageIcon size={18} className="text-purple-600" />
                         <h3>Papier en tête (Arrière-plan)</h3>
                      </div>
                      
                      <div className="mb-4">
                        {formData.letterheadUrl ? (
                          <div className="relative w-full h-32 bg-white rounded-lg border border-gray-300 overflow-hidden group">
                            <img src={formData.letterheadUrl} alt="Preview" className="w-full h-full object-cover opacity-80" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button 
                                 type="button"
                                 onClick={() => setFormData({...formData, letterheadUrl: ''})}
                                 className="text-white bg-red-600 p-2 rounded-full hover:bg-red-700"
                               >
                                 <Trash2 size={16} />
                               </button>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 bg-white">
                             <Upload size={24} className="mb-2" />
                             <span className="text-xs text-center px-2">Cliquez pour uploader une image<br/>(Format A4 JPG/PNG)</span>
                          </div>
                        )}
                        
                        {!formData.letterheadUrl && (
                             <input 
                                type="file" 
                                accept="image/*"
                                onChange={handleFileChange}
                                className="mt-2 w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                             />
                        )}
                      </div>

                      <label className="flex items-start gap-2 cursor-pointer">
                         <input 
                           type="checkbox"
                           checked={formData.hideCompanyInfoOnPdf}
                           onChange={e => setFormData({...formData, hideCompanyInfoOnPdf: e.target.checked})}
                           className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                         />
                         <span className="text-sm text-gray-700 leading-tight">
                           <span className="font-semibold block flex items-center gap-1"><EyeOff size={14} /> Masquer mes infos sur le PDF</span>
                           <span className="text-xs text-gray-500">Cochez cette case si votre papier en tête contient déjà votre logo, adresse, MF, etc.</span>
                         </span>
                      </label>
                    </div>

                    {/* Sélecteur de Devise */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                        <Banknote size={16} /> Devise de facturation
                      </label>
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="currency" 
                            value="TND" 
                            checked={formData.currency === 'TND' || !formData.currency} 
                            onChange={() => setFormData({...formData, currency: 'TND'})}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-800">Dinar Tunisien (TND - 3 déc.)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="currency" 
                            value="EUR" 
                            checked={formData.currency === 'EUR'} 
                            onChange={() => setFormData({...formData, currency: 'EUR'})}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-800">Euro (€ - 2 déc.)</span>
                        </label>
                      </div>
                    </div>
                </div>

                <div className="col-span-2 pt-2 border-t border-gray-100">
                   <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={formData.isDefault || companies.length === 0}
                        onChange={e => setFormData({...formData, isDefault: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 font-medium">Définir comme entreprise par défaut</span>
                   </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
         {companies.map(company => (
            <div key={company.id} className={`bg-white p-6 rounded-xl border transition-all ${company.isDefault ? 'border-blue-400 shadow-md ring-1 ring-blue-100' : 'border-gray-200 shadow-sm hover:shadow'}`}>
               <div className="flex justify-between items-start">
                  <div className="flex items-start gap-4">
                     <div className={`p-3 rounded-lg ${company.isDefault ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                        <Building2 size={24} />
                     </div>
                     <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                           {company.name}
                           {company.isDefault && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">Défaut</span>}
                        </h3>
                        <div className="text-sm text-gray-500 mt-1 space-y-0.5">
                           <p>{company.address}</p>
                           <p><span className="font-medium">MF:</span> {company.mf}</p>
                           {company.letterheadUrl && (
                             <p className="flex items-center gap-1 text-purple-600 mt-1">
                               <ImageIcon size={14} /> Papier en tête activé
                               {company.hideCompanyInfoOnPdf && <span className="text-xs bg-purple-100 px-1.5 rounded ml-1">(Infos masquées)</span>}
                             </p>
                           )}
                        </div>
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     {!company.isDefault && (
                        <button
                           onClick={() => handleSetDefault(company.id)}
                           className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                           title="Définir par défaut"
                        >
                           <CheckCircle size={20} />
                        </button>
                     )}
                     <button
                        onClick={() => handleEdit(company)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Modifier"
                     >
                        <Edit2 size={20} />
                     </button>
                     <button
                        onClick={() => handleDelete(company.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer"
                     >
                        <Trash2 size={20} />
                     </button>
                  </div>
               </div>
            </div>
         ))}
      </div>
    </div>
  );
};

export default Settings;
