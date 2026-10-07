import React, { useState } from 'react';
import { authService } from '../services/auth.service.ts';

const LoginComponent: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const result = authService.login(email, password);
    setIsLoading(false);

    if (result.success) {
      // App polls authService.getCurrentUser(), will redirect to main app
      setErrorMessage('');
      // Success handled by parent polling
    } else {
      setErrorMessage(result.message);
    }
  };

  const goToSignup = () => {
    // User can import SignupComponent
    console.log('Navigate to signup');
  };

  const goToLanding = () => {
    authService.logout();
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md border border-[#D32F2F] p-4 sm:p-8 relative mx-2 sm:mx-0">
        <div className="absolute top-0 left-0 w-2 h-2 bg-[#D32F2F]"></div>
        <div className="absolute top-0 right-0 w-2 h-2 bg-[#D32F2F]"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 bg-[#D32F2F]"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 bg-[#D32F2F]"></div>

        <h2 className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight">LOGIN</h2>
        <p className="text-xs text-[#D32F2F] font-mono mb-6 sm:mb-8 uppercase tracking-widest">
          ACCESS YOUR ACCOUNT
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
              placeholder="your.email@example.com"
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

          <div className="text-xs text-gray-600 border border-gray-800 p-2 rounded">
            <strong>Super Admin:</strong> admin@counsellingai.com / CounsellingAI@2024
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-[#D32F2F] text-white py-3 font-bold text-base sm:text-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[48px]"
          >
            {isLoading ? 'LOGGING IN...' : 'LOGIN'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <button 
            type="button"
            onClick={goToSignup} 
            className="text-gray-500 hover:text-white underline text-sm block w-full py-2 min-h-[44px]"
          >
            Don&apos;t have an account? Sign Up
          </button>
          <button 
            type="button"
            onClick={goToLanding} 
            className="text-gray-500 hover:text-white underline text-sm block w-full py-2 min-h-[44px]"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginComponent;

