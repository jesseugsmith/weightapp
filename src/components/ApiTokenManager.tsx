'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Copy, Key, Plus, Trash2, Eye, EyeOff, AlertCircle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { pb } from '@/lib/pocketbase';

interface ApiToken {
  id: string;
  name: string;
  token?: string; // Only available when first created
  token_preview?: string;
  last_used_at?: string;
  is_active: boolean;
  expires_at?: string;
  created: string;
}

export default function ApiTokenManager() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewTokenOpen, setIsViewTokenOpen] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<string>('never');
  const [createdToken, setCreatedToken] = useState<ApiToken | null>(null);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    try {
      const token = pb.authStore.token;
      if (!token) {
        toast.error('Not authenticated');
        return;
      }

      const response = await fetch('/api/tokens', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setTokens(data.tokens);
      } else {
        toast.error('Failed to fetch API tokens');
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
      toast.error('Failed to fetch API tokens');
    } finally {
      setLoading(false);
    }
  };

  const createToken = async () => {
    if (!newTokenName.trim()) {
      toast.error('Please enter a token name');
      return;
    }

    try {
      const token = pb.authStore.token;
      if (!token) {
        toast.error('Not authenticated');
        return;
      }

      const expires_in_days = expiresInDays === 'never' ? null : parseInt(expiresInDays);
      
      const response = await fetch('/api/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newTokenName, expires_in_days }),
      });

      if (response.ok) {
        const data = await response.json();
        setCreatedToken(data.token);
        setNewTokenName('');
        setExpiresInDays('never');
        setIsCreateOpen(false);
        setIsViewTokenOpen(true);
        fetchTokens();
        toast.success(data.message);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create token');
      }
    } catch (error) {
      console.error('Error creating token:', error);
      toast.error('Failed to create token');
    }
  };

  const deleteToken = async (tokenId: string) => {
    if (!confirm('Are you sure you want to delete this token? This action cannot be undone.')) {
      return;
    }

    try {
      const token = pb.authStore.token;
      if (!token) {
        toast.error('Not authenticated');
        return;
      }

      const response = await fetch(`/api/tokens?id=${tokenId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchTokens();
        toast.success('Token deleted successfully');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete token');
      }
    } catch (error) {
      console.error('Error deleting tokens:', error);
      toast.error('Failed to delete token');
    }
  };

  const toggleTokenActive = async (tokenId: string, isActive: boolean) => {
    try {
      const token = pb.authStore.token;
      if (!token) {
        toast.error('Not authenticated');
        return;
      }

      const response = await fetch(`/api/tokens?id=${tokenId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !isActive }),
      });

      if (response.ok) {
        fetchTokens();
        toast.success(`Token ${!isActive ? 'activated' : 'deactivated'} successfully`);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update token');
      }
    } catch (error) {
      console.error('Error updating token:', error);
      toast.error('Failed to update token');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Token copied to clipboard');
  };

  const closeCreatedTokenSheet = () => {
    setCreatedToken(null);
    setShowToken(false);
    setIsViewTokenOpen(false);
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">API Tokens</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage API tokens for integrations like Apple Shortcuts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/shortcuts">
            <Button variant="outline">
              <Smartphone className="w-4 h-4 mr-2" />
              Shortcuts Guide
            </Button>
          </Link>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Token
          </Button>
        </div>
      </div>

      {/* Create Token Sheet */}
      <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Create API Token</SheetTitle>
            <SheetDescription>
              Generate a new API token for accessing your weight data from external apps
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-6 mt-6">
            <div>
              <label htmlFor="token-name" className="text-sm font-medium mb-2 block">
                Token Name
              </label>
              <Input
                id="token-name"
                placeholder="e.g., Apple Shortcut, iOS Widget"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="expiration" className="text-sm font-medium mb-2 block">
                Expiration
              </label>
              <select
                id="expiration"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background"
              >
                <option value="never">Never expires</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
              </select>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={createToken} className="w-full">
              Generate Token
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* View Created Token Sheet */}
      {createdToken && (
        <Sheet open={isViewTokenOpen} onOpenChange={closeCreatedTokenSheet}>
          <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Token Created Successfully</SheetTitle>
              <SheetDescription>
                Copy your token now - you won&apos;t be able to see it again!
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-6 mt-6">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Make sure to copy your token now. For security reasons, you won&apos;t be able to see it again.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Token Name</label>
                <p className="text-sm font-medium bg-muted p-3 rounded">{createdToken.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">API Token</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Input
                      readOnly
                      type={showToken ? 'text' : 'password'}
                      value={createdToken.token}
                      className="pr-10 font-mono text-sm"
                    />
                    <button
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      type="button"
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(createdToken.token!)}
                    type="button"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <h4 className="font-semibold">Using this token:</h4>
                <p className="text-sm text-muted-foreground">
                  Include it in your API requests as a Bearer token:
                </p>
                <code className="text-xs bg-background p-3 rounded block overflow-x-auto">
                  Authorization: Bearer {createdToken.token}
                </code>
                <div className="pt-2">
                  <p className="text-sm font-medium mb-2">Example: Log weight from Apple Shortcut</p>
                  <code className="text-xs bg-background p-3 rounded block overflow-x-auto whitespace-pre">
{`curl -X POST \\
  '${typeof window !== 'undefined' ? window.location.origin : ''}/api/weight' \\
  -H 'Authorization: Bearer ${createdToken.token}' \\
  -H 'Content-Type: application/json' \\
  -d '{"weight": 180.5}'`}
                  </code>
                </div>
              </div>
            </div>
            <SheetFooter className="mt-6">
              <Button onClick={closeCreatedTokenSheet} className="w-full">
                I&apos;ve Saved My Token
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}

      {/* Tokens List */}
      {tokens.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Key className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No API tokens yet</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Create your first API token to start using integrations
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tokens.map((token) => (
            <Card key={token.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{token.name}</CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-1">
                      <span>Token: {token.token_preview}</span>
                      {token.is_active ? (
                        <span className="text-green-600">Active</span>
                      ) : (
                        <span className="text-red-600">Inactive</span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleTokenActive(token.id, token.is_active)}
                    >
                      {token.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => deleteToken(token.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {new Date(token.created).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Used</p>
                    <p className="font-medium">
                      {token.last_used_at
                        ? new Date(token.last_used_at).toLocaleDateString()
                        : 'Never'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Expires</p>
                    <p className="font-medium">
                      {token.expires_at
                        ? new Date(token.expires_at).toLocaleDateString()
                        : 'Never'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>API Documentation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Log Weight</h4>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <code className="text-xs block">POST /api/weight</code>
              <code className="text-xs block">Authorization: Bearer YOUR_TOKEN</code>
              <code className="text-xs block">Content-Type: application/json</code>
              <pre className="text-xs mt-2 bg-background p-2 rounded overflow-x-auto">
{`{
  "weight": 180.5,
  "date": "2024-10-10",
  "notes": "Morning weight"
}`}
              </pre>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Get Weight Entries</h4>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <code className="text-xs block">GET /api/weight?limit=30</code>
              <code className="text-xs block">Authorization: Bearer YOUR_TOKEN</code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
