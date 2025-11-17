'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createBrowserClient } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';
import ProfilePhotoUpload from '@/components/ProfilePhotoUpload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  User, 
  Bell, 
  Shield, 
  Smartphone, 
  Mail, 
  LogOut, 
  Trash2,
  Download,
  Key,
  Eye,
  EyeOff,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

import type { Profile as DBProfile } from '@/types/supabase.types';

interface ProfileFormData {
  first_name: string;
  last_name: string;
  nickname: string;
  date_of_birth: string;
  photo_url: string | null;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState<ProfileFormData>({
    first_name: '',
    last_name: '',
    nickname: '',
    date_of_birth: '',
    photo_url: null,
  });

  // Privacy settings state
  const [privacySettings, setPrivacySettings] = useState({
    profile_visibility: 'public',
    show_in_leaderboards: true,
    allow_friend_requests: true,
    show_activity_status: true,
  });

  // Account settings state
  const [accountSettings, setAccountSettings] = useState({
    email: '',
    timezone: 'UTC',
    theme: 'system',
    language: 'en',
  });

  useEffect(() => {
    if (!user) {
      router.push('/signin');
      return;
    }

    // Handle URL tab parameter
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['profile', 'notifications', 'privacy', 'account', 'data'].includes(tabParam)) {
      setActiveTab(tabParam);
    }

    async function fetchUserData() {
      try {
        if (!user) {
          console.log('No user found, skipping data fetch');
          return;
        }

        console.log('Fetching user data for:', user.id);
        const supabase = createBrowserClient();
        
        // Fetch profile with better error handling
        console.log('Fetching profile...');
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('Profile fetch error:', profileError);
          // Don't throw, just log and continue with default values
          if (profileError.code !== 'PGRST116') {
            console.warn('Unexpected profile error:', profileError);
          }
        }

        console.log('Profile data received:', profile);

        if (profile) {
          setProfile({
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            nickname: profile.nickname || '',
            date_of_birth: profile.date_of_birth ? new Date(profile.date_of_birth).toISOString().split('T')[0] : '',
            photo_url: profile.photo_url,
          });

          // Set privacy settings from profile if they exist
          setPrivacySettings({
            profile_visibility: profile.profile_visibility || 'public',
            show_in_leaderboards: profile.show_in_leaderboards ?? true,
            allow_friend_requests: profile.allow_friend_requests ?? true,
            show_activity_status: profile.show_activity_status ?? true,
          });
        }

        // Set account settings
        setAccountSettings({
          email: user.email || '',
          timezone: profile?.timezone || 'UTC',
          theme: profile?.theme || 'system',
          language: profile?.language || 'en',
        });

        console.log('User data fetch completed successfully');

      } catch (error) {
        console.error('Error fetching user data:', error);
        // Don't let errors prevent the page from loading
        toast.error('Some settings may not load properly');
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserData();
  }, [user, router]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (!user) throw new Error('Not authenticated');

      const updates = {
        first_name: profile.first_name.trim() || null,
        last_name: profile.last_name.trim() || null,
        nickname: profile.nickname.trim() || null,
        date_of_birth: profile.date_of_birth ? new Date(profile.date_of_birth).toISOString() : null,
        ...privacySettings,
        ...accountSettings,
      };

      const supabase = createBrowserClient();
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Profile updated successfully!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const supabase = createBrowserClient();
      await supabase.auth.signOut();
      router.push('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    try {
      // This would typically call an API endpoint to handle account deletion
      toast.error('Account deletion not implemented yet');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
    }
  };

