"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase, type Event, type Judge } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, User, AlertCircle, Lock, Gavel } from "lucide-react"
import Link from "next/link"
import { isAdminLoggedIn } from "@/lib/auth"

export default function SelectJudgePage() {
  const params = useParams()
  const eventId = Number.parseInt(params.id as string)
  const categoryName = decodeURIComponent(params.category as string)
  const router = useRouter()

  const [event, setEvent] = useState<Event | null>(null)
  const [allJudges, setAllJudges] = useState<Judge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (eventId && !isNaN(eventId)) {
      fetchEventAndJudges()
    } else {
      setError("Invalid event ID.")
      setLoading(false)
    }
  }, [eventId])

  async function fetchEventAndJudges() {
    try {
      setLoading(true)
      setError(null)

      // Fetch event details
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("id, name, description, is_locked, locked_by, locked_at")
        .eq("id", eventId)
        .single()

      if (eventError) {
        throw new Error(`Event not found: ${eventError.message}`)
      }
      setEvent(eventData)

      // If event is locked and user is not a full admin, prevent selection
      if (eventData.is_locked && !isAdminLoggedIn()) {
        setError(
          `This event has been locked by administrator "${eventData.locked_by || "Unknown"}". You cannot select a judge.`,
        )
        setLoading(false)
        return
      }

      // Fetch all judges from the new 'judges' table
      const { data: judgesData, error: judgesError } = await supabase
        .from("judges")
        .select("id, name, username")
        .order("name")

      if (judgesError) {
        throw new Error(`Failed to load judges: ${judgesError.message}`)
      }
      setAllJudges(judgesData || [])
    } catch (error: any) {
      console.error("Error fetching data:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  function handleStartJudging(judgeId: number) {
    router.push(`/events/${eventId}/category/${encodeURIComponent(categoryName)}/${judgeId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-white text-xl font-bold">Loading judge selection...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-4">Access Restricted</h1>
          <p className="text-red-300 mb-6 text-lg leading-relaxed">{error}</p>
          <Link href={`/events/${eventId}`}>
            <Button className="bg-gradient-to-r from-pink-500 to-purple-500 w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Categories
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Event Not Found</h1>
          <Link href="/">
            <Button className="bg-gradient-to-r from-pink-500 to-purple-500">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Events
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 w-full">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/20 w-full">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link href={`/events/${eventId}`}>
              <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Categories
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold text-white">{event.name}</h1>
                {event.is_locked && (
                  <div className="flex items-center gap-1">
                    <Lock className="w-5 h-5 text-red-400" title="Event is locked" />
                    <span className="text-red-400 text-sm font-bold">LOCKED</span>
                  </div>
                )}
              </div>
              <p className="text-white/70 text-sm md:text-base">Category: {categoryName}</p>
              {event.is_locked && event.locked_by && (
                <p className="text-red-300 text-xs mt-1">
                  🔒 Locked by: {event.locked_by} • {event.locked_at ? new Date(event.locked_at).toLocaleString() : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 w-full">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Select Your Judge Profile</h2>
          <p className="text-white/70 text-lg">
            Choose your judge profile to start marking for{" "}
            <span className="font-bold text-pink-300">{categoryName}</span>.
          </p>
        </div>

        {allJudges.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">👤</div>
            <h3 className="text-2xl font-bold text-white mb-2">No Judges Found</h3>
            <p className="text-white/70">Please add judges to the 'judges' table in Supabase.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allJudges.map((judge) => (
              <Card
                key={judge.id}
                className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/15 transition-all duration-300 group overflow-hidden"
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <div className="bg-gradient-to-r from-pink-500 to-purple-500 rounded-full p-2">
                      <User className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-xl font-bold text-white group-hover:text-pink-300 transition-colors">
                    {judge.name}
                  </CardTitle>
                  {judge.username && <p className="text-white/70 text-sm">Username: {judge.username}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={() => handleStartJudging(judge.id)}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-3 text-lg transition-all duration-300 transform hover:scale-105"
                    disabled={event.is_locked}
                  >
                    <Gavel className="w-5 h-5 mr-2" />
                    Start Judging
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {event.is_locked && (
          <div className="text-center mt-8">
            <p className="text-red-300 text-sm">This event is locked. You cannot start judging until it's unlocked.</p>
          </div>
        )}
      </main>
    </div>
  )
}
