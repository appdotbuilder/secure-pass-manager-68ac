import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/utils/trpc';
import type { GeneratePasswordInput } from '../../../server/src/schema';

export function PasswordGenerator() {
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  const [settings, setSettings] = useState<GeneratePasswordInput>({
    length: 16,
    include_uppercase: true,
    include_lowercase: true,
    include_numbers: true,
    include_symbols: true,
    exclude_ambiguous: false
  });

  const handleGeneratePassword = async () => {
    setIsLoading(true);
    setIsCopied(false);
    
    try {
      const result = await trpc.generatePassword.mutate(settings);
      setGeneratedPassword(result.password);
      setPasswordStrength(result.strength);
    } catch (error) {
      console.error('Failed to generate password:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!generatedPassword) return;
    
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const getStrengthLabel = (strength: number) => {
    if (strength >= 80) return { label: 'قوية جداً', color: 'bg-green-500' };
    if (strength >= 60) return { label: 'قوية', color: 'bg-blue-500' };
    if (strength >= 40) return { label: 'متوسطة', color: 'bg-yellow-500' };
    if (strength >= 20) return { label: 'ضعيفة', color: 'bg-orange-500' };
    return { label: 'ضعيفة جداً', color: 'bg-red-500' };
  };

  const strengthInfo = getStrengthLabel(passwordStrength);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Generated Password Display */}
      <Card>
        <CardHeader>
          <CardTitle className="text-center">كلمة المرور المُولَّدة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Input
              value={generatedPassword}
              placeholder="اضغط على 'توليد كلمة مرور' لإنشاء كلمة مرور جديدة"
              className="text-center font-mono text-lg pr-12"
              readOnly
            />
            {generatedPassword && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2"
                onClick={copyToClipboard}
              >
                {isCopied ? '✅' : '📋'}
              </Button>
            )}
          </div>
          
          {generatedPassword && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">قوة كلمة المرور:</span>
                <Badge className={`${strengthInfo.color} text-white`}>
                  {strengthInfo.label} ({passwordStrength}%)
                </Badge>
              </div>
              <Progress value={passwordStrength} className="h-2" />
            </div>
          )}
          
          <Button
            onClick={handleGeneratePassword}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? '⏳ جاري التوليد...' : '🎲 توليد كلمة مرور'}
          </Button>
        </CardContent>
      </Card>

      {/* Password Settings */}
      <Card>
        <CardHeader>
          <CardTitle>إعدادات كلمة المرور</CardTitle>
          <CardDescription>
            خصص خصائص كلمة المرور حسب احتياجاتك
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Length Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>طول كلمة المرور</Label>
              <Badge variant="outline">{settings.length} حرف</Badge>
            </div>
            <Slider
              value={[settings.length]}
              onValueChange={([value]: number[]) =>
                setSettings((prev: GeneratePasswordInput) => ({ ...prev, length: value }))
              }
              min={4}
              max={128}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>4</span>
              <span>128</span>
            </div>
          </div>

          {/* Character Type Options */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="uppercase">أحرف كبيرة (A-Z)</Label>
                <Switch
                  id="uppercase"
                  checked={settings.include_uppercase}
                  onCheckedChange={(checked: boolean) =>
                    setSettings((prev: GeneratePasswordInput) => ({ ...prev, include_uppercase: checked }))
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="lowercase">أحرف صغيرة (a-z)</Label>
                <Switch
                  id="lowercase"
                  checked={settings.include_lowercase}
                  onCheckedChange={(checked: boolean) =>
                    setSettings((prev: GeneratePasswordInput) => ({ ...prev, include_lowercase: checked }))
                  }
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="numbers">أرقام (0-9)</Label>
                <Switch
                  id="numbers"
                  checked={settings.include_numbers}
                  onCheckedChange={(checked: boolean) =>
                    setSettings((prev: GeneratePasswordInput) => ({ ...prev, include_numbers: checked }))
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="symbols">رموز (!@#$%)</Label>
                <Switch
                  id="symbols"
                  checked={settings.include_symbols}
                  onCheckedChange={(checked: boolean) =>
                    setSettings((prev: GeneratePasswordInput) => ({ ...prev, include_symbols: checked }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Advanced Options */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="ambiguous">استبعاد الأحرف الملتبسة</Label>
                <p className="text-xs text-gray-500">مثل: 0, O, l, I, 1</p>
              </div>
              <Switch
                id="ambiguous"
                checked={settings.exclude_ambiguous}
                onCheckedChange={(checked: boolean) =>
                  setSettings((prev: GeneratePasswordInput) => ({ ...prev, exclude_ambiguous: checked }))
                }
              />
            </div>
          </div>

          {/* Character Count Display */}
          <div className="grid grid-cols-4 gap-2 text-center">
            {settings.include_uppercase && (
              <Badge variant="secondary">A-Z (26)</Badge>
            )}
            {settings.include_lowercase && (
              <Badge variant="secondary">a-z (26)</Badge>
            )}
            {settings.include_numbers && (
              <Badge variant="secondary">0-9 (10)</Badge>
            )}
            {settings.include_symbols && (
              <Badge variant="secondary">!@#$ (32)</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Password Tips */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-800">💡 نصائح لكلمة مرور قوية</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 space-y-2">
          <ul className="list-disc list-inside space-y-1">
            <li>استخدم كلمة مرور بطول 12 حرف على الأقل</li>
            <li>امزج بين الأحرف الكبيرة والصغيرة والأرقام والرموز</li>
            <li>تجنب استخدام معلومات شخصية أو كلمات شائعة</li>
            <li>استخدم كلمة مرور مختلفة لكل موقع أو تطبيق</li>
            <li>غيّر كلمات المرور بانتظام، خاصة للحسابات المهمة</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}