"use client"

import { useEffect, useState } from "react"
import { supabase, type Event } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Trophy, Users, Zap } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvents()
  }, [])

  async function fetchEvents() {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("is_active", true)
        .order("date", { ascending: true })

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error("Error fetching events:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-white text-xl font-bold">Loading the vibes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 to-cyan-500/20"></div>
        <div className="relative container mx-auto px-4 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-6 py-2 mb-6">
            <Zap className="w-5 h-5 text-yellow-400" />
            <span className="text-white font-semibold">Judge Mode: ON</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-black bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent mb-6">
            JUDGE IT
          </h1>
          <p className="text-xl md:text-2xl text-white/80 max-w-2xl mx-auto mb-8 font-medium">
            Rate the talent, crown the legends. Your scores decide who's absolutely iconic! ✨
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <span className="text-white font-semibold">Real-time Rankings</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
              <Users className="w-5 h-5 text-green-400" />
              <span className="text-white font-semibold">Team & Solo Modes</span>
            </div>
          </div>
        </div>
      </header>

      {/* Events Grid */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Active Events</h2>
          <p className="text-white/70 text-lg">Choose your battlefield and start judging! 🔥</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map((event) => (
            <Card
              key={event.id}
              className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/15 transition-all duration-300 group overflow-hidden"
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="bg-gradient-to-r from-pink-500 to-purple-500 rounded-full p-2">
                    <Trophy className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex items-center gap-1 text-white/60">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">{new Date(event.date).toLocaleDateString("en-GB")}</span>
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold text-white group-hover:text-pink-300 transition-colors">
                  {event.name}
                </CardTitle>
                <CardDescription className="text-white/70 text-base">{event.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={`/events/${event.id}`}>
                  <Button className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-bold py-3 text-lg transition-all duration-300 transform hover:scale-105">
                    Start Judging 🚀
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {events.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">😴</div>
            <h3 className="text-2xl font-bold text-white mb-2">No Active Events</h3>
            <p className="text-white/70">Check back later for more epic competitions!</p>
          </div>
        )}
      </main>
    </div>
  )
}
