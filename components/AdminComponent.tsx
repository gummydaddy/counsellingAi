import React, { useState, useEffect, useCallback } from 'react';
import { authService, User } from '../services/auth.service.ts';

interface ApiKeys {
  gemini: string;
  openrouter: string;
  openai: string;
  anthropic: string;
  groq: string;
}

interface ScrapingSettings {
  enabled: boolean;
  autoScrapeOnLowConfidence: boolean;
  minConfidenceThreshold: number;
}

interface ScraperStats {
  totalScrapes: number;
  cacheHits: number;
  failedScrapes: number;
  totalContentChars: number;
}

interface AdminComponentProps {}

const AdminComponent: React.FC<AdminComponentProps> = () => {
  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    gemini: localStorage.getItem('admin_api_gemini') || '',
    openrouter: localStorage.getItem('admin_api_openrouter') || '',
    openai: localStorage.getItem('admin_api_openai') || '',
    anthropic: localStorage.getItem('admin_api_anthropic') || '',
    groq: localStorage.getItem('admin_api_groq') || '',
  });
  const [scrapingSettings, setScrapingSettings] = useState<ScrapingSettings>({
    enabled: true,
    autoScrapeOnLowConfidence: true,
    minConfidenceThreshold: 0.7,
  });
  const [scraperStats, setScraperStats] = useState<ScraperStats>({
    totalScrapes: 0,
    cacheHits: 0,
    failedScrapes: 0,
    totalContentChars: 0,
  });
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '' });
  const [message, setMessage] = useState('');

  const currentUser = authService.getCurrentUser();
  
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Admin Access Required</h2>
          <p className="text-slate-500 mb-4">Only administrators can access this page.</p>
          <button 
            onClick={() => authService.logout()}
            className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg font-medium hover:bg-slate-300"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  const saveProviderKey = (provider: keyof ApiKeys) => {
    const key = apiKeys[provider];
    if (!key.trim()) {
      setMessage(`Please enter ${provider} API key`);
      return;
    }
    localStorage.setItem(`admin_api_${provider}`, key.trim());
    setApiKeys({ ...apiKeys, [provider]: key.trim() });
    setMessage(`${provider} key saved`);
  };

  const clearProviderKey = (provider: keyof ApiKeys) => {
    localStorage.removeItem(`admin_api_${provider}`);
    setApiKeys({ ...apiKeys, [provider]: '' });
    setMessage(`${provider} key cleared`);
  };

  const toggleScraping = (enabled: boolean) => {
    localStorage.setItem('scraping_enabled', enabled.toString());
    setScrapingSettings({ ...scrapingSettings, enabled });
    setMessage(`Web scraping ${enabled ? 'enabled' : 'disabled'}`);
  };

  const updateThreshold = (value: number) => {
    const threshold = value / 100;
    localStorage.setItem('scraping_threshold', threshold.toString());
    setScrapingSettings({ ...scrapingSettings, minConfidenceThreshold: threshold });
  };

  const createAdmin = () => {
    const result = authService.createAdminUser(newAdmin.name, newAdmin.email, newAdmin.password);
    if (result.success) {
      setMessage(`Admin ${newAdmin.name} created`);
      setNewAdmin({ name: '', email: '', password: '' });
    } else {
      setMessage(result.error || 'Failed');
    }
  };

  const deleteUser = (userId: string) => {
    authService.deleteUser(userId);
    setAllUsers(allUsers.filter(u => u.id !== userId));
    setMessage('User deleted');
  };

  useEffect(() => {
    setAllUsers(authService.getAllUsers());
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-[#D32F2F] pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Console</h1>
            <p className="text-sm text-gray-500 mt-1">System Configuration & Data Management</p>
          </div>
          <button 
            onClick={() => authService.logout()}
            className="text-gray-400 hover:text-white text-sm py-2 px-4"
          >
            ← Exit to App
          </button>
        </div>

        {message && (
          <div className="mb-6 p-4 border rounded text-sm bg-red-900/20 border-red-500 text-red-300">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* AI Provider Config */}
          <div className="border border-[#D32F2F] p-6 bg-black">
            <h2 className="text-xl font-bold mb-4 text-[#D32F2F]">AI Provider Configuration</h2>
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="block text-sm text-gray-400">🔷 Gemini</label>
                <div className="flex gap-2">
                  <input 
                    type="password"
                    value={apiKeys.gemini}
                    onChange={(e) => setApiKeys({...apiKeys, gemini: e.target.value})}
                    className="flex-1 bg-[#111] border border-gray-700 p-3 text-white focus:border-[#D32F2F]"
                  />
                  <button onClick={() => saveProviderKey('gemini')} className="bg-[#D32F2F] px-4 py-3 font-bold">SAVE</button>
                  <button onClick={() => clearProviderKey('gemini')} className="bg-gray-800 px-3 py-3">🗑️</button>
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-sm text-gray-400">🔶 OpenRouter</label>
                <div className="flex gap-2">
                  <input 
                    type="password"
                    value={apiKeys.openrouter}
                    onChange={(e) => setApiKeys({...apiKeys, openrouter: e.target.value})}
                    className="flex-1 bg-[#111] border border-gray-700 p-3 text-white focus:border-[#D32F2F]"
                  />
                  <button onClick={() => saveProviderKey('openrouter')} className="bg-gray-700 px-4 py-3 font-bold">SAVE</button>
                  <button onClick={() => clearProviderKey('openrouter')} className="bg-gray-800 px-3 py-3">🗑️</button>
                </div>
              </div>
              {/* Add other providers similarly */}
            </div>
            <div className="mt-6 pt-6 border-t border-gray-800 text-xs">
              Configured: {Object.values(apiKeys).filter(k => k).length}
            </div>
          </div>

          {/* Users */}
          <div className="border border-[#D32F2F] p-6 bg-black">
            <h2 className="text-xl font-bold mb-4 text-[#D32F2F]">Admin Users</h2>
            <div className="space-y-3 mb-6">
              <input 
                placeholder="Name"
                value={newAdmin.name}
                onChange={(e) => setNewAdmin({...newAdmin, name: e.target.value})}
                className="w-full bg-[#111] border p-2 text-white focus:border-[#D32F2F]"
              />
              <input 
                type="email"
                placeholder="Email"
                value={newAdmin.email}
                onChange={(e) => setNewAdmin({...newAdmin, email: e.target.value})}
                className="w-full bg-[#111] border p-2 text-white focus:border-[#D32F2F]"
              />
              <input 
                type="password"
                placeholder="Password"
                value={newAdmin.password}
                onChange={(e) => setNewAdmin({...newAdmin, password: e.target.value})}
                className="w-full bg-[#111] border p-2 text-white focus:border-[#D32F2F]"
              />
              <button onClick={createAdmin} className="w-full bg-[#D32F2F] py-3 font-bold">
                CREATE ADMIN
              </button>
            </div>
            <div className="space-y-2">
              {allUsers.map(user => (
                <div key={user.id} className="flex justify-between items-center bg-[#111] p-3 text-sm border">
                  <span>{user.name} - {user.email}</span>
                  <button onClick={() => deleteUser(user.id)} className="text-red-500">Remove</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 text-xs text-gray-600 text-center font-mono">
          COUNSELLING AI ADMIN CONSOLE v1.0 | ADMIN ONLY
        </div>
      </div>
    </div>
  );
};

export default AdminComponent;

