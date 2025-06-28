"use client"

import { useEffect, useState } from "react"
import { supabase, type Event, type Participant } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Trophy, Medal, BarChart3, Eye, Users, User } from "lucide-react"
import Link from "next/link"
import { isAdminLoggedIn, getAdminUser, getAccessibleEvents } from "@/lib/auth"
import { useRouter } from "next/navigation"

type ParticipantWithMarks = Participant & {
  total_marks: number
  rank: number
  marks_by_criteria: Record<number, number>
}

type TeamGroup = {
  team_code: string
  participants: ParticipantWithMarks[]
  total_marks: number
  rank: number
  is_team_marked: boolean // New field to track marking method
}

type CategoryResults = {
  category: string
  participants: ParticipantWithMarks[]
  teamGroups: TeamGroup[]
  is_individual_marking: boolean // New field to track category marking method
}

type EventWithCategories = Event & {
  categories: CategoryResults[]
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

  // Function to determine if marking is individual or team-based from participants data
  const determineMarkingMethod = (participantsData: any[]) => {
    // Check if any participant has solo_marking set to true
    return participantsData.some(participant => participant.solo_marking === true)
  }

  async function fetchEventsWithCategories() {
    try {
      setLoading(true)
      setError(null)

      const accessibleEvents = getAccessibleEvents()

      let query = supabase.from("events").select("*").eq("is_active", true).order("date", { ascending: true })

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
          .select("*, solo_marking")
          .eq("event_id", event.id)
          .order("category, name")

        if (participantsError) throw participantsError

        // Fetch marks for this event
        const { data: marksData, error: marksError } = await supabase.from("marks").select("*").eq("event_id", event.id)

        if (marksError) throw marksError

        // Determine marking method for this event
        const isIndividualMarking = determineMarkingMethod(participantsData || [])

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
            rank: 0, // Will be set after team grouping and sorting
            marks_by_criteria,
          })
        })

        // Group participants by team code within each category and assign ranks
        const categories: CategoryResults[] = Object.entries(categoriesMap).map(([category, participants]) => {
          // Group participants by team code (school_code)
          const teamGroups: Record<string, ParticipantWithMarks[]> = {}
          
          participants.forEach((participant) => {
            const teamCode = participant.school_code || 'No Team'
            if (!teamGroups[teamCode]) {
              teamGroups[teamCode] = []
            }
            teamGroups[teamCode].push(participant)
          })

          // Create team group objects with combined marks
          const teamGroupArray: TeamGroup[] = Object.entries(teamGroups).map(([team_code, teamParticipants]) => {
            // Calculate team total marks (sum of all participants in the team)
            const team_total_marks = teamParticipants.reduce((sum, p) => sum + p.total_marks, 0)
            
            return {
              team_code,
              participants: teamParticipants,
              total_marks: team_total_marks,
              rank: 0, // Will be set after sorting
              is_team_marked: !isIndividualMarking
            }
          })

          // Sort teams by total marks
          teamGroupArray.sort((a, b) => b.total_marks - a.total_marks)

          // Assign ranks to teams and their participants
          let currentRank = 1
          teamGroupArray.forEach((teamGroup, index) => {
            // Handle ties - if same total marks as previous team, use same rank
            if (index > 0 && teamGroup.total_marks === teamGroupArray[index - 1].total_marks) {
              teamGroup.rank = teamGroupArray[index - 1].rank
            } else {
              teamGroup.rank = currentRank
            }
            
            // Assign the same rank to all participants in the team
            teamGroup.participants.forEach((participant) => {
              participant.rank = teamGroup.rank
            })

            // Update current rank for next team (accounting for team size)
            if (index === teamGroupArray.length - 1 || teamGroup.total_marks !== teamGroupArray[index + 1]?.total_marks) {
              currentRank += teamGroup.participants.length
            }
          })

          // Flatten participants for backward compatibility
          const rankedParticipants = teamGroupArray.flatMap(team => team.participants)

          return {
            category,
            participants: rankedParticipants,
            teamGroups: teamGroupArray,
            is_individual_marking: isIndividualMarking,
          }
        })

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

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return "🥇"
      case 1: return "🥈"
      case 2: return "🥉"
      default: return `#${index + 1}`
    }
  }

  const getRankColors = (index: number) => {
    switch (index) {
      case 0:
        return {
          bg: "bg-gradient-to-r from-yellow-700/60 to-orange-700/60 border-yellow-500/60",
          iconBg: "bg-yellow-500 text-black",
          glow: "shadow-lg shadow-yellow-500/20"
        }
      case 1:
        return {
          bg: "bg-gradient-to-r from-gray-600/60 to-gray-700/60 border-gray-400/60",
          iconBg: "bg-gray-400 text-black",
          glow: "shadow-lg shadow-gray-400/20"
        }
      case 2:
        return {
          bg: "bg-gradient-to-r from-amber-800/60 to-amber-900/60 border-amber-600/60",
          iconBg: "bg-amber-600 text-white",
          glow: "shadow-lg shadow-amber-600/20"
        }
      default:
        return {
          bg: "bg-white/10 border-white/20",
          iconBg: "bg-blue-500 text-white",
          glow: "shadow-lg shadow-blue-500/10"
        }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 sm:h-32 sm:w-32 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-white text-lg sm:text-xl font-bold">Loading marks data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl sm:text-4xl font-bold text-white mb-4">Error Loading Marks</h1>
          <p className="text-red-300 mb-4 text-sm sm:text-base">{error}</p>
          <Link href="/">
            <Button className="bg-gradient-to-r from-pink-500 to-purple-500 w-full sm:w-auto">
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
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/">
              <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 p-2 sm:px-4">
                <ArrowLeft className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-3xl font-bold text-white flex items-center gap-2 truncate">
                <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-400 flex-shrink-0" />
                <span className="truncate">Event Results Overview</span>
              </h1>
              <p className="text-white/70 text-xs sm:text-base hidden sm:block">Top 3 teams across all events and categories</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 sm:py-8">
        {events.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl sm:text-6xl mb-4">📊</div>
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">No Events Found</h3>
            <p className="text-white/70 text-sm sm:text-base">No active events with marks data available.</p>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {events.map((event) => (
              <Card key={event.id} className="bg-white/10 backdrop-blur-sm border-white/20 overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-xl sm:text-2xl font-bold text-white flex items-start sm:items-center gap-2 mb-2">
                        <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400 flex-shrink-0 mt-1 sm:mt-0" />
                        <span className="break-words">{event.name}</span>
                      </CardTitle>
                      <div className="flex flex-wrap gap-2 text-xs sm:text-sm text-white/70">
                        <span className="bg-white/10 px-2 py-1 rounded-full">📅 {new Date(event.date).toLocaleDateString("en-GB")}</span>
                        <span className="bg-white/10 px-2 py-1 rounded-full">
                          🎯 {event.rounds} Round{event.rounds > 1 ? "s" : ""}
                        </span>
                        <span className="bg-white/10 px-2 py-1 rounded-full">📂 {event.categories.length} Categories</span>
                      </div>
                    </div>
                    <Link href={`/marks/${event.id}`} className="w-full sm:w-auto">
                      <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold w-full sm:w-auto">
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-6">
                    {event.categories.map((categoryResult) => (
                      <div key={categoryResult.category}>
                        <h3 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
                          <Medal className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 flex-shrink-0" />
                          <span className="break-words">{categoryResult.category} - Top 3</span>
                          <Badge variant="outline" className="text-xs bg-white/10 border-white/30 text-white/80">
                            {categoryResult.is_individual_marking ? "Individual" : "Team"} Marking
                          </Badge>
                        </h3>

                        {categoryResult.teamGroups.length === 0 ? (
                          <p className="text-white/70 text-center py-8 text-sm sm:text-base">No teams in this category</p>
                        ) : (
                          <div className="space-y-3 sm:space-y-4">
                            {categoryResult.teamGroups.slice(0, 3).map((teamGroup, index) => {
                              const colors = getRankColors(index)
                              const isIndividual = teamGroup.participants.length === 1
                              const showIndividualBreakdown = categoryResult.is_individual_marking && !isIndividual
                              
                              return (
                                <Card
                                  key={teamGroup.team_code}
                                  className={`${colors.bg} ${colors.glow} transition-all duration-300 hover:scale-[1.02]`}
                                >
                                  <CardContent className="p-3 sm:p-4">
                                    {isIndividual ? (
                                      // Individual participant view
                                      <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-lg ${colors.iconBg} flex-shrink-0`}>
                                          {getRankIcon(index)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-white font-bold text-base sm:text-lg truncate">
                                            {teamGroup.participants[0].name}
                                          </div>
                                          <div className="text-white/70 text-xs sm:text-sm flex items-center gap-2">
                                            <User className="w-3 h-3" />
                                            {teamGroup.participants[0].class} • {teamGroup.team_code}
                                          </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                          <div className="text-2xl sm:text-3xl font-bold text-white">{teamGroup.total_marks}</div>
                                          <div className="text-white/60 text-xs sm:text-sm">Score</div>
                                        </div>
                                      </div>
                                    ) : (
                                      // Team view
                                      <>
                                        <div className="flex items-center gap-3 mb-4">
                                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-lg ${colors.iconBg} flex-shrink-0`}>
                                            {getRankIcon(index)}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-white font-bold text-base sm:text-lg truncate">Team: {teamGroup.team_code}</div>
                                            <div className="text-white/70 text-xs sm:text-sm flex items-center gap-1">
                                              <Users className="w-3 h-3" />
                                              {teamGroup.participants.length} member{teamGroup.participants.length > 1 ? 's' : ''}
                                            </div>
                                          </div>
                                          <div className="text-right flex-shrink-0">
                                            <div className="text-2xl sm:text-3xl font-bold text-white">{teamGroup.total_marks}</div>
                                            <div className="text-white/60 text-xs sm:text-sm">
                                              {categoryResult.is_individual_marking ? "Combined Score" : "Team Score"}
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {/* Team Members - only show individual breakdown if individual marking */}
                                        {showIndividualBreakdown && (
                                          <div className="mt-4 pt-4 border-t border-white/20">
                                            <div className="text-white/80 font-semibold text-xs sm:text-sm mb-3">Individual Scores:</div>
                                            <div className="space-y-2">
                                              {teamGroup.participants.map((participant) => (
                                                <div 
                                                  key={participant.id} 
                                                  className="flex items-center justify-between bg-white/5 rounded-lg p-2 sm:p-3 hover:bg-white/10 transition-colors"
                                                >
                                                  <div className="flex-1 min-w-0">
                                                    <div className="text-white font-medium text-sm sm:text-base truncate">{participant.name}</div>
                                                    <div className="text-white/60 text-xs sm:text-sm">{participant.class}</div>
                                                  </div>
                                                  <div className="text-right flex-shrink-0 ml-2">
                                                    <div className="text-white font-bold text-sm sm:text-base">{participant.total_marks}</div>
                                                    <div className="text-white/50 text-xs">Individual</div>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Team Members list without scores for team marking */}
                                        {!categoryResult.is_individual_marking && (
                                          <div className="mt-4 pt-4 border-t border-white/20">
                                            <div className="text-white/80 font-semibold text-xs sm:text-sm mb-3">Team Members:</div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                              {teamGroup.participants.map((participant) => (
                                                <div 
                                                  key={participant.id} 
                                                  className="bg-white/5 rounded-lg p-2 sm:p-3 hover:bg-white/10 transition-colors"
                                                >
                                                  <div className="text-white font-medium text-sm sm:text-base truncate">{participant.name}</div>
                                                  <div className="text-white/60 text-xs sm:text-sm">{participant.class}</div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </CardContent>
                                </Card>
                              )
                            })}
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
