"use client"

import { useEffect, useState } from "react"
import { supabase, type Event, type Participant } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Trophy, Medal, BarChart3, Eye } from 'lucide-react'
import Link from "next/link"
import { isAdminLoggedIn, getAdminUser, getAccessibleEvents } from "@/lib/auth"
import { useRouter } from "next/navigation"

type ParticipantWithMarks = Participant & {
  total_marks: number
  rank: number
  marks_by_criteria: Record<number, number>
}

type CategoryResults = {
  category: string
  participants: ParticipantWithMarks[]
}

type EventWithCategories = Event & {
  categories: CategoryResults[]
}

// Helper function to extract class level and category type
function parseCategoryName(categoryName: string) {
  const lowerCategory = categoryName.toLowerCase()
  
  let classLevel = 4 // Default for unknown
  if (lowerCategory.includes('junior')) classLevel = 1
  else if (lowerCategory.includes('intermediate')) classLevel = 2
  else if (lowerCategory.includes('senior')) classLevel = 3
  
  // Extract the main category type (remove class level words)
  let categoryType = categoryName
    .replace(/junior\s*/gi, '')
    .replace(/intermediate\s*/gi, '')
    .replace(/senior\s*/gi, '')
    .trim()
  
  // If no category type remains, use the original
  if (!categoryType) {
    categoryType = categoryName
  }
  
  return { classLevel, categoryType, originalName: categoryName }
}

// Helper function to sort categories properly
function sortCategories(categories: CategoryResults[]): CategoryResults[] {
  return categories.sort((a, b) => {
    const parsedA = parseCategoryName(a.category)
    const parsedB = parseCategoryName(b.category)
    
    // First sort by category type (Dance, Art, Athletics, etc.)
    const categoryTypeComparison = parsedA.categoryType.localeCompare(parsedB.categoryType)
    if (categoryTypeComparison !== 0) {
      return categoryTypeComparison
    }
    
    // Then sort by class level (Junior=1, Intermediate=2, Senior=3)
    return parsedA.classLevel - parsedB.classLevel
  })
}

