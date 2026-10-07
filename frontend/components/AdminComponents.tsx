import React, { useState, useEffect } from 'react';
import { authService, User } from '../services/auth.service.ts';

const AdminComponents: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [view, setView] = useState<'login' | 'signup' | 'dashboard'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [creatingAdminName, setCreatingAdminName] = useState('');
  const [creatingAdminEmail, setCreatingAdminEmail] = useState('');
  const [creatingAdminPassword, setCreatingAdminPassword] = useState('');

  // No useEffect - parent App polls auth

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const result = authService.login(email, password);
    if (result.success) {
      setCurrentUser(result.user!);
      setAllUsers(authService.getAllUsers());
      setView('dashboard');
      showMessage(result.message, 'success');
    } else {
      showMessage(result.message, 'error');
    }
    setEmail('');
    setPassword('');
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    const result = authService.signup(email, password, name);
    if (result.success) {
      setCurrentUser(result.user!);
      setAllUsers(authService.getAllUsers());
      setView('dashboard');
      showMessage(result.message, 'success');
    } else {
      showMessage(result.message, 'error');
    }
    setEmail('');
    setPassword('');
    setName('');
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setAllUsers([]);
    setView('login');
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    const result = authService.changePassword(oldPassword, newPassword);
    if (result.success) {
      showMessage(result.message, 'success');
    } else {
      showMessage(result.message, 'error');
    }
    setOldPassword('');
    setNewPassword('');
  };

  const handleDeleteAccount = () => {
    if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
      const result = authService.deleteAccount(password);
      if (result.success) {
        setCurrentUser(null);
        setView('login');
        showMessage(result.message, 'success');
      } else {
        showMessage(result.message, 'error');
      }
    }
  };

  const handleCreateAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    const result = authService.createAdminUser(creatingAdminName, creatingAdminEmail, creatingAdminPassword);
    if (result.success) {
      setAllUsers(authService.getAllUsers());
      showMessage('Admin user created successfully', 'success');
    } else {
      showMessage(result.error || 'Failed to create admin', 'error');
    }
    setCreatingAdminName('');
    setCreatingAdminEmail('');
    setCreatingAdminPassword('');
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm('Delete this user? This cannot be undone.')) {
      authService.deleteUser(userId);
      setAllUsers(authService.getAllUsers());
      showMessage('User deleted', 'success');
    }
  };

  // No local auth check - controlled by App.tsx

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-slate-200">
        {/* Header */}
        <div className="p-8 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">A</div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Counselling AI Admin</h1>
              <p className="text-sm text-slate-500">
                {currentUser 
                  ? `${currentUser.name} (${currentUser.role})` 
                  : 'Please log in'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div className={`p-4 border-b border-slate-200 ${
            message.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-red-50 text-red-800 border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Content */}
        <div className="p-8">
          {!currentUser ? (
            <div className="space-y-6">
              <div className={`grid gap-4 ${view === 'signup' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <button
                  onClick={() => setView('login')}
                  className={`p-4 rounded-xl font-bold transition-all ${
                    view === 'login'
                      ? 'bg-brand-600 text-white shadow-lg shadow-brand-200'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => setView('signup')}
                  className={`p-4 rounded-xl font-bold transition-all ${
                    view === 'signup'
                      ? 'bg-brand-600 text-white shadow-lg shadow-brand-200'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {view === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-brand-600 text-white py-3 px-6 rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg"
                  >
                    Login
                  </button>
                  <div className="text-xs text-center text-slate-500 pt-2">
                    Super Admin: admin@counsellingai.com / CounsellingAI@2024
                  </div>
                </form>
              )}

              {view === 'signup' && (
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Password (min 8 chars)</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-brand-600 text-white py-3 px-6 rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg"
                  >
                    Create Account
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {currentUser.role === 'admin' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 mb-4">Create Admin User</h3>
                      <form onSubmit={handleCreateAdmin} className="space-y-3">
                        <input
                          type="text"
                          placeholder="Full Name"
                          value={creatingAdminName}
                          onChange={(e) => setCreatingAdminName(e.target.value)}
                          className="w-full p-3 border border-slate-300 rounded-xl"
                          required
                        />
                        <input
                          type="email"
                          placeholder="Email"
                          value={creatingAdminEmail}
                          onChange={(e) => setCreatingAdminEmail(e.target.value)}
                          className="w-full p-3 border border-slate-300 rounded-xl"
                          required
                        />
                        <input
                          type="password"
                          placeholder="Password"
                          value={creatingAdminPassword}
                          onChange={(e) => setCreatingAdminPassword(e.target.value)}
                          className="w-full p-3 border border-slate-300 rounded-xl"
                          required
                        />
                        <button
                          type="submit"
                          className="w-full bg-emerald-600 text-white py-2 px-4 rounded-xl font-bold hover:bg-emerald-700"
                        >
                          Create Admin
                        </button>
                      </form>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 mb-4">Account Settings</h3>
                      <div className="space-y-3">
                        <form onSubmit={handleChangePassword} className="space-y-2">
                          <input
                            type="password"
                            placeholder="Current Password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                          />
                          <input
                            type="password"
                            placeholder="New Password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                          />
                          <button
                            type="submit"
                            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-bold text-sm hover:bg-blue-700"
                          >
                            Change Password
                          </button>
                        </form>
                        <button
                          onClick={handleDeleteAccount}
                          className="w-full bg-red-600 text-white py-2 px-4 rounded-lg font-bold text-sm hover:bg-red-700"
                        >
                          Delete My Account
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-4">All Users ({allUsers.length})</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full bg-slate-50 rounded-xl">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="p-3 text-left text-sm font-bold text-slate-700">Name</th>
                            <th className="p-3 text-left text-sm font-bold text-slate-700">Email</th>
                            <th className="p-3 text-left text-sm font-bold text-slate-700">Role</th>
                            <th className="p-3 text-left text-sm font-bold text-slate-700">Created</th>
                            <th className="p-3"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {allUsers.map((user) => (
                            <tr key={user.id} className="border-t border-slate-200 hover:bg-white">
                              <td className="p-3 font-medium">{user.name}</td>
                              <td className="p-3 text-sm text-slate-600">{user.email}</td>
                              <td>
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                  user.role === 'admin' 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : 'bg-slate-100 text-slate-800'
                                }`}>
                                  {user.role}
                                </span>
                              </td>
                              <td className="p-3 text-sm text-slate-500">
                                {new Date(user.createdAt).toLocaleDateString()}
                              </td>
                              <td className="p-3">
                                {user.id !== 'super-admin' && (
                                  <button
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="text-red-600 hover:text-red-800 font-bold text-sm"
                                  >
                                    Delete
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">👤</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">User Dashboard</h3>
                  <p className="text-slate-500 mb-6">Upgrade to admin or manage your account.</p>
                  <div className="space-y-3">
                    <form onSubmit={handleChangePassword} className="space-y-3">
                      <input
                        type="password"
                        placeholder="Current Password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-xl"
                      />
                      <input
                        type="password"
                        placeholder="New Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-xl"
                      />
                      <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">
                        Change Password
                      </button>
                    </form>
                    <button
                      onClick={handleDeleteAccount}
                      className="w-full bg-red-600 text-white py-3 rounded-xl font-bold"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {currentUser && (
          <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
            <button
              onClick={handleLogout}
              className="ml-auto block px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium transition-all"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminComponents;

