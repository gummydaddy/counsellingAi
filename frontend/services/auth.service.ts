export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: string;
}

class AuthService {
  // Default super admin credentials
  private readonly SUPER_ADMIN = {
    id: 'super-admin',
    email: 'admin@counsellingai.com',
    password: 'CounsellingAI@2024',
    name: 'System Administrator',
    role: 'admin' as const,
    createdAt: new Date('2024-01-01').toISOString()
  };

  private readonly USERS_KEY = 'counsellingAi_users';
  private readonly PASSWORDS_KEY = 'counsellingAi_passwords';
  private readonly CURRENT_USER_KEY = 'counsellingAi_currentUser';

  /**
   * Register a new user
   */
  signup(email: string, password: string, name: string): { success: boolean; message: string; user?: User } {
    // Validate inputs
    if (!email || !password || !name) {
      return { success: false, message: 'All fields are required' };
    }
    
    if (!this.isValidEmail(email)) {
      return { success: false, message: 'Invalid email format' };
    }
    
    if (password.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters' };
    }
    
    // Check if super admin email
    if (email.toLowerCase() === this.SUPER_ADMIN.email.toLowerCase()) {
      return { success: false, message: 'This email is reserved for system administrator' };
    }
    
    // Check if user already exists
    const users = this.getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, message: 'User with this email already exists' };
    }
    
    // Create new user
    const newUser: User = {
      id: this.generateUserId(),
      email: email.toLowerCase(),
      name,
      role: 'user',
      createdAt: new Date().toISOString()
    };
    
    // Save user
    users.push(newUser);
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    
    // Hash and save password
    const passwords = this.getPasswords();
    passwords[newUser.id] = this.simpleHash(password);
    localStorage.setItem(this.PASSWORDS_KEY, JSON.stringify(passwords));
    
    // Auto-login
    this.setCurrentUser(newUser);
    
    return { success: true, message: 'Account created successfully', user: newUser };
  }

  /**
   * Login user
   */
  login(email: string, password: string): { success: boolean; message: string; user?: User } {
    const emailLower = email.toLowerCase();
    
    // Check super admin
    if (emailLower === this.SUPER_ADMIN.email.toLowerCase()) {
      if (password === this.SUPER_ADMIN.password) {
        this.setCurrentUser(this.SUPER_ADMIN);
        return { success: true, message: 'Login successful', user: this.SUPER_ADMIN };
      } else {
        return { success: false, message: 'Incorrect password' };
      }
    }
    
    // Regular users
    const users = this.getUsers();
    const user = users.find(u => u.email.toLowerCase() === emailLower);
    
    if (!user) {
      return { success: false, message: 'User not found. Please sign up first.' };
    }
    
    const passwords = this.getPasswords();
    const storedHash = passwords[user.id];
    
    if (!storedHash || storedHash !== this.simpleHash(password)) {
      return { success: false, message: 'Incorrect password' };
    }
    
    this.setCurrentUser(user);
    return { success: true, message: 'Login successful', user };
  }

  /**
   * Logout
   */
  logout(): void {
    localStorage.removeItem(this.CURRENT_USER_KEY);
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem(this.CURRENT_USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr) as User;
    } catch {
      return null;
    }
  }

  /**
   * Set current user
   */
  private setCurrentUser(user: User): void {
    localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(user));
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  /**
   * Check if admin
   */
  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'admin';
  }

  /**
   * Change password
   */
  changePassword(oldPassword: string, newPassword: string): { success: boolean; message: string } {
    const currentUser = this.getCurrentUser();
    
    if (!currentUser) {
      return { success: false, message: 'Not authenticated' };
    }
    
    if (newPassword.length < 8) {
      return { success: false, message: 'New password must be at least 8 characters' };
    }
    
    if (currentUser.id === 'super-admin') {
      return { success: false, message: 'Super admin password cannot be changed' };
    }
    
    const passwords = this.getPasswords();
    const storedHash = passwords[currentUser.id];
    
    if (!storedHash || storedHash !== this.simpleHash(oldPassword)) {
      return { success: false, message: 'Incorrect current password' };
    }
    
    passwords[currentUser.id] = this.simpleHash(newPassword);
    localStorage.setItem(this.PASSWORDS_KEY, JSON.stringify(passwords));
    
    return { success: true, message: 'Password changed successfully' };
  }

  /**
   * Delete own account
   */
  deleteAccount(password: string): { success: boolean; message: string } {
    const currentUser = this.getCurrentUser();
    
    if (!currentUser) {
      return { success: false, message: 'Not authenticated' };
    }
    
    if (currentUser.role === 'admin' && currentUser.id === 'super-admin') {
      return { success: false, message: 'Admin account cannot be deleted' };
    }
    
    const passwords = this.getPasswords();
    const storedHash = passwords[currentUser.id];
    
    if (!storedHash || storedHash !== this.simpleHash(password)) {
      return { success: false, message: 'Incorrect password' };
    }
    
    const users = this.getUsers();
    const updatedUsers = users.filter(u => u.id !== currentUser.id);
    localStorage.setItem(this.USERS_KEY, JSON.stringify(updatedUsers));
    
    delete passwords[currentUser.id];
    localStorage.setItem(this.PASSWORDS_KEY, JSON.stringify(passwords));
    
    this.logout();
    return { success: true, message: 'Account deleted successfully' };
  }

  /**
   * Get all users
   */
  getAllUsers(): User[] {
    return this.getUsers();
  }

  /**
   * Create admin user
   */
  createAdminUser(name: string, email: string, password: string): { success: boolean; error?: string } {
    const users = this.getAllUsers();
  
    if (users.find(u => u.email === email)) {
      return { success: false, error: 'User already exists' };
    }

    const newUser: User = {
      id: this.generateUserId(),
      name,
      email: email.toLowerCase(),
      role: 'admin',
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));

    const passwords = this.getPasswords();
    passwords[newUser.id] = this.simpleHash(password);
    localStorage.setItem(this.PASSWORDS_KEY, JSON.stringify(passwords));

    return { success: true };
  }

  /**
   * Delete user by ID (admin only)
   */
  deleteUser(userId: string): void {
    const users = this.getUsers();
    const updatedUsers = users.filter(u => u.id !== userId);
    localStorage.setItem(this.USERS_KEY, JSON.stringify(updatedUsers));

    const passwords = this.getPasswords();
    delete passwords[userId];
    localStorage.setItem(this.PASSWORDS_KEY, JSON.stringify(passwords));
  }

  private getUsers(): User[] {
    const usersStr = localStorage.getItem(this.USERS_KEY);
    if (!usersStr) return [];
  
    try {
      return JSON.parse(usersStr) as User[];
    } catch (e) {
      console.error('Failed to parse users', e);
      return [];
    }
  }

  private getPasswords(): { [userId: string]: string } {
    const passwordsStr = localStorage.getItem(this.PASSWORDS_KEY);
    if (!passwordsStr) return {};
    
    try {
      return JSON.parse(passwordsStr);
    } catch (e) {
      console.error('Failed to parse passwords', e);
      return {};
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private generateUserId(): string {
    return 'user-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

// Singleton export (matches project pattern)
export const authService = new AuthService();

