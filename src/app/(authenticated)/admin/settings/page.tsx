'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRequireAdminAccess } from '@/hooks/useAdminAccess';
import { createBrowserClient } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Save, RotateCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'sonner';

interface SystemSettings {
  id: string;
  maintenance_mode: boolean;
  feature_matchmaking_enabled: boolean;
  feature_social_feed_enabled: boolean;
  feature_public_competitions_enabled: boolean;
  max_active_competitions_per_user: number;
  updated_at: string;
}

export default function AdminSettingsPage() {
  const { hasAccess, loading: adminLoading } = useRequireAdminAccess();
  const { user } = useAuth();
  const supabase = createBrowserClient();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (adminLoading || !adminLoading) {
      fetchSettings();
    }
  }, [adminLoading]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .single();

      if (!error && data) {
        setSettings(data);
      } else if (error && error.code === 'PGRST116') {
        // No rows found, create default settings
        await createDefaultSettings();
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching settings:', error);
      setLoading(false);
    }
  };

  const createDefaultSettings = async () => {
    try {
      const defaultSettings: Omit<SystemSettings, 'id' | 'updated_at'> = {
        maintenance_mode: false,
        feature_matchmaking_enabled: true,
        feature_social_feed_enabled: true,
        feature_public_competitions_enabled: true,
        max_active_competitions_per_user: 5,
      };

      const { data, error } = await supabase
        .from('system_settings')
        .insert([defaultSettings])
        .select()
        .single();

      if (!error && data) {
        setSettings(data);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error creating default settings:', error);
      setLoading(false);
    }
  };

  const handleToggle = (field: keyof SystemSettings, value: boolean) => {
    if (settings) {
      setSettings({ ...settings, [field]: value });
      setHasChanges(true);
    }
  };

  const handleNumberChange = (field: keyof SystemSettings, value: number) => {
    if (settings) {
      setSettings({ ...settings, [field]: value });
      setHasChanges(true);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({
          maintenance_mode: settings.maintenance_mode,
          feature_matchmaking_enabled: settings.feature_matchmaking_enabled,
          feature_social_feed_enabled: settings.feature_social_feed_enabled,
          feature_public_competitions_enabled: settings.feature_public_competitions_enabled,
          max_active_competitions_per_user: settings.max_active_competitions_per_user,
        })
        .eq('id', settings.id);

      if (!error) {
        setHasChanges(false);
        toast.success('Settings saved successfully');
        fetchSettings();
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (adminLoading || loading) {
    return <LoadingSpinner />;
  }

  if (!hasAccess) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You do not have permission to access admin settings.
        </AlertDescription>
      </Alert>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          No system settings found. Creating defaults...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure global features and system parameters
        </p>
      </div>

      {hasChanges && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unsaved Changes</AlertTitle>
          <AlertDescription>
            You have unsaved changes. Click "Save Settings" to apply them.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="maintenance" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Mode</CardTitle>
              <CardDescription>
                When enabled, only admins can access the application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="maintenance" className="cursor-pointer">
                    Enable Maintenance Mode
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    All users except admins will be redirected to a maintenance page
                  </p>
                </div>
                <Switch
                  id="maintenance"
                  checked={settings.maintenance_mode}
                  onCheckedChange={(value) =>
                    handleToggle('maintenance_mode', value)
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>User Limits</CardTitle>
              <CardDescription>
                Configure restrictions on user actions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="max-competitions">
                  Max Active Competitions Per User
                </Label>
                <Input
                  id="max-competitions"
                  type="number"
                  min="1"
                  max="100"
                  value={settings.max_active_competitions_per_user}
                  onChange={(e) =>
                    handleNumberChange(
                      'max_active_competitions_per_user',
                      parseInt(e.target.value) || 1
                    )
                  }
                  className="mt-2"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Users will not be able to join more than this many active competitions
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
              <CardDescription>
                Enable or disable specific application features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="matchmaking" className="cursor-pointer">
                    Matchmaking
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Allow users to join matchmaking queues and automatic match creation
                  </p>
                </div>
                <Switch
                  id="matchmaking"
                  checked={settings.feature_matchmaking_enabled}
                  onCheckedChange={(value) =>
                    handleToggle('feature_matchmaking_enabled', value)
                  }
                />
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="social-feed" className="cursor-pointer">
                      Social Activity Feed
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Display activity posts and social interactions
                    </p>
                  </div>
                  <Switch
                    id="social-feed"
                    checked={settings.feature_social_feed_enabled}
                    onCheckedChange={(value) =>
                      handleToggle('feature_social_feed_enabled', value)
                    }
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="public-competitions" className="cursor-pointer">
                      Public Competitions
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Allow creators to make competitions public for anyone to join
                    </p>
                  </div>
                  <Switch
                    id="public-competitions"
                    checked={settings.feature_public_competitions_enabled}
                    onCheckedChange={(value) =>
                      handleToggle('feature_public_competitions_enabled', value)
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex gap-2">
        <Button
          onClick={handleSaveSettings}
          disabled={!hasChanges || saving}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        {hasChanges && (
          <Button
            variant="outline"
            onClick={() => {
              fetchSettings();
              setHasChanges(false);
            }}
            className="gap-2"
          >
            <RotateCw className="h-4 w-4" />
            Discard Changes
          </Button>
        )}
      </div>

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">Last Updated</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            {new Date(settings.updated_at).toLocaleString()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
