'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { digestService } from '@/services/NotificationDigestService';
import type { NotificationDigest } from '@/types/notifications.types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  MessageSquare, 
  Calendar,
  Users,
  Clock,
  ArrowUp,
  ArrowDown,
  Mail,
  BarChart3
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function DigestView() {
  const params = useParams();
  const [digest, setDigest] = useState<NotificationDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      loadDigest();
    }
  }, [params.id]);

  const loadDigest = async () => {
    try {
      setError(null);
      const digestData = await digestService.getDigestContent(params.id as string);
      
      if (!digestData) {
        setError('Digest not found');
        return;
      }
      
      setDigest(digestData);
    } catch (err) {
      console.error('Error loading digest:', err);
      setError('Failed to load digest');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
      return `${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })}`;
    }
    
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const getRankChangeIcon = (rankChange: number) => {
    if (rankChange > 0) return <ArrowUp className="h-4 w-4 text-green-500" />;
    if (rankChange < 0) return <ArrowDown className="h-4 w-4 text-red-500" />;
    return null;
  };

  const getRankChangeText = (rankChange: number) => {
    if (rankChange > 0) return `+${rankChange} positions`;
    if (rankChange < 0) return `${rankChange} positions`;
    return 'No change';
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'weight_logged': return <BarChart3 className="h-5 w-5 text-blue-500" />;
      case 'rank_change': return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'competition_joined': return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 'message_received': return <MessageSquare className="h-5 w-5 text-purple-500" />;
      default: return <Calendar className="h-5 w-5 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !digest) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Digest Not Found</h3>
            <p className="text-muted-foreground mb-4">
              {error || 'The requested digest could not be found.'}
            </p>
            <Link href="/notifications">
              <Button>Back to Notifications</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Mail className="h-8 w-8 text-primary" />
            {digest.digest_type === 'daily' ? 'Daily' : 'Weekly'} Summary
          </h1>
          <p className="text-muted-foreground mt-1">
            {formatDateRange(digest.period_start, digest.period_end)}
          </p>
        </div>
        <Badge variant={digest.digest_type === 'daily' ? 'default' : 'secondary'}>
          {digest.digest_type.charAt(0).toUpperCase() + digest.digest_type.slice(1)}
        </Badge>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{digest.competitions_summary.length}</p>
                <p className="text-sm text-muted-foreground">Active Competitions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">
                  {digest.key_activities.reduce((sum, activity) => sum + activity.count, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Activities</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">
                  {digest.competitions_summary.reduce((sum, comp) => sum + comp.new_messages, 0)}
                </p>
                <p className="text-sm text-muted-foreground">New Messages</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Competition Updates */}
      {digest.competitions_summary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Competition Updates
            </CardTitle>
            <CardDescription>
              Your progress and activities across active competitions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {digest.competitions_summary.map((competition, index) => (
              <div key={competition.competition_id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{competition.competition_name}</h4>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        Rank #{competition.current_rank} of {competition.participants_count}
                      </div>
                      {competition.days_remaining > 0 && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {competition.days_remaining} days left
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge 
                    variant={competition.status === 'started' ? 'default' : 'secondary'}
                    className="capitalize"
                  >
                    {competition.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Rank Change */}
                  <div className="flex items-center gap-2">
                    {getRankChangeIcon(competition.rank_change)}
                    <div>
                      <p className="text-sm text-muted-foreground">Rank Change</p>
                      <p className={cn(
                        "font-medium",
                        competition.rank_change > 0 ? "text-green-600" : 
                        competition.rank_change < 0 ? "text-red-600" : "text-muted-foreground"
                      )}>
                        {getRankChangeText(competition.rank_change)}
                      </p>
                    </div>
                  </div>

                  {/* Progress Change */}
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Progress</p>
                      <p className="font-medium">
                        {competition.progress_change > 0 ? '+' : ''}{competition.progress_change.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* New Messages */}
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">New Messages</p>
                      <p className="font-medium">{competition.new_messages}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <Link href={`/competitions/${competition.competition_id}`}>
                    <Button variant="outline" size="sm">
                      View Competition
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Key Activities */}
      {digest.key_activities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Key Activities
            </CardTitle>
            <CardDescription>
              Your main activities during this period
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {digest.key_activities.map((activity, index) => (
              <div key={index} className="flex items-start gap-4 p-3 border rounded-lg">
                {getActivityIcon(activity.type)}
                <div className="flex-1">
                  <p className="font-medium">{activity.details}</p>
                  {activity.competitions_affected.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Competitions: {activity.competitions_affected.join(', ')}
                    </p>
                  )}
                </div>
                <Badge variant="outline">
                  {activity.count}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {digest.competitions_summary.length === 0 && digest.key_activities.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Quiet Period</h3>
            <p className="text-muted-foreground mb-4">
              No significant activities during this {digest.digest_type} period.
            </p>
            <Link href="/competitions">
              <Button>Browse Competitions</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center pt-6">
        <Link href="/notifications">
          <Button variant="outline">Back to Notifications</Button>
        </Link>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">
            Generated on {formatDate(digest.created_at)}
          </p>
          {digest.sent_at && (
            <p className="text-xs text-muted-foreground">
              Sent at {new Date(digest.sent_at).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}