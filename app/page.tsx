"use client"

import { useEffect, useState } from "react"
import { supabase, type Event } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Trophy, Users, Zap, Shield, LogOut, BarChart3 } from "lucide-react"
import Link from "next/link"
import { isAdminLoggedIn, logoutAdmin, getAdminUser, getAccessibleEvents } from "@/lib/auth"

export default function HomePage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminUser, setAdminUser] = useState<any>(null)

  useEffect(() => {
    const admin = isAdminLoggedIn()
    setIsAdmin(admin)
    if (admin) {
      setAdminUser(getAdminUser())
    }
    fetchEvents()
  }, [])

  async function fetchEvents() {
    try {
      const accessibleEvents = getAccessibleEvents()
      let query = supabase.from("events").select("*").eq("is_active", true).order("id", { ascending: true })

      // If not god admin, filter by accessible events
      if (accessibleEvents.length > 0) {
        query = query.in(
          "id",
          accessibleEvents.map((id) => Number.parseInt(id)),
        )
      }

      const { data, error } = await query
      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error("Error fetching events:", error)
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    logoutAdmin()
    setIsAdmin(false)
    setAdminUser(null)
    alert("Logged out successfully!")
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
          {/* Admin Controls */}
          {isAdmin && (
            <div className="absolute top-4 right-4 flex gap-2">
              {adminUser?.is_god_admin && (
                <Link href="/marks">
                  <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold text-sm px-4 py-2">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    View All Marks
                  </Button>
                </Link>
              )}
              <Button
                onClick={handleLogout}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold text-sm px-4 py-2"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          )}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-6 py-2 mb-6">
            <Zap className="w-5 h-5 text-yellow-400" />
            <span className="text-white font-semibold">Judge Mode: ON</span>
            {isAdmin && (
              <>
                <Shield className="w-4 h-4 text-green-400 ml-2" />
                <span className="text-green-400 font-semibold text-sm">
                  {adminUser?.is_god_admin ? "God Admin" : "Event Admin"}
                </span>
              </>
            )}
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
          <h2 className="text-4xl font-bold text-white mb-4">
            {isAdmin && !adminUser?.is_god_admin ? "Your Events" : "Active Events"}
          </h2>
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
              <CardContent className="space-y-3">
                <Link href={`/events/${event.id}`}>
                  <Button className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-bold py-3 text-lg transition-all duration-300 transform hover:scale-105">
                    Start Judging 🚀
                  </Button>
                </Link>
                {isAdmin && (
                  <Link href={`/marks/${event.id}`}>
                    <Button className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold py-2 text-sm">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      View Results
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        {events.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">😴</div>
            <h3 className="text-2xl font-bold text-white mb-2">No Active Events</h3>
            <p className="text-white/70">
              {isAdmin && !adminUser?.is_god_admin
                ? "No events assigned to your account."
                : "Check back later for more epic competitions!"}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
