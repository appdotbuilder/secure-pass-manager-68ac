import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { trpc } from '@/utils/trpc';
import type { 
  Vault, 
  User, 
  CredentialItem, 
  Category,
  CreateCredentialItemInput, 
  ItemType 
} from '../../../server/src/schema';

interface CredentialItemManagerProps {
  vault: Vault;
  currentUser: User;
}

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  password: '🔑 كلمة مرور',
  credit_card: '💳 بطاقة ائتمانية',
  secure_note: '📝 ملاحظة آمنة',
  software_license: '🔑 رخصة برنامج'
};

const ITEM_TYPE_ICONS: Record<ItemType, string> = {
  password: '🔑',
  credit_card: '💳',
  secure_note: '📝',
  software_license: '⚙️'
};

export function CredentialItemManager({ vault }: CredentialItemManagerProps) {
  const [items, setItems] = useState<CredentialItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CredentialItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<CreateCredentialItemInput>({
    title: '',
    type: 'password',
    vault_id: vault.id,
    category_id: null,
    website_url: null,
    username: null,
    password: null,
    notes: null,
    card_number: null,
    card_holder_name: null,
    card_expiry_date: null,
    card_cvv: null,
    license_key: null,
    license_email: null
  });

  // Load items for the vault
  const loadItems = useCallback(async () => {
    try {
      const vaultItems = await trpc.getItemsByVault.query({ vaultId: vault.id });
      setItems(vaultItems);
    } catch (error) {
      console.error('Failed to load items:', error);
    }
  }, [vault.id]);

  // Load categories for the vault
  const loadCategories = useCallback(async () => {
    try {
      const vaultCategories = await trpc.getCategoriesByVault.query({ vaultId: vault.id });
      setCategories(vaultCategories);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, [vault.id]);

  useEffect(() => {
    loadItems();
    loadCategories();
  }, [loadItems, loadCategories]);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const newItem = await trpc.createCredentialItem.mutate(formData);
      setItems((prev: CredentialItem[]) => [...prev, newItem]);
      resetForm();
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Failed to create item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    try {
      await trpc.deleteCredentialItem.mutate({ id: itemId });
      setItems((prev: CredentialItem[]) => prev.filter(item => item.id !== itemId));
      if (selectedItem?.id === itemId) {
        setSelectedItem(null);
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      type: 'password',
      vault_id: vault.id,
      category_id: null,
      website_url: null,
      username: null,
      password: null,
      notes: null,
      card_number: null,
      card_holder_name: null,
      card_expiry_date: null,
      card_cvv: null,
      license_key: null,
      license_email: null
    });
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // In a real app, you'd show a toast notification here
      console.log(`${label} copied to clipboard`);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const renderItemForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">العنوان</Label>
          <Input
            id="title"
            placeholder="مثال: حساب جوجل، بنك الأهلي"
            value={formData.title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData((prev: CreateCredentialItemInput) => ({ ...prev, title: e.target.value }))
            }
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="type">نوع العنصر</Label>
          <Select
            value={formData.type}
            onValueChange={(value: ItemType) =>
              setFormData((prev: CreateCredentialItemInput) => ({ ...prev, type: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">الفئة (اختياري)</Label>
        <Select
          value={formData.category_id?.toString() || 'none'}
          onValueChange={(value: string) =>
            setFormData((prev: CreateCredentialItemInput) => ({
              ...prev,
              category_id: value === 'none' ? null : parseInt(value)
            }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="اختر فئة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">بدون فئة</SelectItem>
            {categories.map((category: Category) => (
              <SelectItem key={category.id} value={category.id.toString()}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={formData.type} className="w-full">
        <TabsContent value="password" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="website">موقع الويب</Label>
            <Input
              id="website"
              placeholder="https://example.com"
              value={formData.website_url || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData((prev: CreateCredentialItemInput) => ({
                  ...prev,
                  website_url: e.target.value || null
                }))
              }
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">اسم المستخدم</Label>
              <Input
                id="username"
                placeholder="البريد الإلكتروني أو اسم المستخدم"
                value={formData.username || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev: CreateCredentialItemInput) => ({
                    ...prev,
                    username: e.target.value || null
                  }))
                }
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                placeholder="كلمة المرور"
                value={formData.password || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev: CreateCredentialItemInput) => ({
                    ...prev,
                    password: e.target.value || null
                  }))
                }
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="credit_card" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cardNumber">رقم البطاقة</Label>
              <Input
                id="cardNumber"
                placeholder="1234 5678 9012 3456"
                value={formData.card_number || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev: CreateCredentialItemInput) => ({
                    ...prev,
                    card_number: e.target.value || null
                  }))
                }
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cardHolder">اسم حامل البطاقة</Label>
              <Input
                id="cardHolder"
                placeholder="الاسم كما يظهر على البطاقة"
                value={formData.card_holder_name || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev: CreateCredentialItemInput) => ({
                    ...prev,
                    card_holder_name: e.target.value || null
                  }))
                }
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cardExpiry">تاريخ الانتهاء</Label>
              <Input
                id="cardExpiry"
                placeholder="MM/YY"
                value={formData.card_expiry_date || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev: CreateCredentialItemInput) => ({
                    ...prev,
                    card_expiry_date: e.target.value || null
                  }))
                }
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cardCVV">رمز CVV</Label>
              <Input
                id="cardCVV"
                placeholder="123"
                value={formData.card_cvv || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev: CreateCredentialItemInput) => ({
                    ...prev,
                    card_cvv: e.target.value || null
                  }))
                }
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="software_license" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="licenseKey">مفتاح الترخيص</Label>
              <Input
                id="licenseKey"
                placeholder="ABCD-EFGH-IJKL-MNOP"
                value={formData.license_key || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev: CreateCredentialItemInput) => ({
                    ...prev,
                    license_key: e.target.value || null
                  }))
                }
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="licenseEmail">البريد الإلكتروني المسجل</Label>
              <Input
                id="licenseEmail"
                type="email"
                placeholder="email@example.com"
                value={formData.license_email || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev: CreateCredentialItemInput) => ({
                    ...prev,
                    license_email: e.target.value || null
                  }))
                }
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="space-y-2">
        <Label htmlFor="notes">ملاحظات</Label>
        <Textarea
          id="notes"
          placeholder="ملاحظات إضافية..."
          value={formData.notes || ''}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            setFormData((prev: CreateCredentialItemInput) => ({
              ...prev,
              notes: e.target.value || null
            }))
          }
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          عناصر خزينة "{vault.name}" ({items.length})
        </h3>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              ➕ إضافة عنصر جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>إضافة عنصر جديد</DialogTitle>
              <DialogDescription>
                أضف كلمة مرور، بطاقة ائتمانية، أو أي معلومة حساسة أخرى
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateItem}>
              {renderItemForm()}
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
                  {isLoading ? '⏳ إضافة...' : '✅ إضافة العنصر'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Items Grid */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-6xl mb-4">🔑</div>
          <p className="text-lg mb-2">لا توجد عناصر في هذه الخزينة</p>
          <p>أضف عنصرك الأول لبدء حفظ المعلومات الحساسة</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item: CredentialItem) => (
            <Card key={item.id} className="cursor-pointer hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="text-xl">
                      {ITEM_TYPE_ICONS[item.type]}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                      <CardDescription>
                        {ITEM_TYPE_LABELS[item.type]}
                      </CardDescription>
                    </div>
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                      >
                        🗑️
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>حذف العنصر</AlertDialogTitle>
                        <AlertDialogDescription>
                          هل أنت متأكد من حذف "{item.title}"؟ هذا الإجراء غير قابل للتراجع.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-500 hover:bg-red-600"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          حذف نهائي
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-2">
                  {item.website_url && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">الموقع:</span>
                      <span className="text-sm font-mono">{item.website_url}</span>
                    </div>
                  )}
                  
                  {item.username && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">المستخدم:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-mono">{item.username}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(item.username!, 'اسم المستخدم')}
                        >
                          📋
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-400 mt-4">
                    تم الإنشاء: {item.created_at.toLocaleDateString('ar')}
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