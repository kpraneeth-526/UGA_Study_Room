import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export default function App() {
  const [rooms, setRooms] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.from('rooms').select('*').then(({ data, error }) => {
      if (error) setError(error.message)
      else setRooms(data || [])
    })
  }, [])

  return (
    <div>
      <h1>Study Rooms</h1>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {rooms.length === 0 && !error && <p>No rooms found</p>}
      {rooms.map(r => (
        <p key={r.id}>{r.name} (fits {r.capacity})</p>
      ))}
    </div>
  )
}