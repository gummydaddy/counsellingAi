import React, { useState } from 'react';
import { authService } from '../services/auth.service.ts';

const SignupComponent: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    // Validation
    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      setMessageType('error');
      return;
    }

    setIsLoading(true);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const result = authService.signup(email, password, name);
    
    setIsLoading(false);

    if (result.success) {
      setMessage('Account created successfully! Redirecting...');
      setMessageType('success');
      // App polls and shows main app after ~1.5s
    } else {
      setMessage(result.message);
      setMessageType('error');
    }
  };

  const goToLogin = () => {
    // User can import LoginComponent
    console.log('Navigate to login');
  };

  const goToLanding = () => {
    // Logout/redirect handled by parent
    console.log('Back to landing');
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md border border-[#D32F2F] p-4 sm:p-8 relative mx-2 sm:mx-0">
        <div className="absolute top-0 left-0 w-2 h-2 bg-[#D32F2F]"></div>
        <div className="absolute top-0 right-0 w-2 h-2 bg-[#D32F2F]"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 bg-[#D32F2F]"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 bg-[#D32F2F]"></div>

        <h2 className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight">SIGN UP</h2>
        <p className="text-xs text-[#D32F2F] font-mono mb-6 sm:mb-8 uppercase tracking-widest">
          CREATE YOUR ACCOUNT
        </p>

        {message && (
          <div 
            className={`mb-4 sm:mb-6 p-3 border text-sm rounded ${
              messageType === 'error'
                ? 'border-red-500 bg-red-900/20 text-red-300'
                : 'border-green-500 bg-green-900/20 text-green-300'
            }`}
          >
            {message}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Full Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              name="name"
              placeholder="John Doe"
              required
              className="w-full bg-[#111] border border-gray-700 p-3 text-white focus:border-[#D32F2F] outline-none min-h-[48px] text-base"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              name="email"
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
              name="password"
              placeholder="Minimum 8 characters"
              required
              minLength={8}
              className="w-full bg-[#111] border border-gray-700 p-3 text-white focus:border-[#D32F2F] outline-none min-h-[48px] text-base"
            />
            <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Confirm Password</label>
            <input 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              name="confirmPassword"
              placeholder="Re-enter password"
              required
              className="w-full bg-[#111] border border-gray-700 p-3 text-white focus:border-[#D32F2F] outline-none min-h-[48px] text-base"
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-[#D32F2F] text-white py-3 font-bold text-base sm:text-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[48px]"
          >
            {isLoading ? 'CREATING ACCOUNT...' : 'SIGN UP'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <button 
            type="button"
            onClick={goToLogin} 
            className="text-gray-500 hover:text-white underline text-sm block w-full py-2 min-h-[44px]"
          >
            Already have an account? Login
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

export default SignupComponent;

