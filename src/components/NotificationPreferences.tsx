'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { NotificationPreferences as NotificationPreferencesType, NotificationType } from '@/types/notifications.types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Bell, Clock, Mail, MessageSquare, Trophy, TrendingUp, Users } from 'lucide-react';

interface Competition {
  id: string;
  name: string;
  status: string;
}

export default function NotificationPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferencesType | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      loadPreferences();
      loadUserCompetitions();
    }
  }, [user]);

  const loadPreferences = async () => {
    try {
      const supabase = createBrowserClient();
      
      // Check if preferences exist
      const { data: existingPrefs, error: fetchError } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user!.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // Not found error
        throw fetchError;
      }

      if (existingPrefs) {
        setPreferences(existingPrefs);
      } else {
        // Create default preferences
        const defaultPrefs: Omit<NotificationPreferencesType, 'id' | 'created_at' | 'updated_at'> = {
          user_id: user!.id,
          enabled: true,
          preferred_time: '09:00',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          daily_reminders: true,
          progress_updates: true,
          competition_start: true,
          competition_ending: true,
          competition_completed: true,
          new_messages: true,
          leaderboard_changes: false,
          email_enabled: true,
          push_enabled: true,
          in_app_enabled: true,
          max_notifications_per_day: 5,
          digest_frequency: 'weekly',
          batch_similar_notifications: true,
          priority_competitions: [],
          muted_competitions: []
        };

        const { data: newPrefs, error: createError } = await supabase
          .from('notification_preferences')
          .insert(defaultPrefs)
          .select()
          .single();

        if (createError) throw createError;
        setPreferences(newPrefs);
      }
    } catch (err) {
      console.error('Error loading preferences:', err);
      setError('Failed to load notification preferences');
    }
  };

  const loadUserCompetitions = async () => {
    try {
      const supabase = createBrowserClient();
      
      const { data, error } = await supabase
        .from('competition_participants')
        .select(`
          competition:competition_id!inner (
            id,
            name,
            status
          )
        `)
        .eq('user_id', user!.id)
        .eq('is_active', true);

      if (error) throw error;

      const userCompetitions: Competition[] = (data || [])
        .map((item: any) => item.competition)
        .filter((comp: any) => comp !== null)
        .map((comp: any) => ({
          id: comp.id,
          name: comp.name,
          status: comp.status
        }));

      setCompetitions(userCompetitions);
    } catch (err) {
      console.error('Error loading competitions:', err);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (updates: Partial<NotificationPreferencesType>) => {
    if (!preferences) return;

    setError(null);
    
    // Optimistic update - update UI immediately
    const optimisticPrefs = { ...preferences, ...updates };
    setPreferences(optimisticPrefs);
    
    setSaving(true);

    try {
      const supabase = createBrowserClient();
      
      // Only update the fields that are allowed to be updated
      // Don't include id, created_at, user_id, etc.
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('notification_preferences')
        .update(updateData)
        .eq('id', preferences.id)
        .select()
        .single();

      if (error) {
        // Revert optimistic update on error
        setPreferences(preferences);
        throw error;
      }

      // Update local state with the returned data from server
      setPreferences(data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error updating preferences:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save preferences';
      setError(errorMessage);
      // Error toast or alert could go here
    } finally {
      setSaving(false);
    }
  };

  const toggleCompetitionPriority = (competitionId: string) => {
    if (!preferences) return;

    const isPriority = preferences.priority_competitions.includes(competitionId);
    const isMuted = preferences.muted_competitions.includes(competitionId);

    let priority_competitions = [...preferences.priority_competitions];
    let muted_competitions = [...preferences.muted_competitions];

    if (isPriority) {
      // Remove from priority
      priority_competitions = priority_competitions.filter(id => id !== competitionId);
    } else if (isMuted) {
      // Move from muted to priority
      muted_competitions = muted_competitions.filter(id => id !== competitionId);
      priority_competitions.push(competitionId);
    } else {
      // Add to priority
      priority_competitions.push(competitionId);
    }

    updatePreferences({ priority_competitions, muted_competitions });
  };

  const toggleCompetitionMute = (competitionId: string) => {
    if (!preferences) return;

    const isPriority = preferences.priority_competitions.includes(competitionId);
    const isMuted = preferences.muted_competitions.includes(competitionId);

    let priority_competitions = [...preferences.priority_competitions];
    let muted_competitions = [...preferences.muted_competitions];

    if (isMuted) {
      // Remove from muted
      muted_competitions = muted_competitions.filter(id => id !== competitionId);
    } else if (isPriority) {
      // Move from priority to muted
      priority_competitions = priority_competitions.filter(id => id !== competitionId);
      muted_competitions.push(competitionId);
    } else {
      // Add to muted
      muted_competitions.push(competitionId);
    }

    updatePreferences({ priority_competitions, muted_competitions });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Failed to load notification preferences.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Notification Preferences</h1>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md">
          Preferences saved successfully!
        </div>
      )}

      {/* Global Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Global Settings
          </CardTitle>
          <CardDescription>
            Control when and how you receive notifications across all competitions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Enable notifications</Label>
            <Switch
              id="enabled"
              checked={preferences.enabled}
              onCheckedChange={(enabled: boolean) => updatePreferences({ enabled })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Preferred notification time
              </Label>
              <Select
                value={preferences.preferred_time}
                onValueChange={(preferred_time: string) => updatePreferences({ preferred_time })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i.toString().padStart(2, '0');
                    return (
                      <SelectItem key={hour} value={`${hour}:00`}>
                        {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Max notifications per day</Label>
              <Select
                value={preferences.max_notifications_per_day.toString()}
                onValueChange={(value: string) => updatePreferences({ max_notifications_per_day: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 notifications</SelectItem>
                  <SelectItem value="5">5 notifications</SelectItem>
                  <SelectItem value="10">10 notifications</SelectItem>
                  <SelectItem value="20">20 notifications</SelectItem>
                  <SelectItem value="999">Unlimited</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="batch">Batch similar notifications</Label>
            <Switch
              id="batch"
              checked={preferences.batch_similar_notifications}
              onCheckedChange={(batch_similar_notifications: boolean) => 
                updatePreferences({ batch_similar_notifications })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Notification Types
          </CardTitle>
          <CardDescription>
            Choose which types of notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'daily_reminders', label: 'Daily Reminders', icon: Clock, desc: 'Daily prompts to log your progress' },
            { key: 'progress_updates', label: 'Progress Updates', icon: TrendingUp, desc: 'Updates on your performance and rankings' },
            { key: 'competition_start', label: 'Competition Started', icon: Trophy, desc: 'When competitions you\'re in begin' },
            { key: 'competition_ending', label: 'Competition Ending', icon: Trophy, desc: 'Reminders when competitions are about to end' },
            { key: 'competition_completed', label: 'Competition Completed', icon: Trophy, desc: 'Final results and rankings' },
            { key: 'new_messages', label: 'New Messages', icon: MessageSquare, desc: 'Messages from other participants' },
            { key: 'leaderboard_changes', label: 'Leaderboard Changes', icon: Users, desc: 'When your ranking changes significantly' },
          ].map(({ key, label, icon: Icon, desc }) => (
            <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <Label className="font-medium">{label}</Label>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
              <Switch
                checked={preferences[key as keyof NotificationPreferencesType] as boolean}
                onCheckedChange={(value: boolean) => updatePreferences({ [key]: value })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Delivery Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Delivery Channels
          </CardTitle>
          <CardDescription>
            Choose how you want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="email">Email notifications</Label>
            <Switch
              id="email"
              checked={preferences.email_enabled}
              onCheckedChange={(email_enabled: boolean) => updatePreferences({ email_enabled })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <Label htmlFor="push">Push notifications</Label>
              {saving && preferences.push_enabled !== undefined && (
                <span className="text-xs text-muted-foreground">Saving...</span>
              )}
            </div>
            <Switch
              id="push"
              checked={preferences.push_enabled}
              disabled={saving}
              onCheckedChange={(push_enabled: boolean) => updatePreferences({ push_enabled })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="in-app">In-app notifications</Label>
            <Switch
              id="in-app"
              checked={preferences.in_app_enabled}
              onCheckedChange={(in_app_enabled: boolean) => updatePreferences({ in_app_enabled })}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Digest frequency</Label>
            <Select
              value={preferences.digest_frequency}
              onValueChange={(digest_frequency: 'daily' | 'weekly' | 'disabled') => 
                updatePreferences({ digest_frequency })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily digest</SelectItem>
                <SelectItem value="weekly">Weekly digest</SelectItem>
                <SelectItem value="disabled">No digest</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Receive a summary of all your competition activities
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Competition-Specific Settings */}
      {competitions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Competition Settings
            </CardTitle>
            <CardDescription>
              Customize notifications for individual competitions you're participating in
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {competitions.map((competition) => {
                const isPriority = preferences.priority_competitions.includes(competition.id);
                const isMuted = preferences.muted_competitions.includes(competition.id);

                return (
                  <div key={competition.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">{competition.name}</p>
                        <p className="text-sm text-muted-foreground capitalize">{competition.status}</p>
                      </div>
                      {isPriority && (
                        <Badge variant="default">Priority</Badge>
                      )}
                      {isMuted && (
                        <Badge variant="secondary">Muted</Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={isPriority ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleCompetitionPriority(competition.id)}
                      >
                        Priority
                      </Button>
                      <Button
                        variant={isMuted ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => toggleCompetitionMute(competition.id)}
                      >
                        Mute
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Priority competitions</strong> will send all enabled notifications regardless of daily limits.
                <br />
                <strong>Muted competitions</strong> will only send critical notifications (competition ended, etc.).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button 
          onClick={() => window.location.reload()} 
          disabled={saving}
          className="min-w-[120px]"
        >
          {saving ? 'Saving...' : 'Reset to Defaults'}
        </Button>
      </div>
    </div>
  );
}