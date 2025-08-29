import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/utils/trpc';
import type { 
  Vault, 
  CredentialItem, 
  ItemType,
  SearchItemsInput 
} from '../../../server/src/schema';

interface SearchItemsProps {
  vaults: Vault[];
}

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  password: '🔑 كلمة مرور',
  credit_card: '💳 بطاقة ائتمانية',
  secure_note: '📝 ملاحظة آمنة',
  software_license: '⚙️ رخصة برنامج'
};

const ITEM_TYPE_ICONS: Record<ItemType, string> = {
  password: '🔑',
  credit_card: '💳',
  secure_note: '📝',
  software_license: '⚙️'
};

export function SearchItems({ vaults }: SearchItemsProps) {
  const [searchResults, setSearchResults] = useState<CredentialItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [filters, setFilters] = useState<SearchItemsInput>({
    vault_id: undefined,
    category_id: undefined,
    type: undefined,
    query: ''
  });

  // Perform search
  const performSearch = useCallback(async () => {
    setIsLoading(true);
    try {
      const results = await trpc.searchItems.query({
        ...filters,
        query: searchQuery || undefined
      });
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters, searchQuery]);

  // Auto-search when filters or query change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery.trim() || filters.vault_id || filters.type) {
        performSearch();
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, filters, performSearch]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log(`${label} copied to clipboard`);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilters({
      vault_id: undefined,
      category_id: undefined,
      type: undefined,
      query: ''
    });
    setSearchResults([]);
  };

  const getVaultName = (vaultId: number) => {
    const vault = vaults.find(v => v.id === vaultId);
    return vault ? vault.name : 'خزينة غير معروفة';
  };

  return (
    <div className="space-y-6">
      {/* Search Filters */}
      <Card>
        <CardHeader>
          <CardTitle>🔍 البحث والتصفية</CardTitle>
          <CardDescription>
            ابحث في جميع العناصر المحفوظة أو اختر مرشحات محددة
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Query */}
          <div className="space-y-2">
            <Label htmlFor="searchQuery">نص البحث</Label>
            <Input
              id="searchQuery"
              placeholder="ابحث في العناوين، أسماء المستخدمين، المواقع..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Vault Filter */}
            <div className="space-y-2">
              <Label>الخزينة</Label>
              <Select
                value={filters.vault_id?.toString() || 'all'}
                onValueChange={(value: string) =>
                  setFilters((prev: SearchItemsInput) => ({
                    ...prev,
                    vault_id: value === 'all' ? undefined : parseInt(value)
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="جميع الخزائن" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الخزائن</SelectItem>
                  {vaults.map((vault: Vault) => (
                    <SelectItem key={vault.id} value={vault.id.toString()}>
                      {vault.is_shared ? '🌐' : '🔒'} {vault.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div className="space-y-2">
              <Label>نوع العنصر</Label>
              <Select
                value={filters.type || 'all'}
                onValueChange={(value: string) =>
                  setFilters((prev: SearchItemsInput) => ({
                    ...prev,
                    type: value === 'all' ? undefined : (value as ItemType)
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="جميع الأنواع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={clearFilters}
                className="w-full"
              >
                🗑️ مسح المرشحات
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>نتائج البحث</CardTitle>
            {isLoading && (
              <Badge variant="secondary">⏳ جاري البحث...</Badge>
            )}
            {!isLoading && searchResults.length > 0 && (
              <Badge variant="outline">{searchResults.length} نتيجة</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!searchQuery && !filters.vault_id && !filters.type ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-lg mb-2">ابدأ البحث</p>
              <p>أدخل كلمة للبحث أو اختر مرشحات للعثور على العناصر</p>
            </div>
          ) : searchResults.length === 0 && !isLoading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">😔</div>
              <p className="text-lg mb-2">لا توجد نتائج</p>
              <p>جرب تعديل كلمة البحث أو المرشحات</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {searchResults.map((item: CredentialItem) => (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
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
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-3">
                    {/* Vault Info */}
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        📁 {getVaultName(item.vault_id)}
                      </Badge>
                    </div>

                    {/* Item Details */}
                    <div className="space-y-2">
                      {item.website_url && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">الموقع:</span>
                          <span className="text-sm font-mono truncate max-w-[150px]">
                            {item.website_url}
                          </span>
                        </div>
                      )}
                      
                      {item.username && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">المستخدم:</span>
                          <div className="flex items-center space-x-1">
                            <span className="text-sm font-mono truncate max-w-[120px]">
                              {item.username}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(item.username!, 'اسم المستخدم')}
                              className="h-6 w-6 p-0"
                            >
                              📋
                            </Button>
                          </div>
                        </div>
                      )}

                      {item.card_holder_name && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">حامل البطاقة:</span>
                          <span className="text-sm font-mono truncate max-w-[120px]">
                            {item.card_holder_name}
                          </span>
                        </div>
                      )}

                      {item.license_email && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">البريد:</span>
                          <span className="text-sm font-mono truncate max-w-[120px]">
                            {item.license_email}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-gray-400 pt-2 border-t">
                      تم الإنشاء: {item.created_at.toLocaleDateString('ar')}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}