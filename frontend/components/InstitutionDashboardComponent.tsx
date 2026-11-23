import React, { useState, useEffect, useCallback } from 'react';
import { authService, InstitutionDashboardData, InstitutionUserAssociation, UserSearchResult } from '../services/auth.service.ts';

interface Props {
  onLogout: () => void;
  onBackToMain: () => void;
}

const InstitutionDashboardComponent: React.FC<Props> = ({ onLogout, onBackToMain }) => {
  const [dashboardData, setDashboardData] = useState<InstitutionDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'add-user'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [associationType, setAssociationType] = useState<'student' | 'patient' | 'client' | 'member' | 'other'>('member');
  const [notes, setNotes] = useState('');
  const [isAssociating, setIsAssociating] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [associationsPage, setAssociationsPage] = useState(1);
  const [associationsData, setAssociationsData] = useState<{
    results: InstitutionUserAssociation[];
    total: number;
    page: number;
    pages: number;
    has_next: boolean;
    has_previous: boolean;
  } | null>(null);
  const [associationsLoading, setAssociationsLoading] = useState(false);
  const [filterAssociationType, setFilterAssociationType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('active');

  const institutionId = authService.getInstitutionProfile()?.organization || '';

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    const data = await authService.getInstitutionDashboard(institutionId || undefined);
    setDashboardData(data);
    setIsLoading(false);
  }, [institutionId]);

  const loadAssociations = useCallback(async (page = 1) => {
    setAssociationsLoading(true);
    const data = await authService.getInstitutionAssociations(institutionId || undefined, {
      association_type: filterAssociationType || undefined,
      status: filterStatus || undefined,
      page,
      page_size: 20,
    });
    setAssociationsData(data);
    setAssociationsPage(page);
    setAssociationsLoading(false);
  }, [institutionId, filterAssociationType, filterStatus]);

  useEffect(() => {
    loadDashboard();
    loadAssociations(1);
  }, [loadDashboard, loadAssociations]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results = await authService.searchInstitutionUsers(searchQuery, institutionId || undefined);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleAssociateUser = async () => {
    if (!selectedUser) return;
    setIsAssociating(true);
    const result = await authService.associateInstitutionUser(
      selectedUser.id,
      associationType,
      notes,
      institutionId || undefined
    );
    setIsAssociating(false);
    if (result.success) {
      showMessage(result.message, 'success');
      setSelectedUser(null);
      setSearchQuery('');
      setSearchResults([]);
      setNotes('');
      loadDashboard();
      loadAssociations(1);
    } else {
      showMessage(result.message, 'error');
    }
  };

  const handleRemoveAssociation = async (associationId: string, userName: string) => {
    if (!confirm(`Remove ${userName} from this institution?`)) return;
    const result = await authService.removeInstitutionAssociation(associationId, institutionId || undefined);
    if (result.success) {
      showMessage(result.message, 'success');
      loadDashboard();
      loadAssociations(associationsPage);
    } else {
      showMessage(result.message, 'error');
    }
  };

  const handleUpdateAssociation = async (association: InstitutionUserAssociation) => {
    const newType = prompt('Enter new association type (student/patient/client/member/other):', association.association_type);
    if (!newType) return;
    const newNotes = prompt('Enter notes:', association.notes || '');
    if (newNotes === null) return;

    const result = await authService.updateInstitutionAssociation(association.id, {
      association_type: newType as any,
      notes: newNotes,
    }, institutionId || undefined);

    if (result.success) {
      showMessage(result.message, 'success');
      loadAssociations(associationsPage);
    } else {
      showMessage(result.message, 'error');
    }
  };

  const institution = dashboardData?.institution;
  const adminProfile = dashboardData?.admin_profile;
  const userCounts = dashboardData?.user_counts || {};

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-600">Loading institution dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white font-bold">
              {institution?.institution_type === 'institute' ? '🏫' : '🏛️'}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{institution?.display_name}</h1>
              <p className="text-sm text-slate-500 capitalize">{institution?.institution_type} Dashboard</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${institution?.institution_status === 'active'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-red-100 text-red-800'
              }`}>
              {institution?.institution_status}
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-900">{adminProfile?.user_name}</p>
              <p className="text-xs text-slate-500 capitalize">{adminProfile?.role.replace('_', ' ')}</p>
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
            <button
              onClick={onBackToMain}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
            >
              Back to Main App
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      {message && (
        <div className={`max-w-7xl mx-auto px-4 py-2 ${message.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
            : 'bg-red-50 text-red-800 border-b border-red-200'
          }`}>
          {message.text}
        </div>
      )}

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 py-8">
        {/* Tabs */}
        <div className="border-b border-slate-200 mb-6">
          <nav className="flex space-x-8" aria-label="Dashboard tabs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'overview'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'users'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              Users ({dashboardData?.total_users || 0})
            </button>
            {adminProfile?.can_manage_users && (
              <button
                onClick={() => setActiveTab('add-user')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'add-user'
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
              >
                Add User
              </button>
            )}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-brand-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">👥</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-slate-500">Total Users</p>
                    <p className="text-2xl font-bold text-slate-900">{dashboardData?.total_users || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🎓</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-slate-500">Students</p>
                    <p className="text-2xl font-bold text-slate-900">{userCounts.student || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🏥</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-slate-500">Patients</p>
                    <p className="text-2xl font-bold text-slate-900">{userCounts.patient || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">👤</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-slate-500">Others</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {(userCounts.client || 0) + (userCounts.member || 0) + (userCounts.other || 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Institution Info */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Institution Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Legal Name</p>
                  <p className="font-medium text-slate-900">{institution?.legal_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Type</p>
                  <p className="font-medium text-slate-900 capitalize">{institution?.institution_type}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Organization Type</p>
                  <p className="font-medium text-slate-900">{institution?.organization_type}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Country</p>
                  <p className="font-medium text-slate-900">{institution?.country}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Registration Number</p>
                  <p className="font-medium text-slate-900">{institution?.registration_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Status</p>
                  <p className="font-medium text-slate-900">{institution?.status}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Enabled By</p>
                  <p className="font-medium text-slate-900">{adminProfile?.assigned_by || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Enabled At</p>
                  <p className="font-medium text-slate-900">{institution?.institution_enabled_at ? new Date(institution.institution_enabled_at).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Admin Profile */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Your Access</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Role</p>
                  <p className="font-medium text-slate-900 capitalize">{adminProfile?.role.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Primary Admin</p>
                  <p className="font-medium text-slate-900">{adminProfile?.is_primary_admin ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Can Manage Users</p>
                  <p className="font-medium text-slate-900">{adminProfile?.can_manage_users ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Can View Analytics</p>
                  <p className="font-medium text-slate-900">{adminProfile?.can_view_analytics ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Status</p>
                  <p className="font-medium text-slate-900">{adminProfile?.status}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Assigned At</p>
                  <p className="font-medium text-slate-900">{adminProfile?.created_at ? new Date(adminProfile.created_at).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm text-slate-500 mb-1">Filter by Type</label>
                  <select
                    value={filterAssociationType}
                    onChange={(e) => {
                      setFilterAssociationType(e.target.value);
                      loadAssociations(1);
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  >
                    <option value="">All Types</option>
                    <option value="student">Student</option>
                    <option value="patient">Patient</option>
                    <option value="client">Client</option>
                    <option value="member">Member</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm text-slate-500 mb-1">Filter by Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => {
                      setFilterStatus(e.target.value);
                      loadAssociations(1);
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {associationsLoading ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="mt-2 text-slate-500">Loading users...</p>
                </div>
              ) : associationsData?.results.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No users associated with this institution yet.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Added By</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date Added</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {associationsData?.results.map((association) => (
                          <tr key={association.id} className="hover:bg-slate-50">
                            <td className="px-4 py-4">
                              <div>
                                <p className="font-medium text-slate-900">{association.user_name}</p>
                                <p className="text-sm text-slate-500">{association.user_email}</p>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${association.association_type === 'student' ? 'bg-blue-100 text-blue-800' :
                                  association.association_type === 'patient' ? 'bg-emerald-100 text-emerald-800' :
                                    association.association_type === 'client' ? 'bg-purple-100 text-purple-800' :
                                      'bg-slate-100 text-slate-800'
                                }`}>
                                {association.association_type}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${association.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                                  association.status === 'inactive' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-slate-100 text-slate-800'
                                }`}>
                                {association.status}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-600">{association.added_by_name}</td>
                            <td className="px-4 py-4 text-sm text-slate-500">
                              {new Date(association.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center space-x-2">
                                {adminProfile?.can_manage_users && (
                                  <>
                                    <button
                                      onClick={() => handleUpdateAssociation(association)}
                                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleRemoveAssociation(association.id, association.user_name)}
                                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                                    >
                                      Remove
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {associationsData && associationsData.pages > 1 && (
                    <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
                      <p className="text-sm text-slate-500">
                        Page {associationsData.page} of {associationsData.pages} ({associationsData.total} total)
                      </p>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => loadAssociations(associationsData.page - 1)}
                          disabled={!associationsData.has_previous}
                          className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => loadAssociations(associationsData.page + 1)}
                          disabled={!associationsData.has_next}
                          className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Add User Tab */}
        {activeTab === 'add-user' && adminProfile?.can_manage_users && (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Search Platform Users</h3>
              <p className="text-slate-500 mb-4">Search for existing users on the platform to add to your institution.</p>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by name, email, or phone..."
                  className="flex-1 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-4 py-3 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50"
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="border-t border-slate-200 pt-4">
                  <h4 className="font-medium text-slate-900 mb-3">Search Results</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => setSelectedUser(user)}
                        className={`w-full text-left p-3 border rounded-lg transition-colors ${selectedUser?.id === user.id
                            ? 'border-brand-600 bg-brand-50'
                            : 'border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                        <p className="font-medium text-slate-900">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                        {user.phone_number && (
                          <p className="text-xs text-slate-400">{user.phone_number}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.length === 0 && searchQuery && !isSearching && (
                <div className="border-t border-slate-200 pt-4 text-center text-slate-500">
                  No users found matching "{searchQuery}"
                </div>
              )}
            </div>

            {selectedUser && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Add User to Institution</h3>
                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="font-medium text-slate-900">{selectedUser.first_name} {selectedUser.last_name}</p>
                    <p className="text-sm text-slate-500">{selectedUser.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 mb-2">Association Type</label>
                    <select
                      value={associationType}
                      onChange={(e) => setAssociationType(e.target.value as any)}
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    >
                      <option value="student">Student</option>
                      <option value="patient">Patient</option>
                      <option value="client">Client</option>
                      <option value="member">Member</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 mb-2">Notes (optional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Internal notes about this association..."
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleAssociateUser}
                      disabled={isAssociating}
                      className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {isAssociating ? 'Adding...' : 'Add User to Institution'}
                    </button>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No permission for add-user tab */}
        {activeTab === 'add-user' && !adminProfile?.can_manage_users && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔒</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Insufficient Permissions</h3>
            <p className="text-slate-500">You don't have permission to add users to this institution.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default InstitutionDashboardComponent;