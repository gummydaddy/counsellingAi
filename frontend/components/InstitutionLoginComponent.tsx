import React, { useState } from 'react';
import { authService, InstitutionLoginResponse } from '../services/auth.service.ts';

interface Props {
  onLoginSuccess: (data: InstitutionLoginResponse) => void;
  onBackToMainLogin: () => void;
}

const InstitutionLoginComponent: React.FC<Props> = ({ onLoginSuccess, onBackToMainLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showInstitutionId, setShowInstitutionId] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    const result = await authService.institutionLogin(email, password, institutionId || undefined);
    setIsLoading(false);

    if (result.success && result.data) {
      setErrorMessage('');
      onLoginSuccess(result.data);
    } else {
      setErrorMessage(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md border border-[#D32F2F] p-4 sm:p-8 relative mx-2 sm:mx-0">
        <div className="absolute top-0 left-0 w-2 h-2 bg-[#D32F2F]"></div>
        <div className="absolute top-0 right-0 w-2 h-2 bg-[#D32F2F]"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 bg-[#D32F2F]"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 bg-[#D32F2F]"></div>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl sm:text-3xl font-bold">INSTITUTION LOGIN</h2>
          <button
            onClick={onBackToMainLogin}
            className="text-gray-500 hover:text-white text-sm underline"
          >
            ← Back
          </button>
        </div>

        <p className="text-xs text-[#D32F2F] font-mono mb-6 sm:mb-8 uppercase tracking-widest">
          INSTITUTE / ADMINISTRATION ACCESS
        </p>

        {errorMessage && (
          <div className="mb-4 sm:mb-6 p-3 border border-red-500 bg-red-900/20 text-sm text-red-300 rounded">
            {errorMessage}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@institute.edu"
              required
              className="w-full bg-[#111] border border-gray-700 p-3 text-white focus:border-[#D32F2F] outline-none min-h-[48px] text-base"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full bg-[#111] border border-gray-700 p-3 text-white focus:border-[#D32F2F] outline-none min-h-[48px] text-base"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowInstitutionId(!showInstitutionId)}
            className="text-xs text-gray-500 hover:text-white underline"
          >
            {showInstitutionId ? 'Hide' : 'Show'} Institution ID (optional)
          </button>

          {showInstitutionId && (
            <div>
              <label className="block text-sm text-gray-300 mb-2">Institution ID</label>
              <input 
                type="text" 
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
                placeholder="UUID of institution (if you have access to multiple)"
                className="w-full bg-[#111] border border-gray-700 p-3 text-white focus:border-[#D32F2F] outline-none min-h-[48px] text-base"
              />
            </div>
          )}

          <div className="text-xs text-gray-600 border border-gray-800 p-2 rounded bg-gray-900/50">
            <strong>Note:</strong> Institution/Administration accounts are enabled by Superadmin only.
            Contact your administrator if you cannot access your account.
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-[#D32F2F] text-white py-3 font-bold text-base sm:text-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[48px]"
          >
            {isLoading ? 'LOGGING IN...' : 'LOGIN TO INSTITUTION'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            type="button"
            onClick={onBackToMainLogin} 
            className="text-gray-500 hover:text-white underline text-sm block w-full py-2 min-h-[44px]"
          >
            ← Back to Regular Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstitutionLoginComponent;