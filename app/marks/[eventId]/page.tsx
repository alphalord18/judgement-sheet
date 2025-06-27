"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase, type Event, type JudgmentCriteria, type Participant } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Trophy, Medal, Star, BarChart3 } from "lucide-react"
import Link from "next/link"
import { isAdminLoggedIn, canAccessEvent, getAdminUser } from "@/lib/auth"
import { useRouter } from "next/navigation"

type ParticipantWithMarks = Participant & {
  total_marks: number
  rank: number
  marks_by_criteria: Record<number, number>
  team_members?: Participant[] // For group events - store full participant objects
}

type CategoryResults = {
  category: string
  participants: ParticipantWithMarks[]
}

type EventWithDetails = Event & {
  judgment_criteria: JudgmentCriteria[]
  categories: CategoryResults[]
}

export default function EventMarksPage() {
  const params = useParams()
  const eventId = Number.parseInt(params.eventId as string)
  const [event, setEvent] = useState<EventWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Check if admin is logged in
    if (!isAdminLoggedIn()) {
      router.push("/admin/login")
      return
    }

    // Check if admin can access this event
    if (!canAccessEvent(eventId)) {
      setError("You don't have permission to access this event.")
      setLoading(false)
      return
    }

    if (eventId && !isNaN(eventId)) {
      fetchEventDetails()
    } else {
      setError("Invalid event ID")
      setLoading(false)
    }
  }, [eventId, router])

  async function fetchEventDetails() {
    try {
      setLoading(true)
      setError(null)

      // Fetch event details
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single()

      if (eventError) throw eventError

      // Fetch criteria for this event
      const { data: criteriaData, error: criteriaError } = await supabase
        .from("judgment_criteria")
        .select("*")
        .eq("event_id", eventId)
        .order("id")

      if (criteriaError) throw criteriaError

      // Fetch participants for this event
      const { data: participantsData, error: participantsError } = await supabase
        .from("participants")
        .select("*")
        .eq("event_id", eventId)
        .order("category, team_id, name")

      if (participantsError) throw participantsError

      // Fetch marks for this event
      const { data: marksData, error: marksError } = await supabase.from("marks").select("*").eq("event_id", eventId)

      if (marksError) throw marksError

      // Group participants by team to identify group events
      const teamsMap: Record<string, Participant[]> = {}
      ;(participantsData || []).forEach((participant) => {
        if (!teamsMap[participant.team_id]) {
          teamsMap[participant.team_id] = []
        }
        teamsMap[participant.team_id].push(participant)
      })

      // Group participants by category and calculate marks
      const categoriesMap: Record<string, ParticipantWithMarks[]> = {}
      ;(participantsData || []).forEach((participant) => {
        const category = participant.category || "General Category"

        if (!categoriesMap[category]) {
          categoriesMap[category] = []
        }

        // Check if this participant is already added (for group events)
        const existingParticipant = categoriesMap[category].find((p) => p.team_id === participant.team_id)
        if (existingParticipant && !participant.solo_marking) {
          // Add team member to existing entry
          if (!existingParticipant.team_members) {
            existingParticipant.team_members = [existingParticipant as Participant]
          }
          existingParticipant.team_members.push(participant)
          return
        }

        const marks_by_criteria: Record<number, number> = {}
        let total_marks = 0

        // Calculate marks for each criteria across all rounds
        ;(criteriaData || []).forEach((criteria) => {
          let criteriaTotal = 0
          for (let round = 1; round <= eventData.rounds; round++) {
            const mark = marksData?.find(
              (m) => m.participant_id === participant.id && m.criteria_id === criteria.id && m.round_number === round,
            )
            criteriaTotal += mark?.marks_obtained || 0
          }
          marks_by_criteria[criteria.id] = criteriaTotal
          total_marks += criteriaTotal
        })

        const participantWithMarks: ParticipantWithMarks = {
          ...participant,
          total_marks,
          rank: 0, // Will be set after sorting
          marks_by_criteria,
        }

        // For group events, initialize team_members array
        if (!participant.solo_marking && teamsMap[participant.team_id].length > 1) {
          participantWithMarks.team_members = [participant]
        }

        categoriesMap[category].push(participantWithMarks)
      })

      // Sort each category and assign ranks
      const categories: CategoryResults[] = Object.entries(categoriesMap).map(([category, participants]) => {
        participants.sort((a, b) => b.total_marks - a.total_marks)
        participants.forEach((participant, index) => {
          participant.rank = index + 1
        })

        return {
          category,
          participants,
        }
      })

      setEvent({
        ...eventData,
        judgment_criteria: criteriaData || [],
        categories,
      })
    } catch (error: any) {
      console.error("Error fetching event details:", error)
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
          <p className="text-white text-xl font-bold">Loading event details...</p>
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-red-300 mb-4">{error || "Event not found"}</p>
          <div className="space-y-3">
            <Link href="/marks">
              <Button className="bg-gradient-to-r from-pink-500 to-purple-500">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Marks
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const adminUser = getAdminUser()

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link href={adminUser?.is_god_admin ? "/marks" : "/"}>
              <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {adminUser?.is_god_admin ? "Back to Marks" : "Back to Home"}
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                <Trophy className="w-8 h-8 text-yellow-400" />
                {event.name} - Detailed Results
              </h1>
              <div className="flex flex-wrap gap-2 text-sm text-white/70 mt-2">
                <span>📅 {new Date(event.date).toLocaleDateString("en-GB")}</span>
                <span>
                  🎯 {event.rounds} Round{event.rounds > 1 ? "s" : ""}
                </span>
                <span>📂 {event.categories.length} Categories</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {event.categories.map((categoryResult) => (
            <Card key={categoryResult.category} className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                  <Medal className="w-6 h-6 text-yellow-400" />
                  {categoryResult.category}
                </CardTitle>
                <p className="text-white/70">{categoryResult.participants.length} participants</p>
              </CardHeader>
              <CardContent>
                {categoryResult.participants.length === 0 ? (
                  <p className="text-white/70 text-center py-8">No participants in this category</p>
                ) : (
                  <>
                    {/* Top 3 Winners */}
                    <div className="mb-8">
                      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Star className="w-5 h-5 text-cyan-400" />
                        Top 3 Winners
                      </h3>
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
                                  <div className="text-white font-bold">
                                    {participant.team_members && participant.team_members.length > 1 ? (
                                      <div className="space-y-1">
                                        {participant.team_members.map((member, idx) => (
                                          <div key={idx} className="text-sm">
                                            {member.name}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      participant.name
                                    )}
                                  </div>
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
                    </div>

                    {/* Complete Results Table */}
                    <div>
                      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-cyan-400" />
                        Complete Results with Skill Marks
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse bg-white/5 rounded-lg">
                          <thead>
                            <tr className="border-b-2 border-white/20">
                              <th className="text-left py-3 px-4 text-white font-bold">Rank</th>
                              <th className="text-left py-3 px-4 text-white font-bold min-w-[200px]">Participant(s)</th>
                              <th className="text-left py-3 px-4 text-white font-bold">Class</th>
                              <th className="text-left py-3 px-4 text-white font-bold">Scholar No.</th>
                              <th className="text-left py-3 px-4 text-white font-bold">Team Code</th>
                              {event.judgment_criteria.map((criteria) => (
                                <th
                                  key={criteria.id}
                                  className="text-center py-3 px-4 text-white font-bold min-w-[80px]"
                                >
                                  <div className="text-xs">{criteria.criteria_name}</div>
                                  <div className="text-xs text-white/70">Max: {criteria.max_marks * event.rounds}</div>
                                </th>
                              ))}
                              <th className="text-center py-3 px-4 text-white font-bold bg-gradient-to-r from-yellow-500/20 to-orange-500/20">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {categoryResult.participants.map((participant) => (
                              <tr
                                key={participant.id}
                                className={`border-b border-white/10 hover:bg-white/5 ${
                                  participant.rank <= 3 ? "bg-white/10" : ""
                                }`}
                              >
                                <td className="py-3 px-4">
                                  <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                      participant.rank === 1
                                        ? "bg-yellow-500 text-black"
                                        : participant.rank === 2
                                          ? "bg-gray-400 text-black"
                                          : participant.rank === 3
                                            ? "bg-amber-600 text-white"
                                            : "bg-white/20 text-white"
                                    }`}
                                  >
                                    {participant.rank}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-white font-medium">
                                  {participant.team_members && participant.team_members.length > 1 ? (
                                    <div className="space-y-1">
                                      {participant.team_members.map((member, idx) => (
                                        <div key={idx} className="text-sm">
                                          {member.name}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    participant.name
                                  )}
                                </td>
                                <td className="py-3 px-4 text-white/80">
                                  {participant.team_members && participant.team_members.length > 1 ? (
                                    <div className="space-y-1">
                                      {participant.team_members.map((member, idx) => (
                                        <div key={idx} className="text-sm">
                                          {member.class}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    participant.class
                                  )}
                                </td>
                                <td className="py-3 px-4 text-white/80">
                                  {participant.team_members && participant.team_members.length > 1 ? (
                                    <div className="space-y-1">
                                      {participant.team_members.map((member, idx) => (
                                        <div key={idx} className="text-sm">
                                          {member.scholar_number}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    participant.scholar_number
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                                    {participant.school_code}
                                  </Badge>
                                </td>
                                {event.judgment_criteria.map((criteria) => (
                                  <td key={criteria.id} className="py-3 px-4 text-center text-white">
                                    <div className="font-bold">{participant.marks_by_criteria[criteria.id] || 0}</div>
                                  </td>
                                ))}
                                <td className="py-3 px-4 text-center bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
                                  <div className="text-white font-bold text-lg">{participant.total_marks}</div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
