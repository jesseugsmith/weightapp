'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/contexts/PermissionsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Competition, CompetitionParticipant, CompetitionIssue, Profile } from '@/types/supabase.types';
import { toast } from 'sonner';

type AdminCompetition = Competition & {
  days_left: number | null;
  participants_count: number;
  open_issues: number;
  total_issues: number;
};

type AdminParticipant = CompetitionParticipant & {
  profile?: Partial<Profile> | null;
};

type IssueWithReporter = CompetitionIssue & {
  reporter?: Partial<Profile> | null;
};

const statusOptions = ['all', 'started', 'draft', 'completed', 'cancelled'];
const issueStatusOptions: CompetitionIssue['status'][] = ['open', 'in_progress', 'resolved'];

function formatDaysLeft(days: number | null) {
  if (days === null || Number.isNaN(days)) return 'No end date';
  if (days < 0) return 'Ended';
  if (days === 0) return 'Ends today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

function statusVariant(status: string | null | undefined) {
  switch (status) {
    case 'started':
      return 'bg-blue-100 text-blue-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'draft':
      return 'bg-yellow-100 text-yellow-800';
    case 'cancelled':
      return 'bg-gray-200 text-gray-700';
    case 'open':
      return 'bg-amber-100 text-amber-800';
    case 'in_progress':
      return 'bg-indigo-100 text-indigo-800';
    case 'resolved':
      return 'bg-emerald-100 text-emerald-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin, loading: permissionsLoading } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [competitions, setCompetitions] = useState<AdminCompetition[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('started');

  const [issues, setIssues] = useState<IssueWithReporter[]>([]);
  const [issueStatusFilter, setIssueStatusFilter] =
    useState<CompetitionIssue['status'] | 'all'>('open');
  const [issueCompetitionFilter, setIssueCompetitionFilter] = useState<string>('all');
  const [issueNotes, setIssueNotes] = useState<Record<string, string>>({});
  const [loadingIssues, setLoadingIssues] = useState(false);

  const [selectedCompetition, setSelectedCompetition] = useState<AdminCompetition | null>(null);
  const [participants, setParticipants] = useState<AdminParticipant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [weightEdits, setWeightEdits] = useState<Record<string, string>>({});
  const [addParticipantForm, setAddParticipantForm] = useState({
    userId: '',
    startingWeight: '',
    currentWeight: '',
    goalWeight: '',
  });

  const competitionMap = useMemo(
    () => new Map(competitions.map((c) => [c.id, c.name])),
    [competitions]
  );

  useEffect(() => {
    if (isAdmin || isSuperAdmin) {
      void fetchCompetitions();
    }
  }, [isAdmin, isSuperAdmin, statusFilter]);

  useEffect(() => {
    if (isAdmin || isSuperAdmin) {
      void fetchIssues();
    }
  }, [issueStatusFilter, issueCompetitionFilter, competitionMap, isAdmin, isSuperAdmin]);

  const fetchCompetitions = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/competitions?status=${encodeURIComponent(statusFilter)}`
      );
      if (!res.ok) {
        throw new Error('Failed to load competitions');
      }
      const data = await res.json();
      setCompetitions(data.competitions || []);
    } catch (error) {
      console.error(error);
      toast.error('Unable to load competitions');
    } finally {
      setLoading(false);
    }
  };

  const fetchIssues = async () => {
    setLoadingIssues(true);
    try {
      const params = new URLSearchParams();
      if (issueStatusFilter && issueStatusFilter !== 'all') {
        params.append('status', issueStatusFilter);
      }
      if (issueCompetitionFilter && issueCompetitionFilter !== 'all') {
        params.append('competitionId', issueCompetitionFilter);
      }
      const res = await fetch(`/api/admin/competition-issues?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load issues');
      const data = await res.json();
      setIssues(data.issues || []);
      const notes: Record<string, string> = {};
      (data.issues || []).forEach((issue: IssueWithReporter) => {
        notes[issue.id] = issue.resolution_notes || '';
      });
      setIssueNotes(notes);
    } catch (error) {
      console.error(error);
      toast.error('Unable to load competition issues');
    } finally {
      setLoadingIssues(false);
    }
  };

  const fetchParticipants = async (competitionId: string) => {
    setParticipantsLoading(true);
    try {
      const res = await fetch(`/api/admin/competitions/${competitionId}/participants`);
      if (!res.ok) {
        throw new Error('Failed to load participants');
      }
      const data = await res.json();
      setParticipants(data.participants || []);
      const weights: Record<string, string> = {};
      (data.participants || []).forEach((p: AdminParticipant) => {
        if (p.current_weight !== null && p.current_weight !== undefined) {
          weights[p.id] = String(p.current_weight);
        }
      });
      setWeightEdits(weights);
    } catch (error) {
      console.error(error);
      toast.error('Unable to load participants');
    } finally {
      setParticipantsLoading(false);
    }
  };

  const openParticipantsModal = (competition: AdminCompetition) => {
    setSelectedCompetition(competition);
    setParticipants([]);
    void fetchParticipants(competition.id);
  };

  const handleAddParticipant = async () => {
    if (!selectedCompetition) return;
    if (!addParticipantForm.userId) {
      toast.error('User ID is required');
      return;
    }

    try {
      const body = {
        userId: addParticipantForm.userId.trim(),
        startingWeight: addParticipantForm.startingWeight
          ? Number(addParticipantForm.startingWeight)
          : null,
        currentWeight: addParticipantForm.currentWeight
          ? Number(addParticipantForm.currentWeight)
          : undefined,
        goalWeight: addParticipantForm.goalWeight ? Number(addParticipantForm.goalWeight) : null,
      };

      const res = await fetch(`/api/admin/competitions/${selectedCompetition.id}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to add participant');
      }

      const data = await res.json();
      setParticipants((prev) => [data.participant, ...prev]);
      setAddParticipantForm({ userId: '', startingWeight: '', currentWeight: '', goalWeight: '' });
      toast.success('Participant added');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Unable to add participant');
    }
  };

  const handleToggleActive = async (participant: AdminParticipant) => {
    if (!selectedCompetition) return;
    try {
      const res = await fetch(
        `/api/admin/competitions/${selectedCompetition.id}/participants`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantId: participant.id,
            isActive: !participant.is_active,
          }),
        }
      );

      if (!res.ok) throw new Error('Failed to update participant');
      const data = await res.json();
      setParticipants((prev) =>
        prev.map((p) => (p.id === participant.id ? data.participant : p))
      );
      toast.success(`Participant ${participant.is_active ? 'deactivated' : 'activated'}`);
    } catch (error) {
      console.error(error);
      toast.error('Unable to update participant');
    }
  };

  const handleUpdateWeight = async (participant: AdminParticipant) => {
    if (!selectedCompetition) return;
    const weightValue = weightEdits[participant.id];
    if (weightValue === undefined) {
      toast.error('Enter a weight value');
      return;
    }

    try {
      const res = await fetch(
        `/api/admin/competitions/${selectedCompetition.id}/participants`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantId: participant.id,
            currentWeight: weightValue === '' ? null : Number(weightValue),
          }),
        }
      );

      if (!res.ok) throw new Error('Failed to update weight');
      const data = await res.json();
      setParticipants((prev) =>
        prev.map((p) => (p.id === participant.id ? data.participant : p))
      );
      toast.success('Weight updated');
    } catch (error) {
      console.error(error);
      toast.error('Unable to update weight');
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    if (!selectedCompetition) return;
    try {
      const res = await fetch(
        `/api/admin/competitions/${selectedCompetition.id}/participants`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId }),
        }
      );

      if (!res.ok) throw new Error('Failed to remove participant');
      setParticipants((prev) => prev.filter((p) => p.id !== participantId));
      toast.success('Participant removed');
    } catch (error) {
      console.error(error);
      toast.error('Unable to remove participant');
    }
  };

  const handleRecalculate = async (competitionId: string) => {
    try {
      const res = await fetch(`/api/competitions/${competitionId}/recalculate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Recalculation failed');
      toast.success(data?.message || 'Recalculation started');
    } catch (error) {
      console.error(error);
      toast.error('Unable to recalculate competition');
    }
  };

  const handleIssueUpdate = async (issueId: string) => {
    const status = issues.find((i) => i.id === issueId)?.status;
    const resolutionNotes = issueNotes[issueId] ?? '';

    try {
      const res = await fetch('/api/admin/competition-issues', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: issueId, status, resolution_notes: resolutionNotes }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update issue');
      }

      const data = await res.json();
      setIssues((prev) => prev.map((issue) => (issue.id === issueId ? data.issue : issue)));
      toast.success('Issue updated');
    } catch (error) {
      console.error(error);
      toast.error('Unable to update issue');
    }
  };

  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full text-center">
          <p className="text-lg font-semibold text-red-600">Access denied</p>
          <p className="mt-2 text-sm text-gray-600">
            Admin privileges are required to view this dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor competitions, triage issues, and manage participants.
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === 'all'
                    ? 'All statuses'
                    : status.charAt(0).toUpperCase() + status.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void fetchCompetitions()}>
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Competitions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10">
              <LoadingSpinner message="Loading competitions..." />
            </div>
          ) : competitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No competitions found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {competitions.map((comp) => (
                <Card key={comp.id} className="border shadow-sm">
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          {comp.competition_mode || 'Mode'} · {comp.activity_type || 'Activity'}
                        </p>
                        <CardTitle className="text-lg leading-6 line-clamp-2">{comp.name}</CardTitle>
                      </div>
                      <Badge className={statusVariant(comp.status)}>
                        {comp.status?.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="font-medium">{formatDaysLeft(comp.days_left)}</span>
                      <span>{comp.participants_count} participants</span>
                      <span>{comp.open_issues} open issues</span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-3">
                    <Button size="sm" onClick={() => handleRecalculate(comp.id)}>
                      Recalculate
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openParticipantsModal(comp)}
                    >
                      Manage participants
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIssueCompetitionFilter(comp.id);
                        setIssueStatusFilter('open');
                        void fetchIssues();
                      }}
                    >
                      View issues
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Issue Inbox</CardTitle>
            <p className="text-sm text-muted-foreground">
              Review and resolve issues reported from the mobile app.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={issueStatusFilter} onValueChange={(value) => setIssueStatusFilter(value as any)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Issue status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={issueCompetitionFilter}
              onValueChange={setIssueCompetitionFilter}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All competitions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All competitions</SelectItem>
                {competitions.map((comp) => (
                  <SelectItem key={comp.id} value={comp.id}>
                    {comp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void fetchIssues()}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingIssues ? (
            <div className="py-8">
              <LoadingSpinner message="Loading issues..." />
            </div>
          ) : issues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No issues found.</p>
          ) : (
            <div className="space-y-3">
              {issues.map((issue) => (
                <div
                  key={issue.id}
                  className="border rounded-lg p-4 shadow-sm bg-card"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {competitionMap.get(issue.competition_id) || 'Unknown competition'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {issue.issue_type} ·{' '}
                        {new Date(issue.created_at).toLocaleString()}
                      </p>
                      <p className="mt-2 text-sm text-foreground">{issue.description}</p>
                      {issue.reporter && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Reporter: {issue.reporter.first_name} {issue.reporter.last_name}
                        </p>
                      )}
                    </div>
                    <Badge className={statusVariant(issue.status)}>{issue.status.replace('_', ' ')}</Badge>
                  </div>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-2 items-center">
                      <Select
                        value={issue.status}
                        onValueChange={(value) =>
                          setIssues((prev) =>
                            prev.map((i) =>
                              i.id === issue.id ? { ...i, status: value as IssueWithReporter['status'] } : i
                            )
                          )
                        }
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {issueStatusOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt.replace('_', ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        className="w-64"
                        placeholder="Resolution notes"
                        value={issueNotes[issue.id] ?? ''}
                        onChange={(e) =>
                          setIssueNotes((prev) => ({ ...prev, [issue.id]: e.target.value }))
                        }
                      />
                    </div>
                    <Button size="sm" onClick={() => void handleIssueUpdate(issue.id)}>
                      Update
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCompetition && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold">
                  {selectedCompetition.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Manage participants
                </p>
              </div>
              <Button variant="ghost" onClick={() => setSelectedCompetition(null)}>
                Close
              </Button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Input
                  placeholder="User ID"
                  value={addParticipantForm.userId}
                  onChange={(e) =>
                    setAddParticipantForm((prev) => ({ ...prev, userId: e.target.value }))
                  }
                />
                <Input
                  placeholder="Starting weight (optional)"
                  value={addParticipantForm.startingWeight}
                  onChange={(e) =>
                    setAddParticipantForm((prev) => ({ ...prev, startingWeight: e.target.value }))
                  }
                />
                <Input
                  placeholder="Current weight (optional)"
                  value={addParticipantForm.currentWeight}
                  onChange={(e) =>
                    setAddParticipantForm((prev) => ({ ...prev, currentWeight: e.target.value }))
                  }
                />
                <Input
                  placeholder="Goal weight (optional)"
                  value={addParticipantForm.goalWeight}
                  onChange={(e) =>
                    setAddParticipantForm((prev) => ({ ...prev, goalWeight: e.target.value }))
                  }
                />
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={() => void handleAddParticipant()}>
                  Add participant
                </Button>
              </div>

              {participantsLoading ? (
                <div className="py-6">
                  <LoadingSpinner message="Loading participants..." />
                </div>
              ) : participants.length === 0 ? (
                <p className="text-sm text-muted-foreground">No participants yet.</p>
              ) : (
                <div className="space-y-3">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="border rounded-md p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">
                          {participant.profile
                            ? `${participant.profile.first_name || ''} ${participant.profile.last_name || ''}`.trim() ||
                              participant.profile.nickname ||
                              'User'
                            : participant.user_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Started: {participant.starting_weight ?? '—'} | Current:{' '}
                          {participant.current_weight ?? '—'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <Input
                          className="w-28"
                          type="number"
                          value={weightEdits[participant.id] ?? ''}
                          onChange={(e) =>
                            setWeightEdits((prev) => ({
                              ...prev,
                              [participant.id]: e.target.value,
                            }))
                          }
                          placeholder="Weight"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleUpdateWeight(participant)}
                        >
                          Update
                        </Button>
                        <Button
                          size="sm"
                          variant={participant.is_active ? 'secondary' : 'outline'}
                          onClick={() => void handleToggleActive(participant)}
                        >
                          {participant.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => void handleRemoveParticipant(participant.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

