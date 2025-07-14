"use client"

import { useEffect, useState } from "react"
import { supabase, type Event, type Participant } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Trophy, Medal, BarChart3, Eye } from "lucide-react"
import Link from "next/link"
import { isAdminLoggedIn, getAdminUser, getAccessibleEvents } from "@/lib/auth"
import { useRouter } from "next/navigation"

type TeamWithMarks = {
  team_name: string
  school_code: string
  total_marks: number
  rank: number
  marks_by_criteria: Record<number, number>
  participants: string[] // Array of participant names
}

type CategoryResults = {
  category: string
  teams: TeamWithMarks[]
}

type EventWithCategories = Event & {
  categories: CategoryResults[]
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
          .order("category, team_id, name")
        if (participantsError) throw participantsError

        // Fetch marks for this event
        const { data: marksData, error: marksError } = await supabase.from("marks").select("*").eq("event_id", event.id)
        if (marksError) throw marksError

        // Group participants by category and then by team
        const categoriesMap: Record<string, Record<string, TeamWithMarks>> = {}
        
        ;(participantsData || []).forEach((participant) => {
          const category = participant.category || "General Category"
          const teamId = participant.team_id
          const teamName = teamId || "Individual"
          
          if (!categoriesMap[category]) {
            categoriesMap[category] = {}
          }
          
          if (!categoriesMap[category][teamName]) {
            categoriesMap[category][teamName] = {
              team_name: teamName,
              school_code: participant.school_code,
              total_marks: 0,
              rank: 0,
              marks_by_criteria: {},
              participants: []
            }
          }

          // Add participant name to team
          categoriesMap[category][teamName].participants.push(participant.name)

          // Calculate marks for this participant from ALL judges and add to team total
          const marks_by_criteria: Record<number, number> = {}
          let participant_total_marks = 0

          ;(criteriaData || []).forEach((criteria) => {
            let criteriaTotal = 0
            for (let round = 1; round <= event.rounds; round++) {
              // Get ALL marks for this participant, criteria, and round from ALL judges
              const allMarksForCriteria = marksData?.filter(
                (m) => m.participant_id === participant.id && m.criteria_id === criteria.id && m.round_number === round,
              ) || []
              
              // Sum up marks from all judges for this criteria and round
              const roundTotal = allMarksForCriteria.reduce((sum, mark) => sum + (mark.marks_obtained || 0), 0)
              criteriaTotal += roundTotal
            }
            marks_by_criteria[criteria.id] = criteriaTotal
            participant_total_marks += criteriaTotal
          })

          // Add participant's marks to team total
          ;(criteriaData || []).forEach((criteria) => {
            if (!categoriesMap[category][teamName].marks_by_criteria[criteria.id]) {
              categoriesMap[category][teamName].marks_by_criteria[criteria.id] = 0
            }
            categoriesMap[category][teamName].marks_by_criteria[criteria.id] += marks_by_criteria[criteria.id]
          })
          
          categoriesMap[category][teamName].total_marks += participant_total_marks
        })

        // Convert to array format and sort teams within each category
        let categories: CategoryResults[] = Object.entries(categoriesMap).map(([category, teamsMap]) => {
          const teams = Object.values(teamsMap)
          teams.sort((a, b) => b.total_marks - a.total_marks)
          teams.forEach((team, index) => {
            team.rank = index + 1
          })
          return {
            category,
            teams,
          }
        })

        // Sort categories using the existing sorting function
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
              <p className="text-white/70">Top 3 team performers across all events and categories</p>
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
                          {categoryResult.category} - Top 3 Teams
                        </h3>
                        {categoryResult.teams.length === 0 ? (
                          <p className="text-white/70 text-center py-4">No teams in this category</p>
                        ) : (
                          <div className="grid md:grid-cols-3 gap-4">
                            {categoryResult.teams.slice(0, 3).map((team, index) => (
                              <Card
                                key={`${categoryResult.category}-${team.team_name}`}
                                className={`${
                                  index === 0
                                    ? "bg-gradient-to-r from-yellow-700/60 to-orange-700/60 border-yellow-500/60"
                                    : index === 1
                                      ? "bg-gradient-to-r from-gray-600/60 to-gray-700/60 border-gray-400/60"
                                      : "bg-gradient-to-r from-amber-800/60 to-amber-900/60 border-amber-600/60"
                                }`}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-3 mb-3">
                                    <div
                                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
                                        index === 0
                                          ? "bg-yellow-500 text-black"
                                          : index === 1
                                            ? "bg-gray-400 text-black"
                                            : "bg-amber-600 text-white"
                                      }`}
                                    >
                                      {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="space-y-1">
                                        {team.participants.map((participant, idx) => (
                                          <div key={idx} className="text-white font-bold text-sm">
                                            {participant}
                                          </div>
                                        ))}
                                      </div>

                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <div className="text-2xl font-bold text-white">{team.total_marks}</div>
                                      <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                                        {team.school_code}
                                      </Badge>
                                    </div>
                                  </div>
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
