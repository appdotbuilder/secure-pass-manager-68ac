import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { trpc } from '@/utils/trpc';
import type { Vault, User, CreateVaultInput } from '../../../server/src/schema';

interface VaultManagerProps {
  vaults: Vault[];
  onVaultsChange: (vaults: Vault[]) => void;
  selectedVault: Vault | null;
  onVaultSelect: (vault: Vault) => void;
  currentUser: User;
}

export function VaultManager({ 
  vaults, 
  onVaultsChange, 
  selectedVault, 
  onVaultSelect 
}: VaultManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<CreateVaultInput>({
    name: '',
    description: null,
    is_shared: false
  });

  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const newVault = await trpc.createVault.mutate(formData);
      onVaultsChange([...vaults, newVault]);
      setFormData({
        name: '',
        description: null,
        is_shared: false
      });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Failed to create vault:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteVault = async (vaultId: number) => {
    try {
      await trpc.deleteVault.mutate({ id: vaultId });
      const updatedVaults = vaults.filter(v => v.id !== vaultId);
      onVaultsChange(updatedVaults);
      
      // If deleted vault was selected, clear selection
      if (selectedVault?.id === vaultId) {
        onVaultSelect(updatedVaults[0] || null);
      }
    } catch (error) {
      console.error('Failed to delete vault:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Vault Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">الخزائن المتاحة ({vaults.length})</h3>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              ➕ إنشاء خزينة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إنشاء خزينة جديدة</DialogTitle>
              <DialogDescription>
                أنشئ خزينة جديدة لتنظيم كلمات المرور والمعلومات الحساسة
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateVault}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">اسم الخزينة</Label>
                  <Input
                    id="name"
                    placeholder="مثال: خزينة العمل، خزينة شخصية"
                    value={formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreateVaultInput) => ({ ...prev, name: e.target.value }))
                    }
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">الوصف (اختياري)</Label>
                  <Textarea
                    id="description"
                    placeholder="وصف مختصر للخزينة"
                    value={formData.description || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setFormData((prev: CreateVaultInput) => ({
                        ...prev,
                        description: e.target.value || null
                      }))
                    }
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="shared"
                    checked={formData.is_shared}
                    onCheckedChange={(checked: boolean) =>
                      setFormData((prev: CreateVaultInput) => ({ ...prev, is_shared: checked }))
                    }
                  />
                  <Label htmlFor="shared">خزينة مشتركة</Label>
                  <span className="text-sm text-gray-500">(يمكن مشاركتها مع أعضاء الفريق)</span>
                </div>
              </div>
              
              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={isLoading}
                >
                  إلغاء
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? '⏳ إنشاء...' : '✅ إنشاء الخزينة'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Vaults Grid */}
      {vaults.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-6xl mb-4">📁</div>
          <p className="text-lg mb-2">لا توجد خزائن حتى الآن</p>
          <p>أنشئ خزينتك الأولى لبدء حفظ كلمات المرور</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vaults.map((vault: Vault) => (
            <Card
              key={vault.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedVault?.id === vault.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => onVaultSelect(vault)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="text-2xl">
                      {vault.is_shared ? '🌐' : '🔒'}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{vault.name}</CardTitle>
                      {vault.description && (
                        <CardDescription className="mt-1">
                          {vault.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        🗑️
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>حذف الخزينة</AlertDialogTitle>
                        <AlertDialogDescription>
                          هل أنت متأكد من حذف خزينة "{vault.name}"؟ ستفقد جميع العناصر المحفوظة فيها. هذا الإجراء غير قابل للتراجع.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-500 hover:bg-red-600"
                          onClick={() => handleDeleteVault(vault.id)}
                        >
                          حذف نهائي
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    {vault.is_shared ? (
                      <Badge variant="secondary">مشتركة</Badge>
                    ) : (
                      <Badge variant="outline">شخصية</Badge>
                    )}
                    {selectedVault?.id === vault.id && (
                      <Badge variant="default">محددة</Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {vault.created_at.toLocaleDateString('ar')}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}