export default function MarksPage() {
  const [events, setEvents] = useState<EventWithCategories[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Check if admin is logged in
    if (!isAdminLoggedIn()) {
      router.push("/admin/login")
      return
    }

    const adminUser = getAdminUser()
    // If event-specific admin with single event, redirect to that event
    if (adminUser && !adminUser.is_god_admin && adminUser.event_access?.length === 1) {
      router.push(`/marks/${adminUser.event_access[0]}`)
      return
    }

    fetchEventsWithCategories()
  }, [router])

  async function fetchEventsWithCategories() {
    try {
      setLoading(true)
      setError(null)
      const accessibleEvents = getAccessibleEvents()
      let query = supabase.from("events").select("*").eq("is_active", true).order("id", { ascending: true })

      // If not god admin, filter by accessible events
      if (accessibleEvents.length > 0) {
        query = query.in(
          "id",
          accessibleEvents.map((id) => Number.parseInt(id)),
        )
      }

      const { data: eventsData, error: eventsError } = await query
      if (eventsError) throw eventsError

      const eventsWithCategories: EventWithCategories[] = []

      for (const event of eventsData || []) {
        // Fetch criteria for this event
        const { data: criteriaData, error: criteriaError } = await supabase
          .from("judgment_criteria")
          .select("*")
          .eq("event_id", event.id)
          .order("id")
        if (criteriaError) throw criteriaError

        // Fetch participants for this event
        const { data: participantsData, error: participantsError } = await supabase
          .from("participants")
          .select("*")
          .eq("event_id", event.id)
          .order("category, name")
        if (participantsError) throw participantsError

        // Fetch marks for this event
        const { data: marksData, error: marksError } = await supabase.from("marks").select("*").eq("event_id", event.id)
        if (marksError) throw marksError

        // Group participants by category and calculate marks
        const categoriesMap: Record<string, ParticipantWithMarks[]> = {}
        ;(participantsData || []).forEach((participant) => {
          const category = participant.category || "General Category"
          if (!categoriesMap[category]) {
            categoriesMap[category] = []
          }

          const marks_by_criteria: Record<number, number> = {}
          let total_marks = 0

          // Calculate marks for each criteria across all rounds
          ;(criteriaData || []).forEach((criteria) => {
            let criteriaTotal = 0
            for (let round = 1; round <= event.rounds; round++) {
              const mark = marksData?.find(
                (m) => m.participant_id === participant.id && m.criteria_id === criteria.id && m.round_number === round,
              )
              criteriaTotal += mark?.marks_obtained || 0
            }
            marks_by_criteria[criteria.id] = criteriaTotal
            total_marks += criteriaTotal
          })

          categoriesMap[category].push({
            ...participant,
            total_marks,
            rank: 0, // Will be set after sorting
            marks_by_criteria,
          })
        })

        // Sort each category and assign ranks
        let categories: CategoryResults[] = Object.entries(categoriesMap).map(([category, participants]) => {
          participants.sort((a, b) => b.total_marks - a.total_marks)
          participants.forEach((participant, index) => {
            participant.rank = index + 1
          })
          return {
            category,
            participants,
          }
        })

        // Sort categories using the new sorting function
        categories = sortCategories(categories)

        eventsWithCategories.push({
          ...event,
          categories,
        })
      }

      setEvents(eventsWithCategories)
    } catch (error: any) {
      console.error("Error fetching marks:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-white text-xl font-bold">Loading marks data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Error Loading Marks</h1>
          <p className="text-red-300 mb-4">{error}</p>
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-8 h-8 text-cyan-400" />
                Event Results Overview
              </h1>
              <p className="text-white/70">Top 3 performers across all events and categories</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {events.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-2xl font-bold text-white mb-2">No Events Found</h3>
            <p className="text-white/70">No active events with marks data available.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {events.map((event) => (
              <Card key={event.id} className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-yellow-400" />
                        {event.name}
                      </CardTitle>
                      <div className="flex flex-wrap gap-2 text-sm text-white/70 mt-2">
                        <span>📅 {new Date(event.date).toLocaleDateString("en-GB")}</span>
                        <span>
                          🎯 {event.rounds} Round{event.rounds > 1 ? "s" : ""}
                        </span>
                        <span>📂 {event.categories.length} Categories</span>
                      </div>
                    </div>
                    <Link href={`/marks/${event.id}`}>
                      <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold">
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {event.categories.map((categoryResult) => (
                      <div key={categoryResult.category}>
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                          <Medal className="w-5 h-5 text-yellow-400" />
                          {categoryResult.category} - Top 3
                        </h3>
                        {categoryResult.participants.length === 0 ? (
                          <p className="text-white/70 text-center py-4">No participants in this category</p>
                        ) : (
                          <div className="grid md:grid-cols-3 gap-4">
                            {categoryResult.participants.slice(0, 3).map((participant, index) => (
                              <Card
                                key={participant.id}
                                className={`${
                                  index === 0
                                    ? "bg-gradient-to-r from-yellow-700/60 to-orange-700/60 border-yellow-500/60"
                                    : index === 1
                                      ? "bg-gradient-to-r from-gray-600/60 to-gray-700/60 border-gray-400/60"
                                      : "bg-gradient-to-r from-amber-800/60 to-amber-900/60 border-amber-600/60"
                                }`}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-center gap-3 mb-3">
                                    <div
                                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                                        index === 0
                                          ? "bg-yellow-500 text-black"
                                          : index === 1
                                            ? "bg-gray-400 text-black"
                                            : "bg-amber-600 text-white"
                                      }`}
                                    >
                                      {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                                    </div>
                                    <div className="flex-1">
                                      <div className="text-white font-bold">{participant.name}</div>
                                      <div className="text-white/70 text-sm">{participant.class}</div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-2xl font-bold text-white">{participant.total_marks}</div>
                                      <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                                        {participant.school_code}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="text-xs text-white/60">Scholar: {participant.scholar_number}</div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
