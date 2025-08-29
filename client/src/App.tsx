import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/utils/trpc';
import { LoginForm } from '@/components/LoginForm';
import { VaultManager } from '@/components/VaultManager';
import { CredentialItemManager } from '@/components/CredentialItemManager';
import { UserManagement } from '@/components/UserManagement';
import { PasswordGenerator } from '@/components/PasswordGenerator';
import { SearchItems } from '@/components/SearchItems';
import type { User, Vault } from '../../server/src/schema';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [selectedVault, setSelectedVault] = useState<Vault | null>(null);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load user's vaults
  const loadVaults = useCallback(async () => {
    if (!currentUser || !authToken) return;
    
    try {
      const userVaults = await trpc.getVaultsByUser.query();
      setVaults(userVaults);
      
      // Auto-select first vault if none selected
      if (userVaults.length > 0 && !selectedVault) {
        setSelectedVault(userVaults[0]);
      }
    } catch (error) {
      console.error('Failed to load vaults:', error);
    }
  }, [currentUser, authToken, selectedVault]);

  useEffect(() => {
    loadVaults();
  }, [loadVaults]);

  // Handle login
  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const session = await trpc.login.mutate({ email, password });
      setCurrentUser(session.user);
      setAuthToken(session.token);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    if (authToken) {
      try {
        await trpc.logout.mutate({ token: authToken });
      } catch (error) {
        console.error('Logout failed:', error);
      }
    }
    setCurrentUser(null);
    setAuthToken(null);
    setSelectedVault(null);
    setVaults([]);
  };

  // If not logged in, show login form
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">🔐 مدير كلمات المرور</h1>
            <p className="text-gray-600">نظام إدارة كلمات المرور المتقدم</p>
          </div>
          <LoginForm onLogin={handleLogin} isLoading={isLoading} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">🔐 مدير كلمات المرور</h1>
            {selectedVault && (
              <Badge variant="outline" className="text-sm">
                📁 {selectedVault.name}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              مرحباً، <span className="font-medium">{currentUser.full_name}</span>
              <Badge variant={currentUser.role === 'admin' ? 'default' : 'secondary'} className="ml-2">
                {currentUser.role === 'admin' ? '👑 مسؤول' : '👤 مستخدم'}
              </Badge>
            </div>
            <Button onClick={handleLogout} variant="outline" size="sm">
              تسجيل خروج
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <Tabs defaultValue="vaults" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="vaults">📁 الخزائن</TabsTrigger>
            <TabsTrigger value="items">🔑 العناصر</TabsTrigger>
            <TabsTrigger value="search">🔍 البحث</TabsTrigger>
            <TabsTrigger value="generator">⚡ مولد كلمات المرور</TabsTrigger>
            {currentUser.role === 'admin' && (
              <TabsTrigger value="users">👥 إدارة المستخدمين</TabsTrigger>
            )}
          </TabsList>

          {/* Vaults Tab */}
          <TabsContent value="vaults" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📁 إدارة الخزائن
                </CardTitle>
                <CardDescription>
                  إنشاء وإدارة الخزائن لتنظيم كلمات المرور والمعلومات الحساسة
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VaultManager
                  vaults={vaults}
                  onVaultsChange={setVaults}
                  selectedVault={selectedVault}
                  onVaultSelect={setSelectedVault}
                  currentUser={currentUser}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Items Tab */}
          <TabsContent value="items" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🔑 إدارة العناصر
                </CardTitle>
                <CardDescription>
                  إضافة وإدارة كلمات المرور والمعلومات الحساسة في الخزينة المحددة
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedVault ? (
                  <CredentialItemManager
                    vault={selectedVault}
                    currentUser={currentUser}
                  />
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <p className="text-lg mb-2">📁</p>
                    <p>يرجى اختيار خزينة أولاً من تبويب "الخزائن"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Search Tab */}
          <TabsContent value="search" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🔍 البحث في العناصر
                </CardTitle>
                <CardDescription>
                  البحث والتصفية في جميع عناصرك المحفوظة
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SearchItems vaults={vaults} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Password Generator Tab */}
          <TabsContent value="generator" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  ⚡ مولد كلمات المرور
                </CardTitle>
                <CardDescription>
                  إنشاء كلمات مرور قوية وعشوائية
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PasswordGenerator />
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Management Tab (Admin only) */}
          {currentUser.role === 'admin' && (
            <TabsContent value="users" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    👥 إدارة المستخدمين
                  </CardTitle>
                  <CardDescription>
                    إضافة وإدارة مستخدمي النظام وأدوارهم
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <UserManagement currentUser={currentUser} />
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

export default App;