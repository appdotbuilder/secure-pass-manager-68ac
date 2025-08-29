import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { trpc } from '@/utils/trpc';
import type { 
  User, 
  CreateUserInput, 
  UpdateUserInput, 
  UserRole 
} from '../../../server/src/schema';

interface UserManagementProps {
  currentUser: User;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: '👑 مسؤول',
  user: '👤 مستخدم'
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'صلاحيات كاملة لإدارة النظام والمستخدمين',
  user: 'صلاحيات عادية لاستخدام النظام'
};

export function UserManagement({ currentUser }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [createFormData, setCreateFormData] = useState<CreateUserInput>({
    email: '',
    full_name: '',
    role: 'user',
    password: ''
  });

  const [editFormData, setEditFormData] = useState<UpdateUserInput>({
    id: 0,
    email: undefined,
    full_name: undefined,
    role: undefined,
    is_active: undefined
  });

  // Load users
  const loadUsers = useCallback(async () => {
    try {
      const allUsers = await trpc.getUsers.query();
      setUsers(allUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const newUser = await trpc.createUser.mutate(createFormData);
      setUsers((prev: User[]) => [...prev, newUser]);
      setCreateFormData({
        email: '',
        full_name: '',
        role: 'user',
        password: ''
      });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Failed to create user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setIsLoading(true);
    try {
      const updatedUser = await trpc.updateUser.mutate(editFormData);
      setUsers((prev: User[]) => 
        prev.map(user => user.id === updatedUser.id ? updatedUser : user)
      );
      setIsEditDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Failed to update user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      await trpc.deleteUser.mutate({ id: userId });
      setUsers((prev: User[]) => prev.filter(user => user.id !== userId));
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditFormData({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active
    });
    setIsEditDialogOpen(true);
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCreateFormData((prev: CreateUserInput) => ({ ...prev, password }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">إدارة المستخدمين ({users.length})</h3>
          <p className="text-sm text-gray-600">إضافة وإدارة مستخدمي النظام وأدوارهم</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              ➕ إضافة مستخدم جديد
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة مستخدم جديد</DialogTitle>
              <DialogDescription>
                أنشئ حساب مستخدم جديد في النظام
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@company.com"
                    value={createFormData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCreateFormData((prev: CreateUserInput) => ({ ...prev, email: e.target.value }))
                    }
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="fullName">الاسم الكامل</Label>
                  <Input
                    id="fullName"
                    placeholder="محمد أحمد"
                    value={createFormData.full_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCreateFormData((prev: CreateUserInput) => ({ ...prev, full_name: e.target.value }))
                    }
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role">الدور</Label>
                  <Select
                    value={createFormData.role}
                    onValueChange={(value: UserRole) =>
                      setCreateFormData((prev: CreateUserInput) => ({ ...prev, role: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          <div>
                            <div>{label}</div>
                            <div className="text-xs text-gray-500">
                              {ROLE_DESCRIPTIONS[value as UserRole]}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">كلمة المرور</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="password"
                      type="password"
                      placeholder="كلمة مرور قوية"
                      value={createFormData.password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setCreateFormData((prev: CreateUserInput) => ({ ...prev, password: e.target.value }))
                      }
                      required
                      minLength={8}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={generateRandomPassword}
                      size="sm"
                    >
                      🎲
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">يجب أن تكون 8 أحرف على الأقل</p>
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
                  {isLoading ? '⏳ إنشاء...' : '✅ إنشاء المستخدم'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Users Table */}
      {users.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-6xl mb-4">👥</div>
          <p className="text-lg mb-2">لا يوجد مستخدمون حتى الآن</p>
          <p>أضف المستخدم الأول لبدء إدارة النظام</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>قائمة المستخدمين</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المستخدم</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>الدور</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>تاريخ الإنشاء</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user: User) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.full_name}</div>
                        {user.id === currentUser.id && (
                          <Badge variant="outline" className="text-xs">أنت</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {ROLE_LABELS[user.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'default' : 'destructive'}>
                        {user.is_active ? '✅ نشط' : '❌ غير نشط'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {user.created_at.toLocaleDateString('ar')}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(user)}
                          disabled={user.id === currentUser.id}
                        >
                          ✏️
                        </Button>
                        
                        {user.id !== currentUser.id && (
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
                                <AlertDialogTitle>حذف المستخدم</AlertDialogTitle>
                                <AlertDialogDescription>
                                  هل أنت متأكد من حذف المستخدم "{user.full_name}"؟ 
                                  سيفقد الوصول إلى النظام نهائياً. هذا الإجراء غير قابل للتراجع.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-500 hover:bg-red-600"
                                  onClick={() => handleDeleteUser(user.id)}
                                >
                                  حذف نهائي
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل المستخدم</DialogTitle>
            <DialogDescription>
              تعديل معلومات وأذونات المستخدم
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateUser}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editEmail">البريد الإلكتروني</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editFormData.email || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditFormData((prev: UpdateUserInput) => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="editFullName">الاسم الكامل</Label>
                <Input
                  id="editFullName"
                  value={editFormData.full_name || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditFormData((prev: UpdateUserInput) => ({ ...prev, full_name: e.target.value }))
                  }
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="editRole">الدور</Label>
                <Select
                  value={editFormData.role || 'user'}
                  onValueChange={(value: UserRole) =>
                    setEditFormData((prev: UpdateUserInput) => ({ ...prev, role: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="editActive">المستخدم نشط</Label>
                  <p className="text-xs text-gray-500">تعطيل الحساب يمنع تسجيل الدخول</p>
                </div>
                <Switch
                  id="editActive"
                  checked={editFormData.is_active ?? true}
                  onCheckedChange={(checked: boolean) =>
                    setEditFormData((prev: UpdateUserInput) => ({ ...prev, is_active: checked }))
                  }
                />
              </div>
            </div>
            
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isLoading}
              >
                إلغاء
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? '⏳ حفظ...' : '✅ حفظ التغييرات'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}