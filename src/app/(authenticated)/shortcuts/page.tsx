import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Smartphone, Copy } from 'lucide-react';
import Link from 'next/link';

export default function AppleShortcutGuide() {
  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Apple Shortcuts Integration</h1>
        <p className="text-muted-foreground">
          Log your weight quickly from your iPhone using Apple Shortcuts
        </p>
      </div>

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            <CardTitle>Quick Start</CardTitle>
          </div>
          <CardDescription>Get set up in 3 easy steps</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
                1
              </div>
              <div>
                <h3 className="font-semibold">Create an API Token</h3>
                <p className="text-sm text-muted-foreground">
                  Go to <Link href="/api-tokens" className="text-primary underline">API Tokens</Link> and create a new token for your shortcut
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
                2
              </div>
              <div>
                <h3 className="font-semibold">Create the Shortcut</h3>
                <p className="text-sm text-muted-foreground">
                  Follow the instructions below to create your shortcut in the Shortcuts app
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
                3
              </div>
              <div>
                <h3 className="font-semibold">Start Logging</h3>
                <p className="text-sm text-muted-foreground">
                  Use your shortcut to log weight in seconds, or ask Siri!
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shortcut Setup */}
      <Card>
        <CardHeader>
          <CardTitle>Setting Up the Shortcut</CardTitle>
          <CardDescription>Manual setup instructions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-3">Actions to Add:</h3>
            
            <div className="space-y-4">
              {/* Action 1 */}
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Action 1: Ask for Input</h4>
                  <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                    Input
                  </span>
                </div>
                <div className="text-sm space-y-1">
                  <p><span className="font-medium">Prompt:</span> &quot;What&apos;s your weight?&quot;</p>
                  <p><span className="font-medium">Input Type:</span> Number</p>
                </div>
              </div>

              {/* Action 2 */}
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Action 2: Get Contents of URL</h4>
                  <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                    Network
                  </span>
                </div>
                <div className="text-sm space-y-2">
                  <div>
                    <p className="font-medium mb-1">URL:</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded block">
                      {typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/weight
                    </code>
                  </div>
                  <p><span className="font-medium">Method:</span> POST</p>
                  
                  <div>
                    <p className="font-medium mb-1">Headers:</p>
                    <div className="bg-muted p-2 rounded space-y-1">
                      <code className="text-xs block">Authorization: Bearer YOUR_TOKEN_HERE</code>
                      <code className="text-xs block">Content-Type: application/json</code>
                    </div>
                  </div>

                  <div>
                    <p className="font-medium mb-1">Request Body (JSON):</p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
{`{
  "weight": [Provided Input]
}`}
                    </pre>
                    <p className="text-xs text-muted-foreground mt-1">
                      Note: [Provided Input] is a variable from Action 1
                    </p>
                  </div>
                </div>
              </div>

              {/* Action 3 */}
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Action 3: Show Notification</h4>
                  <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-1 rounded">
                    Optional
                  </span>
                </div>
                <div className="text-sm space-y-1">
                  <p><span className="font-medium">Text:</span> &quot;Weight logged: [Provided Input] lbs&quot;</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Siri Integration */}
      <Card>
        <CardHeader>
          <CardTitle>Enable Siri</CardTitle>
          <CardDescription>Log your weight hands-free</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="space-y-2 text-sm">
            <li>1. Open your shortcut in the Shortcuts app</li>
            <li>2. Tap the (i) info icon</li>
            <li>3. Toggle &quot;Add to Siri&quot; on</li>
            <li>4. Record a phrase like &quot;Log my weight&quot;</li>
          </ol>
          <p className="text-sm text-muted-foreground">
            Now you can say: &quot;Hey Siri, log my weight&quot; and Siri will prompt you for your weight!
          </p>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Pro Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2 text-sm list-disc list-inside">
            <li>Add the shortcut to your home screen for quick access</li>
            <li>Create an automation to remind you to log weight every morning</li>
            <li>Use different tokens for different devices (iPhone, iPad, etc.)</li>
            <li>Deactivate tokens when not in use for security</li>
          </ul>
        </CardContent>
      </Card>

      {/* Help */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Having trouble setting up your shortcut? Here are some common issues:
          </p>
          <ul className="space-y-2 text-sm list-disc list-inside">
            <li>Make sure you copied the entire API token</li>
            <li>Verify the token is active in API Tokens page</li>
            <li>Check that you&apos;re using POST method in the shortcut</li>
            <li>Ensure the Authorization header starts with &quot;Bearer &quot;</li>
          </ul>
          <div className="pt-2">
            <Link href="/api-tokens">
              <Button variant="outline">
                Manage API Tokens
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
