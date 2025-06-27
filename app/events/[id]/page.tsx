"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase, type Event, type JudgmentCriteria, type Participant } from "@/lib/supabase"
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
  total_marks: number
  rank: number
}

export default function EventJudgingPage() {
  const params = useParams()
  const eventId = Number.parseInt(params.id as string)

  const [event, setEvent] = useState<Event | null>(null)
  const [criteria, setCriteria] = useState<JudgmentCriteria[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [marks, setMarks] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLocking, setIsLocking] = useState(false)

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
      console.log("🔍 Current admin status:", isAdminLoggedIn())

      // Fetch event details with explicit column selection
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("id, name, description, date, is_active, rounds, is_locked, locked_by, locked_at")
        .eq("id", eventId)
        .single()

      if (eventError) {
        console.error("❌ Event error:", eventError)
        throw new Error(`Event not found: ${eventError.message}`)
      }

      console.log("✅ Event loaded with lock status:", {
        id: eventData.id,
        name: eventData.name,
        is_locked: eventData.is_locked,
        locked_by: eventData.locked_by,
        locked_at: eventData.locked_at,
      })

      setEvent(eventData)

      // Check if event is locked and user is not admin
      const currentAdminStatus = isAdminLoggedIn()
      console.log("🔒 Lock check:", {
        is_locked: eventData.is_locked,
        is_admin: currentAdminStatus,
        should_block: eventData.is_locked && !currentAdminStatus,
      })

      if (eventData.is_locked && !currentAdminStatus) {
        console.log("🚫 Access blocked - event is locked and user is not admin")
        setError(
          `This event has been locked by administrator "${eventData.locked_by || "Unknown"}". Please contact the administrator for access.`,
        )
        setLoading(false)
        return
      }

      // Continue with loading other data only if access is allowed
      console.log("✅ Access granted - continuing to load event data")

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

      // Fetch participants
      const { data: participantsData, error: participantsError } = await supabase
        .from("participants")
        .select("*")
        .eq("event_id", eventId)
        .order("team_id, name")

      if (participantsError) {
        console.error("❌ Participants error:", participantsError)
        throw new Error(`Participants loading failed: ${participantsError.message}`)
      }

      console.log("✅ Participants loaded:", participantsData)
      setParticipants(participantsData || [])

      // Fetch existing marks
      const { data: marksData, error: marksError } = await supabase.from("marks").select("*").eq("event_id", eventId)

      if (marksError) {
        console.error("❌ Marks error:", marksError)
        console.warn("Marks loading failed, starting with empty marks")
      } else {
        console.log("✅ Marks loaded:", marksData)
        const marksMap: Record<string, number> = {}
        marksData?.forEach((mark) => {
          const key = `${mark.participant_id}-${mark.criteria_id}-${mark.round_number}`
          marksMap[key] = mark.marks_obtained
        })
        setMarks(marksMap)
      }
    } catch (error: any) {
      console.error("💥 Fatal error:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function toggleEventLock() {
    if (!isAdmin || !event || !canAccessEvent(eventId)) {
        console.log("❌ Cannot toggle lock - insufficient permissions");
        return;
    }

    setIsLocking(true);
    try {
        if (!eventId) {
        throw new Error("⚠️ eventId is missing or undefined");
        }

        const newLockState = !event.is_locked;
        const adminUser = getAdminUser();

        console.log("🔒 Toggling lock state:", {
        eventId,
        currentState: event.is_locked,
        newState: newLockState,
        adminUser: adminUser?.username,
        });

        // Step 1: Confirm the event exists
        const { data: existingEvent, error: fetchError } = await supabase
        .from("events")
        .select("id, is_locked")
        .eq("id", eventId)
        .single();

        if (fetchError || !existingEvent) {
        throw new Error(`❌ Event with ID '${eventId}' not found or cannot be accessed`);
        }

        // Step 2: Check if already in desired state
        if (existingEvent.is_locked === newLockState) {
        alert(`Event is already ${newLockState ? "locked" : "unlocked"}!`);
        return;
        }

        const updateData = {
        is_locked: newLockState,
        locked_by: newLockState ? adminUser?.username || "Unknown Admin" : null,
        locked_at: newLockState ? new Date().toISOString() : null,
        };

        console.log("📝 Update data:", updateData);

        // Step 3: Perform the update
        const { data: updatedData, error: updateError } = await supabase
        .from("events")
        .update(updateData)
        .eq("id", eventId)
        .select("id, name, is_locked, locked_by, locked_at");

        if (updateError) {
        throw new Error(`❌ Supabase update failed: ${updateError.message}`);
        }

        if (!updatedData || updatedData.length === 0) {
        throw new Error("⚠️ No rows updated. Event may not exist or RLS policy blocked the update.");
        }

        // Step 4: Update local state
        const updatedEvent = updatedData[0];
        setEvent({ ...event, ...updatedEvent });

        console.log("✅ Lock state updated locally:", updatedEvent);
        alert(`Event ${newLockState ? "locked" : "unlocked"} successfully!`);

        // Step 5: Optional verification fetch after delay
        setTimeout(async () => {
        const { data: verifyData, error: verifyError } = await supabase
            .from("events")
            .select("is_locked, locked_by, locked_at")
            .eq("id", eventId)
            .single();

        if (verifyError) {
            console.warn("⚠️ Could not verify updated event:", verifyError.message);
        } else {
            console.log("🔍 Verification check:", verifyData);
        }
        }, 1000);
    } catch (error: any) {
        console.error("❌ Lock toggle error:", error);
        alert(`Error ${event.is_locked ? "unlocking" : "locking"} event: ${error.message}`);
    } finally {
        setIsLocking(false);
    }
  }


  function handleMarkChange(participantId: number, criteriaId: number, round: number, value: string) {
    // Prevent editing if event is locked
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

  async function saveMarks() {
    if (event?.is_locked) {
      alert("This event is locked. Please contact the administrator to unlock it.")
      return
    }

    setSaving(true)
    try {
      console.log("💾 Starting to save marks...")

      const marksToUpsert = Object.entries(marks)
        .filter(([_, value]) => value > 0)
        .map(([key, value]) => {
          const [participantId, criteriaId, roundNumber] = key.split("-").map(Number)
          return {
            event_id: eventId,
            participant_id: participantId,
            criteria_id: criteriaId,
            round_number: roundNumber,
            marks_obtained: value,
          }
        })

      console.log("💾 Marks to save:", marksToUpsert)

      if (marksToUpsert.length === 0) {
        alert("No marks to save!")
        return
      }

      const { data, error } = await supabase
        .from("marks")
        .upsert(marksToUpsert, {
          onConflict: "participant_id,criteria_id,round_number",
        })
        .select()

      if (error) {
        console.error("❌ Save error:", error)
        throw error
      }

      console.log("✅ Marks saved successfully:", data)
      alert("Marks saved successfully! 🎉")
    } catch (error: any) {
      console.error("❌ Save error:", error)
      alert(`Error saving marks: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Group participants by team and calculate totals
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

  // Calculate totals and ranks
  teams.forEach((team) => {
    let total = 0
    if (event) {
      for (let round = 1; round <= event.rounds; round++) {
        if (team.is_solo_marking) {
          // Solo marking: sum all participants
          team.participants.forEach((participant) => {
            criteria.forEach((criterion) => {
              const key = `${participant.id}-${criterion.id}-${round}`
              total += marks[key] || 0
            })
          })
        } else {
          // Team marking: use first participant's marks
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

  // Sort and assign ranks
  teams.sort((a, b) => b.total_marks - a.total_marks)
  teams.forEach((team, index) => {
    team.rank = index + 1
  })

  // Calculate total possible marks per round and unique schools
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
            <Link href="/">
              <Button className="bg-gradient-to-r from-pink-500 to-purple-500 w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Events
              </Button>
            </Link>
            {error.includes("locked") && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <p className="text-yellow-300 text-sm">
                  📞 Contact the administrator to unlock this event and continue judging.
                </p>
              </div>
            )}
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

  const canManageEvent = isAdmin && canAccessEvent(eventId)

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 w-full overflow-x-auto">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/20 w-full">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
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
              <Button
                onClick={saveMarks}
                disabled={saving || event.is_locked}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold text-xs md:text-sm px-3 py-2 md:px-4 disabled:opacity-50"
              >
                <Save className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                {saving ? "Saving..." : "Save All Marks"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 w-full">
        {/* Lock Warning for Non-Admins */}
        {event.is_locked && !isAdmin && (
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

        {/* Debug Info for Development */}
        {process.env.NODE_ENV === "development" && (
          <Card className="mb-6 bg-blue-500/10 border-blue-500/20">
            <CardHeader>
              <CardTitle className="text-white text-sm">🐛 Debug Info</CardTitle>
            </CardHeader>
            <CardContent className="text-white text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div>Event ID: {eventId}</div>
                  <div>Is Locked: {event.is_locked ? "YES" : "NO"}</div>
                  <div>Locked By: {event.locked_by || "None"}</div>
                  <div>Is Admin: {isAdmin ? "YES" : "NO"}</div>
                </div>
                <div>
                  <div>Can Manage: {canManageEvent ? "YES" : "NO"}</div>
                  <div>Admin User: {getAdminUser()?.username || "None"}</div>
                  <div>Locked At: {event.locked_at ? new Date(event.locked_at).toLocaleString() : "Never"}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Status */}
        <Card className="mb-6 bg-blue-500/10 border-blue-500/20">
          <CardHeader>
            <CardTitle className="text-white text-lg">📊 System Status</CardTitle>
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
                  Judgment Sheet
                  {event.is_locked && <Lock className="w-5 h-5 text-red-400" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {teams.length === 0 ? (
                  <div className="text-center py-8 text-white">
                    <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                    <p className="text-lg">No teams found!</p>
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
                                <div className="text-xs md:text-sm">Total</div>
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
                                                key={`mobile-input-${participant.id}`}
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
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mobile View - Transposed Table */}
                    <div className="md:hidden">
                      <div className="overflow-x-auto">
                        <div className="min-w-[600px] bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4 rounded-lg">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b-2 border-white/20">
                                <th className="text-left py-3 px-2 text-white font-bold bg-white/5 min-w-[120px]">
                                  <div className="text-xs">Criteria</div>
                                </th>
                                {teams.map((team) => (
                                  <th
                                    key={team.team_id}
                                    className="text-center py-3 px-2 text-white font-bold bg-white/5 min-w-[80px]"
                                  >
                                    <div className="text-xs mb-1">{team.school_code}</div>
                                    <div className="space-y-1">
                                      {team.participants.map((participant) => (
                                        <div key={participant.id} className="text-xs font-normal truncate">
                                          {participant.name.split(" ")[0]}
                                        </div>
                                      ))}
                                    </div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {Array.from({ length: event.rounds || 1 }, (_, roundIndex) =>
                                criteria.map((criterion) => {
                                  const round = roundIndex + 1
                                  return (
                                    <tr
                                      key={`mobile-${criterion.id}-${round}`}
                                      className="border-b border-white/10 hover:bg-white/5"
                                    >
                                      <td className="py-4 px-2 bg-white/5">
                                        <div className="text-white font-medium text-xs">
                                          <div>
                                            R{round}: {criterion.criteria_name}
                                          </div>
                                          <div className="text-white/70">Max: {criterion.max_marks}</div>
                                        </div>
                                      </td>
                                      {teams.map((team) => (
                                        <td
                                          key={`mobile-cell-${team.team_id}-${criterion.id}-${round}`}
                                          className="py-4 px-2 text-center"
                                        >
                                          {team.is_solo_marking ? (
                                            <div className="space-y-2 flex flex-col items-center">
                                              {team.participants.map((participant) => (
                                                <Input
                                                  key={`mobile-input-${participant.id}`}
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
                                                  className="w-12 h-10 bg-white/10 border-white/20 text-white text-center text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50"
                                                  placeholder="0"
                                                />
                                              ))}
                                            </div>
                                          ) : (
                                            <div className="flex justify-center">
                                              <Input
                                                type="number"
                                                min="0"
                                                max={criterion.max_marks}
                                                value={
                                                  marks[`${team.participants[0].id}-${criterion.id}-${round}`] || ""
                                                }
                                                onChange={(e) =>
                                                  handleMarkChange(
                                                    team.participants[0].id,
                                                    criterion.id,
                                                    round,
                                                    e.target.value,
                                                  )
                                                }
                                                disabled={event.is_locked}
                                                className="w-14 h-10 bg-white/10 border-white/20 text-white text-center text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50"
                                                placeholder="0"
                                              />
                                            </div>
                                          )}
                                        </td>
                                      ))}
                                    </tr>
                                  )
                                }),
                              )}
                              {/* Total Row */}
                              <tr className="border-t-2 border-white/20 bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
                                <td className="py-4 px-2 bg-white/5">
                                  <div className="text-white font-bold text-sm">Total Marks</div>
                                </td>
                                {teams.map((team) => (
                                  <td key={`total-${team.team_id}`} className="py-4 px-2 text-center">
                                    <div className="text-white font-bold text-lg">{team.total_marks}</div>
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </div>
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
                  Live Rankings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {teams.map((team, index) => (
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
