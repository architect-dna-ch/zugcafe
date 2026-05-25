'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { haversineKm, distLabel } from '@/lib/geo'
import Nav from '@/components/Nav'
import Link from 'next/link'

type Mood = 'game' | 'chat' | 'silent'
const MOODS: { id: Mood; label: string; icon: string; desc: string }[] = [
  { id: 'game', label: 'Game', icon: '🃏', desc: 'Up for UNO or cards' },
  { id: 'chat', label: 'Talk', icon: '💬', desc: 'Open for conversation' },
  { id: 'silent', label: 'Silent', icon: '🔇', desc: 'Just want company' },
]

interface Person {
  id: string
  user_id: string
  nickname: string
  lat: number
  lng: number
  mood: Mood
  last_seen: string
}

function getUserId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('zc_uid')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('zc_uid', id) }
  return id
}

function getNickname(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('zc_name') || ''
}

export default function Home() {
  const [nickname, setNickname] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [live, setLive] = useState(false)
  const [mood, setMood] = useState<Mood>('chat')
  const [nearby, setNearby] = useState<(Person & { dist: number })[]>([])
  const [myLat, setMyLat] = useState<number | null>(null)
  const [myLng, setMyLng] = useState<number | null>(null)
  const [locError, setLocError] = useState('')
  const [showSetup, setShowSetup] = useState(false)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const n = getNickname()
    if (n) setNickname(n)
    else setShowSetup(true)
  }, [])

  useEffect(() => {
    const ch = supabase
      .channel('presence-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'presence' }, fetchNearby)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [myLat, myLng])

  async function fetchNearby() {
    if (myLat === null) return
    const { data } = await supabase
      .from('presence')
      .select('*')
      .gte('last_seen', new Date(Date.now() - 20 * 60 * 1000).toISOString())
    if (!data) return
    const uid = getUserId()
    const enriched = (data as Person[])
      .filter(p => p.user_id !== uid)
      .map(p => ({ ...p, dist: haversineKm(myLat!, myLng!, p.lat, p.lng) }))
      .filter(p => p.dist < 2)
      .sort((a, b) => a.dist - b.dist)
    setNearby(enriched)
  }

  useEffect(() => { if (myLat !== null) fetchNearby() }, [myLat, myLng])

  async function goLive() {
    if (!nickname) { setShowSetup(true); return }
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lng } = pos.coords
      setMyLat(lat); setMyLng(lng)
      const uid = getUserId()
      await supabase.from('presence').upsert({
        user_id: uid, nickname, lat, lng, mood, last_seen: new Date().toISOString()
      }, { onConflict: 'user_id' })
      setLive(true)
      tickRef.current = setInterval(async () => {
        await supabase.from('presence').update({ last_seen: new Date().toISOString(), mood })
          .eq('user_id', uid)
      }, 30000)
    }, () => setLocError('Location needed to go live'))
  }

  async function goOffline() {
    const uid = getUserId()
    await supabase.from('presence').delete().eq('user_id', uid)
    setLive(false)
    if (tickRef.current) clearInterval(tickRef.current)
    setNearby([])
  }

  function saveName() {
    if (!nameInput.trim()) return
    const name = nameInput.trim()
    localStorage.setItem('zc_name', name)
    setNickname(name)
    setShowSetup(false)
  }

  async function createRoom(type: 'chat' | 'game', withUser?: string) {
    const uid = getUserId()
    const { data } = await supabase.from('rooms').insert({
      type, created_by: uid, name: withUser ? `${nickname} + ${withUser}` : nickname
    }).select().single()
    if (data) window.location.href = `/room/${data.id}`
  }

  return (
    <>
      <div className="page">
        {showSetup && (
          <div className="overlay">
            <div className="modal">
              <div className="modal-title">What should people call you?</div>
              <input
                placeholder="Your name or nickname"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                autoFocus
              />
              <div style={{ height: 12 }} />
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveName}>
                Done
              </button>
            </div>
          </div>
        )}

        <div className="top-bar">
          <div>
            <div className="page-title">Zugcafé</div>
            <div className="page-sub">Who&apos;s nearby right now?</div>
          </div>
          {nickname && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowSetup(true)}>
              {nickname}
            </button>
          )}
        </div>

        {!live ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 10 }}>
                I want to
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {MOODS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMood(m.id)}
                    style={{
                      flex: 1, padding: '12px 8px', borderRadius: 12,
                      background: mood === m.id ? 'var(--accent)' : 'var(--bg2)',
                      border: `1px solid ${mood === m.id ? 'var(--accent)' : 'var(--border)'}`,
                      color: mood === m.id ? '#0d0d0d' : 'var(--text2)',
                      fontWeight: 700, fontSize: 12, textAlign: 'center', lineHeight: 1.4
                    }}
                  >
                    <div style={{ fontSize: 22 }}>{m.icon}</div>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', height: 56, fontSize: 16, borderRadius: 14 }}
              onClick={goLive}
            >
              👁 I&apos;m here — show me nearby
            </button>
            {locError && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{locError}</div>}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div className="live-badge"><span className="live-dot" />Live</div>
              <button className="btn btn-ghost btn-sm" onClick={goOffline}>Go offline</button>
            </div>

            <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
              {MOODS.map(m => (
                <button
                  key={m.id}
                  onClick={async () => {
                    setMood(m.id)
                    await supabase.from('presence').update({ mood: m.id }).eq('user_id', getUserId())
                  }}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 10,
                    background: mood === m.id ? 'var(--accent)' : 'var(--bg2)',
                    border: `1px solid ${mood === m.id ? 'var(--accent)' : 'var(--border)'}`,
                    color: mood === m.id ? '#0d0d0d' : 'var(--text2)',
                    fontWeight: 700, fontSize: 11, textAlign: 'center'
                  }}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>

            {nearby.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">🚆</div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>No one nearby yet</div>
                <div style={{ fontSize: 13 }}>Share the link so others can join</div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 16 }}
                  onClick={() => navigator.share?.({ title: 'Zugcafé', url: window.location.href })}
                >
                  Share Zugcafé
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                  {nearby.length} {nearby.length === 1 ? 'person' : 'people'} nearby
                </div>
                {nearby.map(p => (
                  <div key={p.id} className="person-card">
                    <div className="avatar">{p.nickname[0].toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <div className="person-name">{p.nickname}</div>
                      <div className="person-meta">
                        <span className={`mood-${p.mood}`}>
                          {MOODS.find(m => m.id === p.mood)?.icon} {MOODS.find(m => m.id === p.mood)?.label}
                        </span>
                        &nbsp;·&nbsp;{distLabel(p.dist)}
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => createRoom(p.mood === 'game' ? 'game' : 'chat', p.nickname)}
                    >
                      {p.mood === 'game' ? '🃏 Game' : '💬 Chat'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 24 }}>
              <button
                className="btn btn-ghost"
                style={{ width: '100%' }}
                onClick={() => createRoom('game')}
              >
                🃏 Start open game room
              </button>
            </div>
          </>
        )}
      </div>
      <Nav active="home" />
    </>
  )
}
