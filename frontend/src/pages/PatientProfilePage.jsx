import React, { useState, useEffect } from 'react';
import { 
  getPatients, 
  createPatient, 
  updatePatient, 
  deletePatient 
} from '../services/patient';
import { 
  Plus, 
  Edit, 
  Trash2, 
  User, 
  Activity, 
  UserPlus, 
  Check, 
  Ruler, 
  Scale, 
  AlertCircle, 
  RefreshCw,
  Heart,
  ChevronRight,
  TrendingUp
} from 'lucide-react';

function PatientProfilePage() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Active Patient state (persisted in localStorage)
  const [activePatientId, setActivePatientId] = useState(
    localStorage.getItem('activePatientId') || ''
  );
  const [activePatientName, setActivePatientName] = useState(
    localStorage.getItem('activePatientName') || ''
  );

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState('create'); // 'create' | 'edit'
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  
  const [formData, setFormData] = useState({
    full_name: '',
    age: '',
    gender: 'Male',
    height_cm: '',
    weight_kg: '',
    dominant_hand: 'Right',
    injured_arm: 'Left',
    injury_type: ''
  });

  const fetchPatients = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await getPatients();
      setPatients(data);
      
      // If there's an active patient, verify they still exist in the database.
      // If not, clear the active patient selection.
      const activeId = localStorage.getItem('activePatientId');
      if (activeId && data.length > 0) {
        const found = data.find(p => p.id === activeId);
        if (!found) {
          clearActivePatient();
        } else if (found.full_name !== activePatientName) {
          setActivePatientName(found.full_name);
          localStorage.setItem('activePatientName', found.full_name);
        }
      } else if (data.length === 0) {
        clearActivePatient();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load patient profiles. Please verify the backend connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const clearActivePatient = () => {
    localStorage.removeItem('activePatientId');
    localStorage.removeItem('activePatientName');
    setActivePatientId('');
    setActivePatientName('');
  };

  const handleSelectActive = (patient) => {
    localStorage.setItem('activePatientId', patient.id);
    localStorage.setItem('activePatientName', patient.full_name);
    setActivePatientId(patient.id);
    setActivePatientName(patient.full_name);
    showNotification(`Active patient set to ${patient.full_name}`, 'success');
  };

  const showNotification = (msg, type = 'success') => {
    if (type === 'success') {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 5000);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'age' || name === 'height_cm' || name === 'weight_kg' 
        ? (value === '' ? '' : Number(value)) 
        : value
    }));
  };

  const openCreateModal = () => {
    setFormMode('create');
    setSelectedPatientId(null);
    setFormData({
      full_name: '',
      age: '',
      gender: 'Male',
      height_cm: '',
      weight_kg: '',
      dominant_hand: 'Right',
      injured_arm: 'Left',
      injury_type: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (patient) => {
    setFormMode('edit');
    setSelectedPatientId(patient.id);
    setFormData({
      full_name: patient.full_name,
      age: patient.age,
      gender: patient.gender,
      height_cm: patient.height_cm,
      weight_kg: patient.weight_kg,
      dominant_hand: patient.dominant_hand,
      injured_arm: patient.injured_arm,
      injury_type: patient.injury_type
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Input Validation
    if (!formData.full_name.trim()) return showNotification('Please enter a full name.', 'error');
    if (!formData.age || formData.age <= 0) return showNotification('Age must be greater than zero.', 'error');
    if (!formData.height_cm || formData.height_cm <= 0) return showNotification('Height must be greater than zero.', 'error');
    if (!formData.weight_kg || formData.weight_kg <= 0) return showNotification('Weight must be greater than zero.', 'error');
    if (!formData.injury_type.trim()) return showNotification('Please enter an injury type.', 'error');

    try {
      if (formMode === 'create') {
        const res = await createPatient(formData);
        showNotification('Patient profile created successfully.');
        
        // If it is the first patient, automatically set them as active
        if (patients.length === 0) {
          localStorage.setItem('activePatientId', res.patient_id);
          localStorage.setItem('activePatientName', formData.full_name);
          setActivePatientId(res.patient_id);
          setActivePatientName(formData.full_name);
        }
      } else {
        await updatePatient(selectedPatientId, formData);
        showNotification('Patient profile updated successfully.');
        
        // Update local active state if edited patient is active
        if (selectedPatientId === activePatientId) {
          localStorage.setItem('activePatientName', formData.full_name);
          setActivePatientName(formData.full_name);
        }
      }
      setIsModalOpen(false);
      fetchPatients();
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || 'An error occurred while saving the profile.';
      showNotification(detail, 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete patient "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deletePatient(id);
      showNotification(`Patient "${name}" has been deleted.`);
      
      // If deleted patient was active, clear active selection
      if (id === activePatientId) {
        clearActivePatient();
      }
      fetchPatients();
    } catch (err) {
      console.error(err);
      showNotification('Failed to delete patient profile. Please try again.', 'error');
    }
  };

  // Helper to generate custom HSL backgrounds based on string hash for initials avatars
  const getAvatarColor = (name) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return `hsl(${h}, 65%, 45%)`;
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3.5 rounded-xl shadow-lg font-medium flex items-center gap-2 animate-bounce">
          <Check className="w-5 h-5" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Overview/Active Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-primary">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Patient Profiles Directory</h3>
            <p className="text-sm text-slate-500">
              Manage physical metrics and injury details to customize motor assessment calibrations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {activePatientId ? (
            <div className="px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-xs md:text-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <span className="font-semibold text-slate-700">
                Active: <span className="text-green-700 font-bold">{activePatientName}</span>
              </span>
              <button 
                onClick={clearActivePatient} 
                className="text-xs text-red-500 hover:text-red-700 font-semibold pl-2 border-l border-slate-200 hover:underline"
              >
                Clear
              </button>
            </div>
          ) : (
            <div className="px-4 py-2.5 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center gap-3 text-xs md:text-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" />
              <span className="font-semibold text-slate-700">No active patient selected</span>
            </div>
          )}
          
          <button 
            onClick={openCreateModal}
            className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-blue-600 transition flex items-center gap-2 text-sm cursor-pointer shadow-sm shadow-blue-200"
          >
            <Plus className="w-4 h-4" />
            Add Patient
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-semibold text-slate-500">Fetching profiles from SQLite...</p>
        </div>
      ) : patients.length === 0 ? (
        <div className="bg-white border border-slate-200 p-16 rounded-2xl shadow-sm text-center max-w-xl mx-auto space-y-6">
          <div className="w-16 h-16 rounded-full bg-blue-50/50 flex items-center justify-center mx-auto text-primary">
            <UserPlus className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h4 className="text-lg font-bold text-slate-800">No Patient Profiles Found</h4>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Create a patient profile detailing body specifications and injuries to initialize rehabilitation telemetry mapping.
            </p>
          </div>
          <button 
            onClick={openCreateModal}
            className="px-6 py-3 bg-primary text-white font-medium rounded-xl hover:bg-blue-600 transition"
          >
            Create Your First Profile
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {patients.map((patient) => {
            const isActive = patient.id === activePatientId;
            const initials = patient.full_name
              .split(' ')
              .map(n => n[0])
              .join('')
              .toUpperCase()
              .substring(0, 2);
            
            return (
              <div 
                key={patient.id} 
                className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md ${
                  isActive 
                    ? 'border-green-500 ring-2 ring-green-100' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Card Header */}
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: getAvatarColor(patient.full_name) }}
                      >
                        {initials}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-base">{patient.full_name}</h4>
                        <span className="text-xs text-slate-500 font-medium">Joined {new Date(patient.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {isActive && (
                      <span className="px-2.5 py-1 bg-green-500 text-white text-[10px] font-extrabold rounded-full tracking-wider uppercase">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Badges / Quick Stats */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold">
                      {patient.gender}, {patient.age} yrs
                    </span>
                    <span className="px-2.5 py-1 bg-blue-50 text-primary rounded-lg text-xs font-semibold border border-blue-100">
                      Injury: {patient.injury_type}
                    </span>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Body Metrics Grid */}
                  <div className="grid grid-cols-2 gap-y-3.5 gap-x-2 text-xs font-medium text-slate-600">
                    <div className="flex items-center gap-2">
                      <Ruler className="w-4 h-4 text-slate-400" />
                      <span>Ht: {patient.height_cm} cm</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-slate-400" />
                      <span>Wt: {patient.weight_kg} kg</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-slate-400" />
                      <span>Injured: {patient.injured_arm} Arm</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-slate-400" />
                      <span>Dominant: {patient.dominant_hand}</span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <button 
                      onClick={() => openEditModal(patient)}
                      title="Edit Profile"
                      className="p-2 border border-slate-200 rounded-lg hover:bg-white hover:text-primary transition text-slate-500 cursor-pointer"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(patient.id, patient.full_name)}
                      title="Delete Profile"
                      className="p-2 border border-slate-200 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition text-slate-500 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {!isActive && (
                    <button 
                      onClick={() => handleSelectActive(patient)}
                      className="px-4 py-2 border border-slate-200 text-xs font-bold text-slate-700 bg-white rounded-lg hover:bg-slate-100 hover:text-slate-900 transition flex items-center gap-1 cursor-pointer"
                    >
                      Set Active
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-50 px-8 py-5 border-b border-slate-200 flex justify-between items-center">
              <h4 className="text-lg font-bold text-slate-800">
                {formMode === 'create' ? 'Create Patient Profile' : 'Edit Patient Profile'}
              </h4>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Full Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                  <input 
                    type="text" 
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    placeholder="e.g. John Doe" 
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-800" 
                    required
                  />
                </div>

                {/* Age */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Age (years)</label>
                  <input 
                    type="number" 
                    name="age"
                    value={formData.age}
                    onChange={handleInputChange}
                    placeholder="e.g. 45" 
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-800" 
                    required
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Gender</label>
                  <select 
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-800"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Height */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Height (cm)</label>
                  <input 
                    type="number" 
                    name="height_cm"
                    value={formData.height_cm}
                    onChange={handleInputChange}
                    placeholder="e.g. 175" 
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-800" 
                    required
                  />
                </div>

                {/* Weight */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Weight (kg)</label>
                  <input 
                    type="number" 
                    name="weight_kg"
                    value={formData.weight_kg}
                    onChange={handleInputChange}
                    placeholder="e.g. 70" 
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-800" 
                    required
                  />
                </div>

                {/* Dominant Hand */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Dominant Hand</label>
                  <select 
                    name="dominant_hand"
                    value={formData.dominant_hand}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-800"
                  >
                    <option value="Right">Right Hand</option>
                    <option value="Left">Left Hand</option>
                    <option value="Ambidextrous">Ambidextrous</option>
                  </select>
                </div>

                {/* Injured Arm */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Injured Arm</label>
                  <select 
                    name="injured_arm"
                    value={formData.injured_arm}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-800"
                  >
                    <option value="Left">Left Arm</option>
                    <option value="Right">Right Arm</option>
                    <option value="Both">Both Arms</option>
                  </select>
                </div>

                {/* Injury Type */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Injury / Diagnosis Type</label>
                  <input 
                    type="text" 
                    name="injury_type"
                    value={formData.injury_type}
                    onChange={handleInputChange}
                    placeholder="e.g. Radial Nerve Palsy, Wrist Tendonitis" 
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-800" 
                    required
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition cursor-pointer shadow-sm shadow-blue-200"
                >
                  {formMode === 'create' ? 'Create Profile' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PatientProfilePage;
