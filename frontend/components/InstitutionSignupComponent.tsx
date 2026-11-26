import React, { useState } from 'react';
import { authService, InstitutionSignupData, InstitutionSignupResponse } from '../services/auth.service.ts';

interface Props {
  onSignupSuccess: (data: InstitutionSignupResponse) => void;
  onBackToLogin: () => void;
}

const InstitutionSignupComponent: React.FC<Props> = ({ onSignupSuccess, onBackToLogin }) => {
  const [formData, setFormData] = useState<InstitutionSignupData>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    institution_type: 'institute',
    legal_name: '',
    display_name: '',
    organization_type: '',
    registration_number: '',
    country: 'US',
    description: '',
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    const result = await authService.institutionSignup(formData);
    setIsLoading(false);

    if (result.success) {
      setErrorMessage('');
      onSignupSuccess(result);
    } else {
      setErrorMessage(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-2xl border border-[#D32F2F] p-4 sm:p-8 relative mx-2 sm:mx-0 overflow-y-auto max-h-[90vh]">
        <div className="absolute top-0 left-0 w-2 h-2 bg-[#D32F2F]"></div>
        <div className="absolute top-0 right-0 w-2 h-2 bg-[#D32F2F]"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 bg-[#D32F2F]"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 bg-[#D32F2F]"></div>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl sm:text-3xl font-bold">INSTITUTION SIGNUP</h2>
          <button
            onClick={onBackToLogin}
            className="text-gray-500 hover:text-white text-sm underline"
          >
            ← Back
          </button>
        </div>

        <p className="text-xs text-[#D32F2F] font-mono mb-6 sm:mb-8 uppercase tracking-widest">
          REGISTER INSTITUTE / ADMINISTRATION
        </p>

        {errorMessage && (
          <div className="mb-4 sm:mb-6 p-3 border border-red-500 bg-red-900/20 text-sm text-red-300 rounded">
            {errorMessage}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Account Information Section */}
          <fieldset className="border border-gray-700 rounded-lg p-4 sm:p-6">
            <legend className="text-sm font-bold text-[#D32F2F] px-2">ACCOUNT INFORMATION</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">First Name</label>
                <input 
                  type="text" 
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="John"
                  required
                  className="w-full bg-[#111] border border-gray-700 p-3 text-white focus:border-[#D32F2F] outline-none min-h-[48px] text-base"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Last Name</label>
                <input 
                  type="text" 
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="Doe"
                  required
                  className="w-full bg-[#111] border border-gray-700 p-3 text-white focus:border-[#D32F2F] outline-none min-h-[48px] text-base"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Email</label>
                <input 
                  type="email" 
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="admin@institute.edu"
                  required
                  className="w-full bg-[#111] border border-gray-700 p-3 text-white focus:border-[#D32F2F] outline-none min-h-[48px] text-base"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Phone (Optional)</label>
                <input 
                  type="tel" 
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  placeholder="+1 (555) 123-4567"
                  className="w-full bg-[#111] border border-gray-700 p-3 text-white focus:border-[#D32F2F] outline-none min-h-[48px] text-base"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-300 mb-2">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Minimum 8 characters"
                    required
                    minLength={8}
                    className="w-full bg-[#111] border border-gray-700 p-3 text-white focus:border-[#D32F2F] outline-none min-h-[48px] text-base pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
            </div>
          </fieldset>

          {/* Institution Information Section */}
          <fieldset className="border border-gray-700 rounded-lg p-4 sm:p-6">
            <legend className="text-sm font-bold text-[#D32F2F] px-2">INSTITUTION INFORMATION</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Institution Type</label>
                <select
                  name="institution_type"
                  value={formData.institution_type}
                  onChange={handleChange}
                  required
                  className="w-full bg-[#111] border border-gray-700 p-3 text-white focus:border-[#D32F2F] outline-none min-h-[48px] text-base"
                >
                  <option value="institute">Institute (Educational/Training)</option>
                  <option value="administration">Administration (Government/Regulatory)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Legal Name</label>
                <input 
                  type="text" 
                  name="legal_name"
                  value={formData.legal_name}
                  onChange={handleChange}
                  placeholder="Institute of Technology Inc."
                  required
                  className="w-full bg-[#111] border border-gray-700 p-3 text-white focus:border-[#D32F2F] outline-none min-h-[48px] text-base"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Display Name</label>
                <input 
                  type="text" 
                  name="display_name"
                  value={formData.display_name}
                  onChange={handleChange}
                  placeholder="Institute of Technology"
                  required
                  className="w-full bg-[#111] border border-gray-700 p-3 text-white focus:border-[#D32F2F] outline-none min-h-[48px] text-base"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Organization Type</label>
                <input 
                  type="text" 
                  name="organization_type"
                  value={formData.organization_type}
                  onChange={handleChange}
                  placeholder="Educational Institution"
                  required
                  className="w-full bg-[#111] border border-gray-700 p-3 text-white focus:border-[#D32F2F] outline-none min-h-[48px] text-base"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Registration Number (Optional)</label>
                <input 
                  type="text" 
                  name="registration_number"
                  value={formData.registration_number}
                  onChange={handleChange}
                  placeholder="REG-12345"
                  className="w-full bg-[#111] border border-gray-700 p-3 text-white focus:border-[#D32F2F] outline-none min-h-[48px] text-base"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Country</label>
                <select
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  required
                  className="w-full bg-[#111] border border-gray-700 p-3 text-white focus:border-[#D32F2F] outline-none min-h-[48px] text-base"
                >
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="GB">United Kingdom</option>
                  <option value="AU">Australia</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                  <option value="IN">India</option>
                  <option value="SG">Singapore</option>
                  <option value="AE">UAE</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-300 mb-2">Description (Optional)</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Brief description of your institution..."
                  rows={3}
                  className="w-full bg-[#111] border border-gray-700 p-3 text-white focus:border-[#D32F2F] outline-none min-h-[48px] text-base resize-none"
                />
              </div>
            </div>
          </fieldset>

          <div className="text-xs text-gray-600 border border-gray-800 p-3 rounded bg-gray-900/50">
            <strong>Important:</strong> 
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Your application will be reviewed by our Superadmin team</li>
              <li>Institution access is <strong>inactive by default</strong> after approval</li>
              <li>Superadmin must manually enable institution access via Django Admin</li>
              <li>You will receive email notification once your application is processed</li>
            </ul>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-[#D32F2F] text-white py-3 font-bold text-base sm:text-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[48px]"
          >
            {isLoading ? 'SUBMITTING APPLICATION...' : 'SUBMIT APPLICATION'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            type="button"
            onClick={onBackToLogin} 
            className="text-gray-500 hover:text-white underline text-sm block w-full py-2 min-h-[44px]"
          >
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstitutionSignupComponent;