"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase, type Event, type Participant } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Trophy, Users, Target, AlertCircle, Lock, Shield } from "lucide-react"
import Link from "next/link"
import { isAdminLoggedIn } from "@/lib/auth"

type CategoryInfo = {
  name: string
  participantCount: number
  teamCount: number
}

// Helper function to extract class level and category type
function parseCategoryName(categoryName: string) {
  const lowerCategory = categoryName.toLowerCase()

  let classLevel = 4 // Default for unknown
  if (lowerCategory.includes("junior")) classLevel = 1
  else if (lowerCategory.includes("intermediate")) classLevel = 2
  else if (lowerCategory.includes("senior")) classLevel = 3

  // Extract the main category type (remove class level words)
  let categoryType = categoryName
    .replace(/junior\s*/gi, "")
    .replace(/intermediate\s*/gi, "")
    .replace(/senior\s*/gi, "")
    .trim()

  // If no category type remains, use the original
  if (!categoryType) {
    categoryType = categoryName
  }

  return { classLevel, categoryType, originalName: categoryName }
}

// Helper function to sort categories properly
function sortCategories(categories: CategoryInfo[]): CategoryInfo[] {
  return categories.sort((a, b) => {
    const parsedA = parseCategoryName(a.name)
    const parsedB = parseCategoryName(b.name)

    // First sort by category type (Dance, Art, Athletics, etc.)
    const categoryTypeComparison = parsedA.categoryType.localeCompare(parsedB.categoryType)
    if (categoryTypeComparison !== 0) {
      return categoryTypeComparison
    }

    // Then sort by class level (Junior=1, Intermediate=2, Senior=3)
    return parsedA.classLevel - parsedB.classLevel
  })
}

export default function EventCategoriesPage() {
  const params = useParams()
  const eventId = Number.parseInt(params.id as string)

  const [event, setEvent] = useState<Event | null>(null)
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const adminStatus = isAdminLoggedIn()
    console.log("🔍 Admin status check:", adminStatus)
    setIsAdmin(adminStatus)

    if (eventId && !isNaN(eventId)) {
      fetchEventData()
    } else {
      setError("Invalid event ID")
      setLoading(false)
    }
  }, [eventId])

  async function fetchEventData() {
    try {
      setLoading(true)
      setError(null)

      console.log("🔍 Fetching data for event ID:", eventId)

      // Fetch event details
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("id, name, description, date, is_active, rounds, is_locked, locked_by, locked_at")
        .eq("id", eventId)
        .single()

      if (eventError) {
        console.error("❌ Event error:", eventError)
        throw new Error(`Event not found: ${eventError.message}`)
      }

      console.log("✅ Event loaded:", eventData)
      setEvent(eventData)

      // Check if event is locked and user is not admin
      const currentAdminStatus = isAdminLoggedIn()
      if (eventData.is_locked && !currentAdminStatus) {
        console.log("🚫 Access blocked - event is locked and user is not admin")
        setError(
          `This event has been locked by administrator "${eventData.locked_by || "Unknown"}". Please contact the administrator for access.`,
        )
        setLoading(false)
        return
      }

      // Fetch participants to get categories
      const { data: participantsData, error: participantsError } = await supabase
        .from("participants")
        .select("*")
        .eq("event_id", eventId)

      if (participantsError) {
        console.error("❌ Participants error:", participantsError)
        throw new Error(`Participants loading failed: ${participantsError.message}`)
      }

      console.log("✅ Participants loaded:", participantsData)

      // Group participants by category
      const categoryMap: Record<string, Participant[]> = {}
      participantsData?.forEach((participant) => {
        const category = participant.category || "General Category"
        if (!categoryMap[category]) {
          categoryMap[category] = []
        }
        categoryMap[category].push(participant)
      })

      // Create category info
      let categoryInfos: CategoryInfo[] = Object.entries(categoryMap).map(([categoryName, participants]) => {
        const uniqueTeams = new Set(participants.map((p) => p.team_id))
        return {
          name: categoryName,
          participantCount: participants.length,
          teamCount: uniqueTeams.size,
        }
      })

      // Sort categories using the new sorting function
      categoryInfos = sortCategories(categoryInfos)

      console.log("✅ Categories processed and sorted:", categoryInfos)
      setCategories(categoryInfos)
    } catch (error: any) {
      console.error("💥 Fatal error:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-white text-xl font-bold">Loading event categories...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-4">
            {error.includes("locked") ? "🔒 Event Locked" : "Access Restricted"}
          </h1>
          <p className="text-red-300 mb-6 text-lg leading-relaxed">{error}</p>
          <div className="space-y-3">
            <Link href="/">
              <Button className="bg-gradient-to-r from-pink-500 to-purple-500 w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Events
              </Button>
            </Link>
            {!isAdmin && (
              <Link href="/admin/login">
                <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 w-full">
                  <Shield className="w-4 h-4 mr-2" />
                  Admin Login
                </Button>
              </Link>
            )}
          </div>
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Events
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
                <p className="text-white/70 text-sm md:text-base">{event.description}</p>
                {event.is_locked && event.locked_by && (
                  <p className="text-red-300 text-xs mt-1">
                    🔒 Locked by: {event.locked_by} •{" "}
                    {event.locked_at ? new Date(event.locked_at).toLocaleString() : ""}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-4">
              <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-3 py-1 md:px-4 md:py-2 text-xs md:text-sm">
                <Target className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                {event.rounds || 1} Round{(event.rounds || 1) > 1 ? "s" : ""}
              </Badge>
              <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 md:px-4 md:py-2 text-xs md:text-sm">
                <Users className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                {categories.length} Categories
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Select Category to Judge</h2>
          <p className="text-white/70 text-lg">Choose a category to start judging participants 🎯</p>
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📂</div>
            <h3 className="text-2xl font-bold text-white mb-2">No Categories Found</h3>
            <p className="text-white/70">No participants have been registered for this event yet.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => (
              <Card
                key={category.name}
                className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/15 transition-all duration-300 group overflow-hidden"
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <div className="bg-gradient-to-r from-pink-500 to-purple-500 rounded-full p-2">
                      <Trophy className="w-6 h-6 text-white" />
                    </div>
                    <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                      {category.teamCount} Teams
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-bold text-white group-hover:text-pink-300 transition-colors">
                    {category.name}
                  </CardTitle>
                  <div className="flex items-center gap-4 text-sm text-white/70">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{category.participantCount} Participants</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Link href={`/events/${eventId}/category/${encodeURIComponent(category.name)}/select-judge`}>
                    <Button className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-bold py-3 text-lg transition-all duration-300 transform hover:scale-105">
                      Judge Category 🚀
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        {isAdmin && (
          <div className="mt-12 text-center">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Admin Actions</h3>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href={`/marks/${eventId}`}>
                  <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold">
                    <Trophy className="w-4 h-4 mr-2" />
                    View Results
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