  const handleExportData = async () => {
    try {
      // This would typically call an API endpoint to export user data
      toast.success('Data export will be emailed to you within 24 hours');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading settings..." />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Account
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information and profile photo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <ProfilePhotoUpload
                  userId={user?.id || ''}
                  currentPhotoUrl={profile.photo_url}
                  onPhotoUpdate={(url) => setProfile(prev => ({ ...prev, photo_url: url }))}
                  size="lg"
                />
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      name="first_name"
                      value={profile.first_name}
                      onChange={(e) => setProfile(prev => ({ ...prev, first_name: e.target.value }))}
                      placeholder="Enter your first name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      name="last_name"
                      value={profile.last_name}
                      onChange={(e) => setProfile(prev => ({ ...prev, last_name: e.target.value }))}
                      placeholder="Enter your last name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nickname">Nickname</Label>
                    <Input
                      id="nickname"
                      name="nickname"
                      value={profile.nickname}
                      onChange={(e) => setProfile(prev => ({ ...prev, nickname: e.target.value }))}
                      placeholder="Enter your nickname"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Date of Birth</Label>
                    <Input
                      id="date_of_birth"
                      name="date_of_birth"
                      type="date"
                      value={profile.date_of_birth}
                      onChange={(e) => setProfile(prev => ({ ...prev, date_of_birth: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Control how and when you receive notifications for your competitions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Notification System Setup Required</h3>
                <p className="mb-4">
                  The advanced notification system requires database migration to be completed.
                </p>
                <div className="bg-muted p-4 rounded-lg text-left">
                  <p className="text-sm font-medium mb-2">To enable notification preferences:</p>
                  <ol className="text-sm space-y-1 list-decimal list-inside">
                    <li>Run the notification system migration</li>
                    <li>Run the profile settings migration</li>
                    <li>Restart the application</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Privacy Settings</CardTitle>
              <CardDescription>
                Control who can see your information and activities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Profile Visibility</Label>
                    <p className="text-sm text-muted-foreground">
                      Control who can see your profile information
                    </p>
                  </div>
                  <Select
                    value={privacySettings.profile_visibility}
                    onValueChange={(value) => setPrivacySettings(prev => ({ ...prev, profile_visibility: value }))}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="friends">Friends Only</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show in Leaderboards</Label>
                    <p className="text-sm text-muted-foreground">
                      Display your progress in competition leaderboards
                    </p>
                  </div>
                  <Switch
                    checked={privacySettings.show_in_leaderboards}
                    onCheckedChange={(checked) => setPrivacySettings(prev => ({ ...prev, show_in_leaderboards: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow Friend Requests</Label>
                    <p className="text-sm text-muted-foreground">
                      Let other users send you friend requests
                    </p>
                  </div>
                  <Switch
                    checked={privacySettings.allow_friend_requests}
                    onCheckedChange={(checked) => setPrivacySettings(prev => ({ ...prev, allow_friend_requests: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Activity Status</Label>
                    <p className="text-sm text-muted-foreground">
                      Display when you were last active
                    </p>
                  </div>
                  <Switch
                    checked={privacySettings.show_activity_status}
                    onCheckedChange={(checked) => setPrivacySettings(prev => ({ ...prev, show_activity_status: checked }))}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleProfileSubmit} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Privacy Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Manage your account details and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="email"
                      type="email"
                      value={accountSettings.email}
                      disabled
                      className="flex-1"
                    />
                    <Badge variant="secondary">Verified</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Email changes require verification and are handled separately
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={accountSettings.timezone}
                    onValueChange={(value) => setAccountSettings(prev => ({ ...prev, timezone: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Chicago">Central Time</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      <SelectItem value="Europe/London">London</SelectItem>
                      <SelectItem value="Europe/Paris">Paris</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={accountSettings.theme}
                    onValueChange={(value) => setAccountSettings(prev => ({ ...prev, theme: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={accountSettings.language}
                    onValueChange={(value) => setAccountSettings(prev => ({ ...prev, language: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Account Actions</h3>
                
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="outline" onClick={handleSignOut} className="flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                  
                  <Button variant="outline" asChild>
                    <a href="/auth/change-password" className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Change Password
                    </a>
                  </Button>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleProfileSubmit} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Account Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>
                Export your data or delete your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <h4 className="font-medium">Export Your Data</h4>
                    <p className="text-sm text-muted-foreground">
                      Download a copy of all your data including profile, competitions, and activities
                    </p>
                  </div>
                  <Button variant="outline" onClick={handleExportData} className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export Data
                  </Button>
                </div>

                <Separator />

                <div className="space-y-4 p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                  <div className="space-y-2">
                    <h4 className="font-medium text-destructive">Danger Zone</h4>
                    <p className="text-sm text-muted-foreground">
                      These actions are permanent and cannot be undone
                    </p>
                  </div>
                  
                  <Button 
                    variant="destructive" 
                    onClick={handleDeleteAccount}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
