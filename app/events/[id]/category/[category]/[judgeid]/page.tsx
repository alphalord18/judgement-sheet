"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  supabase,
  type Event,
  type JudgmentCriteria,
  type Participant,
  type AdminUser,
  type Judge,
} from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Trophy, Star, Save, Target, AlertCircle, Lock, Unlock, Shield } from "lucide-react"
import Link from "next/link"
import { isAdminLoggedIn, getAdminUser, canAccessEvent } from "@/lib/auth"

type TeamWithMarks = {
  team_id: string
  school_code: string
  participants: Participant[]
  is_solo_marking: boolean
  total_marks: number // This will be the current judge's total for the team
  rank: number
}

export default function CategoryJudgingPage() {
  const params = useParams()
  const eventId = Number.parseInt(params.id as string)
  const categoryName = decodeURIComponent(params.category as string)
  const judgeId = Number.parseInt(params.judgeid as string)

  const [event, setEvent] = useState<Event | null>(null)
  const [criteria, setCriteria] = useState<JudgmentCriteria[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [marks, setMarks] = useState<Record<string, number>>({}) // Key: `${participantId}-${criteriaId}-${round}`
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentAdminUser, setCurrentAdminUser] = useState<AdminUser | null>(null) // For full admin features
  const [currentJudgeDetails, setCurrentJudgeDetails] = useState<Judge | null>(null) // Details of the judge from URL
  const [isLocking, setIsLocking] = useState(false)

  useEffect(() => {
    const adminUser = getAdminUser()
    setCurrentAdminUser(adminUser)

    if (eventId && !isNaN(eventId) && judgeId && !isNaN(judgeId)) {
      fetchJudgeDetails()
      fetchEventData()
    } else {
      setError("Invalid event ID or Judge ID provided in URL.")
      setLoading(false)
    }
  }, [eventId, categoryName, judgeId])

  async function fetchJudgeDetails() {
    try {
      const { data, error } = await supabase.from("judges").select("id, name, username").eq("id", judgeId).single()
      if (error || !data) {
        throw new Error("Judge not found.")
      }
      setCurrentJudgeDetails(data)
    } catch (error: any) {
      console.error("Error fetching judge details:", error.message)
      setError("Could not load judge details. Please go back and select a judge again.")
    }
  }

  async function fetchEventData() {
    try {
      setLoading(true)
      setError(null)

      console.log("🔍 Fetching data for event ID:", eventId, "category:", categoryName, "judge ID:", judgeId)

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

      // Check if event is locked and user is not a full admin
      if (eventData.is_locked && !isAdminLoggedIn()) {
        console.log("🚫 Access blocked - event is locked and user is not admin")
        setError(
          `This event has been locked by administrator "${eventData.locked_by || "Unknown"}". Please contact the administrator for access.`,
        )
        setLoading(false)
        return
      }

      // Fetch judgment criteria
      const { data: criteriaData, error: criteriaError } = await supabase
        .from("judgment_criteria")
        .select("*")
        .eq("event_id", eventId)
        .order("id")

      if (criteriaError) {
        console.error("❌ Criteria error:", criteriaError)
        throw new Error(`Criteria loading failed: ${criteriaError.message}`)
      }

      console.log("✅ Criteria loaded:", criteriaData)
      setCriteria(criteriaData || [])

      // Fetch participants for this specific category
      const { data: participantsData, error: participantsError } = await supabase
        .from("participants")
        .select("*")
        .eq("event_id", eventId)
        .eq("category", categoryName)
        .order("team_id, name")

      if (participantsError) {
        console.error("❌ Participants error:", participantsError)
        throw new Error(`Participants loading failed: ${participantsData.message}`)
      }

      console.log("✅ Participants loaded for category:", participantsData)
      setParticipants(participantsData || [])

      // Fetch existing marks for participants in this category by the CURRENT JUDGE (from URL)
      if (participantsData && participantsData.length > 0 && judgeId) {
        const participantIds = participantsData.map((p) => p.id)
        const { data: marksData, error: marksError } = await supabase
          .from("marks")
          .select("*")
          .eq("event_id", eventId)
          .in("participant_id", participantIds)
          .eq("judge_id", judgeId) // Filter by current judge from URL

        if (marksError) {
          console.error("❌ Marks error:", marksError)
          console.warn("Marks loading failed, starting with empty marks")
        } else {
          console.log("✅ Marks loaded for current judge:", marksData)
          const marksMap: Record<string, number> = {}
          marksData?.forEach((mark) => {
            const key = `${mark.participant_id}-${mark.criteria_id}-${mark.round_number}`
            marksMap[key] = mark.marks_obtained
          })
          setMarks(marksMap)
        }
      }
    } catch (error: any) {
      console.error("💥 Fatal error:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function toggleEventLock() {
    if (!isAdminLoggedIn() || !event || !canAccessEvent(eventId)) {
      console.log("❌ Cannot toggle lock - insufficient permissions")
      return
    }

    setIsLocking(true)
    try {
      if (!eventId) {
        throw new Error("⚠️ eventId is missing or undefined")
      }

      const newLockState = !event.is_locked
      const adminUser = getAdminUser() // Use the full admin user for locking

      console.log("🔒 Toggling lock state:", {
        eventId,
        currentState: event.is_locked,
        newState: newLockState,
        adminUser: adminUser?.username,
      })

      const updateData = {
        is_locked: newLockState,
        locked_by: newLockState ? adminUser?.username || "Unknown Admin" : null,
        locked_at: newLockState ? new Date().toISOString() : null,
      }

      const { data: updatedData, error: updateError } = await supabase
        .from("events")
        .update(updateData)
        .eq("id", eventId)
        .select("id, name, is_locked, locked_by, locked_at")

      if (updateError) {
        throw new Error(`❌ Supabase update failed: ${updateError.message}`)
      }

      if (!updatedData || updatedData.length === 0) {
        throw new Error("⚠️ No rows updated. Event may not exist or RLS policy blocked the update.")
      }

      const updatedEvent = updatedData[0]
      setEvent({ ...event, ...updatedEvent })

      console.log("✅ Lock state updated locally:", updatedEvent)
      alert(`Event ${newLockState ? "locked" : "unlocked"} successfully!`)
    } catch (error: any) {
      console.error("❌ Lock toggle error:", error)
      alert(`Error ${event.is_locked ? "unlocking" : "locking"} event: ${error.message}`)
    } finally {
      setIsLocking(false)
    }
  }

  function handleMarkChange(participantId: number, criteriaId: number, round: number, value: string) {
    if (event?.is_locked) {
      alert("This event is locked. Please contact the administrator to unlock it.")
      return
    }

    const numValue = Math.max(0, Number.parseInt(value) || 0)
    const key = `${participantId}-${criteriaId}-${round}`

    console.log("📝 Mark changed:", { participantId, criteriaId, round, value: numValue, key })

    setMarks((prev) => {
      const newMarks = { ...prev, [key]: numValue }
      console.log("📊 Updated marks:", newMarks)
      return newMarks
    })
  }

  async function saveTeamMarks(teamParticipants: Participant[]) {
    if (event?.is_locked) {
      alert("This event is locked. Please contact the administrator to unlock it.")
      return
    }
    if (!judgeId) {
      alert("Judge ID not found in URL. Please go back and select a judge.")
      return
    }

    setSaving(true)
    try {
      console.log("💾 Starting to save marks for team:", teamParticipants[0]?.team_id)

      const marksToUpsert = []
      for (const participant of teamParticipants) {
        for (let round = 1; round <= (event?.rounds || 1); round++) {
          for (const criterion of criteria) {
            const key = `${participant.id}-${criterion.id}-${round}`
            const markValue = marks[key]

            // Only include marks that have been entered (value is a number)
            if (markValue !== undefined && markValue !== null) {
              marksToUpsert.push({
                event_id: eventId,
                participant_id: participant.id,
                criteria_id: criterion.id,
                round_number: round,
                marks_obtained: markValue,
                judge_id: judgeId, // Assign judge's ID from URL
              })
            }
          }
        }
      }

      console.log("💾 Marks to save:", marksToUpsert)

      if (marksToUpsert.length === 0) {
        alert("No marks to save for this team!")
        return
      }

      const { data, error } = await supabase
        .from("marks")
        .upsert(marksToUpsert, {
          onConflict: "event_id,participant_id,criteria_id,round_number,judge_id", // Corrected: Added event_id
        })
        .select()

      if (error) {
        console.error("❌ Save error:", error)
        throw error
      }

      console.log("✅ Marks saved successfully for team:", data)
      alert(`Marks for team ${teamParticipants[0]?.team_id} saved successfully! 🎉`)
    } catch (error: any) {
      console.error("❌ Save error:", error)
      alert(`Error saving marks: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Group participants by team and calculate totals for the CURRENT JUDGE
  const teams: TeamWithMarks[] = participants.reduce((acc, participant) => {
    const existingTeam = acc.find((team) => team.team_id === participant.team_id)
    if (existingTeam) {
      existingTeam.participants.push(participant)
    } else {
      acc.push({
        team_id: participant.team_id,
        school_code: participant.school_code,
        participants: [participant],
        is_solo_marking: participant.solo_marking,
        total_marks: 0,
        rank: 0,
      })
    }
    return acc
  }, [] as TeamWithMarks[])

  // Calculate totals for each team based on current judge's marks
  teams.forEach((team) => {
    let total = 0
    if (event) {
      for (let round = 1; round <= event.rounds; round++) {
        if (team.is_solo_marking) {
          team.participants.forEach((participant) => {
            criteria.forEach((criterion) => {
              const key = `${participant.id}-${criterion.id}-${round}`
              total += marks[key] || 0
            })
          })
        } else {
          const firstParticipant = team.participants[0]
          if (firstParticipant) {
            criteria.forEach((criterion) => {
              const key = `${firstParticipant.id}-${criterion.id}-${round}`
              total += marks[key] || 0
            })
          }
        }
      }
    }
    team.total_marks = total
  })

  // Create a sorted copy for rankings only
  const rankedTeams = [...teams].sort((a, b) => b.total_marks - a.total_marks)
  rankedTeams.forEach((team, index) => {
    // Find the original team and update its rank
    const originalTeam = teams.find((t) => t.team_id === team.team_id)
    if (originalTeam) {
      originalTeam.rank = index + 1
    }
  })

  const totalPossibleMarksPerRound = criteria.reduce((sum, criterion) => sum + criterion.max_marks, 0)
  const uniqueTeams = Array.from(new Set(participants.map((p) => p.school_code)))

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-white text-xl font-bold">Loading judgment sheet...</p>
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
            <Link href={`/events/${eventId}/category/${encodeURIComponent(categoryName)}/select-judge`}>
              <Button className="bg-gradient-to-r from-pink-500 to-purple-500 w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Judge Selection
              </Button>
            </Link>
            {error.includes("locked") && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <p className="text-yellow-300 text-sm">
                  📞 Contact the administrator to unlock this event and continue judging.
                </p>
              </div>
            )}
            {isAdminLoggedIn() && (
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

  const canManageEvent = isAdminLoggedIn() && canAccessEvent(eventId) // Use full admin login for management

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 w-full overflow-x-auto">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/20 w-full">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href={`/events/${eventId}/category/${encodeURIComponent(categoryName)}/select-judge`}>
                <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Judge Selection
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
                    🔒 Locked by: {event.locked_by} •{" "}
                    {event.locked_at ? new Date(event.locked_at).toLocaleString() : ""}
                  </p>
                )}
                {currentJudgeDetails && (
                  <p className="text-white/70 text-xs mt-1">
                    Judging as: <span className="font-bold text-yellow-300">{currentJudgeDetails.name}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-4">
              <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-3 py-1 md:px-4 md:py-2 text-xs md:text-sm">
                <Target className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                {event.rounds || 1} Round{(event.rounds || 1) > 1 ? "s" : ""}
              </Badge>
              {canManageEvent && (
                <Button
                  onClick={toggleEventLock}
                  disabled={isLocking}
                  className={`text-xs md:text-sm px-3 py-2 md:px-4 font-bold ${
                    event.is_locked
                      ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                      : "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                  }`}
                >
                  {event.is_locked ? (
                    <>
                      <Unlock className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                      {isLocking ? "Unlocking..." : "Unlock Event"}
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                      {isLocking ? "Locking..." : "Lock Event"}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 w-full">
        {/* Lock Warning for Non-Admins */}
        {event.is_locked && !isAdminLoggedIn() && (
          <Card className="mb-6 bg-red-500/10 border-red-500/20">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Lock className="w-5 h-5 text-red-400" />
                Event Locked
              </CardTitle>
            </CardHeader>
            <CardContent className="text-white">
              <p className="mb-2">
                This event has been locked by administrator <strong>"{event.locked_by}"</strong>.
              </p>
              <p className="text-red-300 text-sm">
                📞 Please contact the administrator to unlock this event if you need to make changes.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Category Status */}
        <Card className="mb-6 bg-blue-500/10 border-blue-500/20">
          <CardHeader>
            <CardTitle className="text-white text-lg">📊 Category: {categoryName}</CardTitle>
          </CardHeader>
          <CardContent className="text-white">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="font-bold text-green-400">✅ Event:</div>
                <div>{event.name}</div>
                <div>Rounds: {event.rounds || 1}</div>
                {event.is_locked && <div className="text-red-400 font-bold">🔒 LOCKED</div>}
              </div>
              <div>
                <div className="font-bold text-green-400">✅ Criteria ({criteria.length}):</div>
                {criteria.map((c) => (
                  <div key={c.id} className="text-xs">
                    {c.criteria_name} ({c.max_marks} marks)
                  </div>
                ))}
                <div className="text-xs font-bold text-yellow-400 mt-1">
                  Total: {totalPossibleMarksPerRound} marks per round
                </div>
              </div>
              <div>
                <div className="font-bold text-green-400">✅ Teams ({uniqueTeams.length} teams):</div>
                {uniqueTeams.map((schoolCode) => (
                  <div key={schoolCode} className="text-xs">
                    {schoolCode}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Judgment Sheet */}
          <div className="lg:col-span-2">
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                  <Star className="w-6 h-6 text-yellow-400" />
                  Judgment Sheet - {categoryName}
                  {event.is_locked && <Lock className="w-5 h-5 text-red-400" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {teams.length === 0 ? (
                  <div className="text-center py-8 text-white">
                    <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                    <p className="text-lg">No teams found in this category!</p>
                  </div>
                ) : criteria.length === 0 ? (
                  <div className="text-center py-8 text-white">
                    <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                    <p className="text-lg">No judgment criteria found!</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop View */}
                    <div className="hidden md:block overflow-x-auto">
                      <div className="min-w-[800px]">
                        <table className="w-full border-collapse bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-lg">
                          <thead>
                            <tr className="border-b-2 border-white/20">
                              <th className="text-left py-2 md:py-4 px-1 md:px-3 text-white font-bold min-w-[120px] md:min-w-[200px] bg-white/5">
                                <div className="text-xs md:text-sm">Participants</div>
                              </th>
                              <th className="text-center py-2 md:py-4 px-1 md:px-3 text-white font-bold bg-white/5 min-w-[60px]">
                                <div className="text-xs md:text-sm">Team Code</div>
                              </th>
                              {Array.from({ length: event.rounds || 1 }, (_, roundIndex) =>
                                criteria.map((criterion) => (
                                  <th
                                    key={`header-${criterion.id}-${roundIndex + 1}`}
                                    className="text-center py-2 md:py-4 px-1 md:px-3 text-white font-bold min-w-[80px] md:min-w-[100px] bg-white/5"
                                  >
                                    <div className="text-xs md:text-sm">R{roundIndex + 1}</div>
                                    <div className="text-xs font-normal truncate">{criterion.criteria_name}</div>
                                    <div className="text-xs text-white/70">Max: {criterion.max_marks}</div>
                                  </th>
                                )),
                              )}
                              <th className="text-center py-2 md:py-4 px-1 md:px-3 text-white font-bold bg-gradient-to-r from-yellow-500/20 to-orange-500/20 min-w-[60px]">
                                <div className="text-xs md:text-sm">My Total</div>
                              </th>
                              <th className="text-center py-2 md:py-4 px-1 md:px-3 text-white font-bold bg-white/5 min-w-[60px]">
                                <div className="text-xs md:text-sm">Actions</div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {teams.map((team) => (
                              <tr key={`team-${team.team_id}`} className="border-b border-white/10 hover:bg-white/5">
                                <td className="py-6 md:py-4 px-1 md:px-3 bg-white/5">
                                  <div className="space-y-1">
                                    {team.participants.map((participant) => (
                                      <div
                                        key={participant.id}
                                        className="text-white font-medium text-xs md:text-sm truncate"
                                      >
                                        {participant.name}
                                      </div>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-6 md:py-4 px-1 md:px-3 text-center">
                                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                                    {team.school_code}
                                  </Badge>
                                </td>
                                {Array.from({ length: event.rounds || 1 }, (_, roundIndex) =>
                                  criteria.map((criterion) => {
                                    const round = roundIndex + 1
                                    if (team.is_solo_marking) {
                                      return (
                                        <td
                                          key={`solo-${criterion.id}-${round}-${team.team_id}`}
                                          className="py-6 md:py-4 px-1 md:px-3 text-center"
                                        >
                                          <div className="space-y-2 flex flex-col items-center">
                                            {team.participants.map((participant) => (
                                              <Input
                                                key={`input-${participant.id}`}
                                                type="number"
                                                min="0"
                                                max={criterion.max_marks}
                                                value={marks[`${participant.id}-${criterion.id}-${round}`] || ""}
                                                onChange={(e) =>
                                                  handleMarkChange(participant.id, criterion.id, round, e.target.value)
                                                }
                                                disabled={event.is_locked}
                                                className="w-12 h-10 bg-white/10 border-white/20 text-white text-center text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50"
                                                placeholder="0"
                                              />
                                            ))}
                                          </div>
                                        </td>
                                      )
                                    } else {
                                      const firstParticipant = team.participants[0]
                                      return (
                                        <td
                                          key={`team-${criterion.id}-${round}-${team.team_id}`}
                                          className="py-6 md:py-4 px-1 md:px-3 text-center"
                                        >
                                          <div className="flex justify-center">
                                            <Input
                                              type="number"
                                              min="0"
                                              max={criterion.max_marks}
                                              value={marks[`${firstParticipant.id}-${criterion.id}-${round}`] || ""}
                                              onChange={(e) =>
                                                handleMarkChange(
                                                  firstParticipant.id,
                                                  criterion.id,
                                                  round,
                                                  e.target.value,
                                                )
                                              }
                                              disabled={event.is_locked}
                                              className="w-14 h-10 bg-white/10 border-white/20 text-white text-center text-xs md:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50"
                                              placeholder="0"
                                            />
                                          </div>
                                        </td>
                                      )
                                    }
                                  }),
                                )}
                                <td className="py-6 md:py-4 px-1 md:px-3 text-center bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
                                  <div className="text-white font-bold text-lg md:text-2xl">{team.total_marks}</div>
                                </td>
                                <td className="py-6 md:py-4 px-1 md:px-3 text-center">
                                  <Button
                                    onClick={() => saveTeamMarks(team.participants)}
                                    disabled={saving || event.is_locked}
                                    size="sm"
                                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold text-xs px-3 py-2 disabled:opacity-50"
                                  >
                                    <Save className="w-3 h-3 mr-1" />
                                    {saving ? "Saving..." : "Save"}
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mobile View - Simplified for category */}
                    <div className="md:hidden">
                      <div className="space-y-4">
                        {teams.map((team) => (
                          <Card key={team.team_id} className="bg-white/5 border-white/10">
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h3 className="text-white font-bold">{team.school_code}</h3>
                                  <div className="space-y-1">
                                    {team.participants.map((participant) => (
                                      <div key={participant.id} className="text-white/80 text-sm">
                                        {participant.name}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-white">{team.total_marks}</div>
                                  <div className="text-xs text-white/60">My Total</div>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-2">
                              <div className="space-y-3">
                                {Array.from({ length: event.rounds || 1 }, (_, roundIndex) => (
                                  <div key={roundIndex} className="space-y-2">
                                    <h4 className="text-white font-semibold text-sm">Round {roundIndex + 1}</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                      {criteria.map((criterion) => {
                                        const round = roundIndex + 1
                                        if (team.is_solo_marking) {
                                          return (
                                            <div key={criterion.id} className="space-y-1">
                                              <label className="text-xs text-white/70">{criterion.criteria_name}</label>
                                              <div className="space-y-1">
                                                {team.participants.map((participant) => (
                                                  <Input
                                                    key={participant.id}
                                                    type="number"
                                                    min="0"
                                                    max={criterion.max_marks}
                                                    value={marks[`${participant.id}-${criterion.id}-${round}`] || ""}
                                                    onChange={(e) =>
                                                      handleMarkChange(
                                                        participant.id,
                                                        criterion.id,
                                                        round,
                                                        e.target.value,
                                                      )
                                                    }
                                                    disabled={event.is_locked}
                                                    className="w-full h-8 bg-white/10 border-white/20 text-white text-center text-xs"
                                                    placeholder="0"
                                                  />
                                                ))}
                                              </div>
                                            </div>
                                          )
                                        } else {
                                          const firstParticipant = team.participants[0]
                                          return (
                                            <div key={criterion.id} className="space-y-1">
                                              <label className="text-xs text-white/70">{criterion.criteria_name}</label>
                                              <Input
                                                type="number"
                                                min="0"
                                                max={criterion.max_marks}
                                                value={marks[`${firstParticipant.id}-${criterion.id}-${round}`] || ""}
                                                onChange={(e) =>
                                                  handleMarkChange(
                                                    firstParticipant.id,
                                                    criterion.id,
                                                    round,
                                                    e.target.value,
                                                  )
                                                }
                                                disabled={event.is_locked}
                                                className="w-full h-8 bg-white/10 border-white/20 text-white text-center text-xs"
                                                placeholder="0"
                                              />
                                            </div>
                                          )
                                        }
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <Button
                                onClick={() => saveTeamMarks(team.participants)}
                                disabled={saving || event.is_locked}
                                className="w-full mt-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold text-sm px-3 py-2 disabled:opacity-50"
                              >
                                <Save className="w-4 h-4 mr-2" />
                                {saving ? "Saving..." : "Save Marks"}
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Rankings */}
          <div>
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-yellow-400" />
                  My Live Rankings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {rankedTeams.map((team, index) => (
                    <div
                      key={team.team_id}
                      className={`p-4 rounded-lg border ${
                        index === 0
                          ? "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30"
                          : index === 1
                            ? "bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/30"
                            : index === 2
                              ? "bg-gradient-to-r from-amber-600/20 to-amber-700/20 border-amber-600/30"
                              : "bg-white/5 border-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 flex-1">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                              index === 0
                                ? "bg-yellow-500 text-black"
                                : index === 1
                                  ? "bg-gray-400 text-black"
                                  : index === 2
                                    ? "bg-amber-600 text-white"
                                    : "bg-white/20 text-white"
                            }`}
                          >
                            {team.rank}
                          </div>
                          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">{team.school_code}</Badge>
                        </div>
                        <div className="ml-4">
                          <div className="text-2xl font-bold text-white">{team.total_marks}</div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {team.participants.map((participant) => (
                          <div key={participant.id} className="text-sm text-white/80">
                            {participant.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
