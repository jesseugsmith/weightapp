import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function DebugAuth() {
  const { user } = useAuth()
  const [debug, setDebug] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchDebugInfo() {
      try {
        const response = await fetch('/api/debug-auth')
        const data = await response.json()
        setDebug(data)
      } catch (err) {
        setError('Failed to fetch debug info')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchDebugInfo()
    }
  }, [user])

  if (!user) return null

  if (loading) return <div>Loading debug info...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div className="p-4 bg-white shadow rounded">
      <h2 className="text-xl font-bold mb-4">Auth Debug Info</h2>
      
      <div className="mb-4">
        <h3 className="font-semibold">User Info:</h3>
        <pre className="bg-gray-100 p-2 rounded">
          {JSON.stringify({ id: user.id, email: user.email }, null, 2)}
        </pre>
      </div>

      <div className="mb-4">
        <h3 className="font-semibold">Admin Role:</h3>
        <pre className="bg-gray-100 p-2 rounded">
          {JSON.stringify(debug?.adminRole, null, 2)}
        </pre>
        {debug?.adminError && (
          <p className="text-red-500 mt-1">Error: {debug.adminError}</p>
        )}
      </div>

      <div className="mb-4">
        <h3 className="font-semibold">User Roles &amp; Permissions:</h3>
        <pre className="bg-gray-100 p-2 rounded">
          {JSON.stringify(debug?.userRoles, null, 2)}
        </pre>
        {debug?.rolesError && (
          <p className="text-red-500 mt-1">Error: {debug.rolesError}</p>
        )}
      </div>
    </div>
  )
}
