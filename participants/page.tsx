"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase, type Event, type Participant } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Users, UserPlus, Trash2, Edit, Save, X, Plus, Search, Filter } from "lucide-react"
import Link from "next/link"
import { isAdminLoggedIn, getAdminUser, getAccessibleEvents, canAccessEvent } from "@/lib/auth"

type ParticipantWithEvent = Participant & {
  event_name?: string
}

export default function ParticipantsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [participants, setParticipants] = useState<ParticipantWithEvent[]>([])
  const [filteredParticipants, setFilteredParticipants] = useState<ParticipantWithEvent[]>([])
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adminUser, setAdminUser] = useState<any>(null)

  // Form states
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterEvent, setFilterEvent] = useState<string>("all")
  const [filterCategory, setFilterCategory] = useState<string>("all")

  // Form data
  const [formData, setFormData] = useState({
    event_id: "",
    names: [""],
    school_code: "",
    team_id: "",
    solo_marking: false,
    classes: [""],
    scholar_numbers: [""],
    category: "",
  })

  useEffect(() => {
    // Check if admin is logged in
    if (!isAdminLoggedIn()) {
      router.push("/admin/login")
      return
    }

    const admin = getAdminUser()
    setAdminUser(admin)
    fetchData()
  }, [router])

  // Fetch categories when event is selected
  useEffect(() => {
    if (formData.event_id) {
      fetchCategoriesForEvent(Number.parseInt(formData.event_id))
    } else {
      setAvailableCategories([])
    }
  }, [formData.event_id])

  async function fetchCategoriesForEvent(eventId: number) {
    try {
      const { data: participantsData, error } = await supabase
        .from("participants")
        .select("category")
        .eq("event_id", eventId)

      if (error) throw error

      const categories = Array.from(new Set(participantsData?.map((p) => p.category).filter(Boolean) || []))
      setAvailableCategories(categories)
    } catch (error) {
      console.error("Error fetching categories:", error)
      setAvailableCategories([])
    }
  }

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)

      const accessibleEvents = getAccessibleEvents()

      // Fetch events
      let eventsQuery = supabase.from("events").select("*").eq("is_active", true).order("id", { ascending: true })

      if (accessibleEvents.length > 0) {
        const eventIds = accessibleEvents.map((id) => Number.parseInt(id)).filter((id) => !isNaN(id))
        if (eventIds.length > 0) {
          eventsQuery = eventsQuery.in("id", eventIds)
        }
      }

      const { data: eventsData, error: eventsError } = await eventsQuery
      if (eventsError) throw eventsError

      setEvents(eventsData || [])

      // Fetch participants
      let participantsQuery = supabase.from("participants").select("*").order("event_id, id")

      if (accessibleEvents.length > 0) {
        const eventIds = accessibleEvents.map((id) => Number.parseInt(id)).filter((id) => !isNaN(id))
        if (eventIds.length > 0) {
          participantsQuery = participantsQuery.in("event_id", eventIds)
        }
      }

      const { data: participantsData, error: participantsError } = await participantsQuery
      if (participantsError) throw participantsError

      // Add event names to participants
      const participantsWithEvents = (participantsData || []).map((participant) => ({
        ...participant,
        event_name: eventsData?.find((e) => e.id === participant.event_id)?.name || "Unknown Event",
      }))

      setParticipants(participantsWithEvents)
      setFilteredParticipants(participantsWithEvents)
    } catch (error: any) {
      console.error("Error fetching data:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  // Filter participants based on search and filters
  useEffect(() => {
    let filtered = participants

    if (searchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.school_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.team_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.scholar_number && p.scholar_number.toLowerCase().includes(searchTerm.toLowerCase())),
      )
    }

    if (filterEvent !== "all") {
      filtered = filtered.filter((p) => p.event_id.toString() === filterEvent)
    }

    if (filterCategory !== "all") {
      filtered = filtered.filter((p) => p.category === filterCategory)
    }

    setFilteredParticipants(filtered)
  }, [participants, searchTerm, filterEvent, filterCategory])

  function addNameField() {
    setFormData((prev) => ({
      ...prev,
      names: [...prev.names, ""],
      classes: [...prev.classes, ""],
      scholar_numbers: [...prev.scholar_numbers, ""],
    }))
  }

  function removeNameField(index: number) {
    if (formData.names.length > 1) {
      setFormData((prev) => ({
        ...prev,
        names: prev.names.filter((_, i) => i !== index),
        classes: prev.classes.filter((_, i) => i !== index),
        scholar_numbers: prev.scholar_numbers.filter((_, i) => i !== index),
      }))
    }
  }

  function updateNameField(index: number, value: string) {
    setFormData((prev) => ({
      ...prev,
      names: prev.names.map((name, i) => (i === index ? value : name)),
    }))
  }

  function updateClassField(index: number, value: string) {
    setFormData((prev) => ({
      ...prev,
      classes: prev.classes.map((cls, i) => (i === index ? value : cls)),
    }))
  }

  function updateScholarField(index: number, value: string) {
    setFormData((prev) => ({
      ...prev,
      scholar_numbers: prev.scholar_numbers.map((scholar, i) => (i === index ? value : scholar)),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validate all required fields
    if (!formData.event_id || !formData.school_code || !formData.team_id || !formData.category) {
      alert("Please fill in all required fields")
      return
    }

    // Validate that all participants have required data
    for (let i = 0; i < formData.names.length; i++) {
      if (!formData.names[i] || !formData.classes[i] || !formData.scholar_numbers[i]) {
        alert(`Please fill in all fields for participant ${i + 1}`)
        return
      }
    }

    // Check if admin can access this event
    if (!canAccessEvent(Number.parseInt(formData.event_id))) {
      alert("You don't have permission to add participants to this event")
      return
    }

    setSaving(true)
    try {
      const participantsToAdd = formData.names
        .map((name, index) => ({
          event_id: Number.parseInt(formData.event_id),
          name: name.trim(),
          school_code: formData.school_code.trim(),
          team_id: formData.team_id.trim(),
          solo_marking: formData.solo_marking,
          class: formData.classes[index]?.trim(),
          scholar_number: formData.scholar_numbers[index]?.trim(),
          category: formData.category.trim(),
        }))
        .filter((p) => p.name && p.class && p.scholar_number) // Only add complete participants

      const { data, error } = await supabase.from("participants").insert(participantsToAdd).select()

      if (error) throw error

      alert(`Successfully added ${participantsToAdd.length} participant(s)!`)

      // Reset form
      setFormData({
        event_id: "",
        names: [""],
        school_code: "",
        team_id: "",
        solo_marking: false,
        classes: [""],
        scholar_numbers: [""],
        category: "",
      })
      setShowAddForm(false)

      // Refresh data
      fetchData()
    } catch (error: any) {
      console.error("Error adding participants:", error)
      alert(`Error adding participants: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(participant: Participant) {
    if (!canAccessEvent(participant.event_id)) {
      alert("You don't have permission to edit participants in this event")
      return
    }
    setEditingParticipant(participant)
  }

  async function handleUpdate(updatedParticipant: Participant) {
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from("participants")
        .update({
          event_id: updatedParticipant.event_id,
          name: updatedParticipant.name,
          school_code: updatedParticipant.school_code,
          team_id: updatedParticipant.team_id,
          solo_marking: updatedParticipant.solo_marking,
          class: updatedParticipant.class,
          scholar_number: updatedParticipant.scholar_number,
          category: updatedParticipant.category,
        })
        .eq("id", updatedParticipant.id)
        .select()

      if (error) throw error

      // Update the participant in the local state without refetching
      const updatedEventName = events.find((e) => e.id === updatedParticipant.event_id)?.name || "Unknown Event"
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === updatedParticipant.id ? { ...p, ...updatedParticipant, event_name: updatedEventName } : p,
        ),
      )

      setEditingParticipant(null)
      alert("Participant updated successfully!")
    } catch (error: any) {
      console.error("Error updating participant:", error)
      alert(`Error updating participant: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(participant: Participant) {
    if (!canAccessEvent(participant.event_id)) {
      alert("You don't have permission to delete participants from this event")
      return
    }

    if (!confirm(`Are you sure you want to delete ${participant.name}? This will also delete all their marks.`)) {
      return
    }

    setSaving(true)
    try {
      // First delete marks
      const { error: marksError } = await supabase.from("marks").delete().eq("participant_id", participant.id)

      if (marksError) throw marksError

      // Then delete participant
      const { error: participantError } = await supabase.from("participants").delete().eq("id", participant.id)

      if (participantError) throw participantError

      // Remove from local state
      setParticipants((prev) => prev.filter((p) => p.id !== participant.id))

      alert("Participant deleted successfully!")
    } catch (error: any) {
      console.error("Error deleting participant:", error)
      alert(`Error deleting participant: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Get unique categories for filter
  const uniqueCategories = Array.from(new Set(participants.map((p) => p.category).filter(Boolean)))

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-white text-xl font-bold">Loading participants...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-4xl font-bold text-white mb-4">Error</h1>
          <p className="text-red-300 mb-6">{error}</p>
          <Button onClick={fetchData} className="bg-gradient-to-r from-pink-500 to-purple-500">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                  <Users className="w-8 h-8 text-cyan-400" />
                  Participant Management
                </h1>
                <p className="text-white/70">
                  {adminUser?.is_god_admin ? "Manage all participants" : "Manage participants for your events"}
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowAddForm(true)}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Participants
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Filters */}
        <Card className="mb-6 bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Filters & Search</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search" className="text-white">
                  Search
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
                  <Input
                    id="search"
                    placeholder="Name, school, team, scholar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="filterEvent" className="text-white">
                  Event
                </Label>
                <Select value={filterEvent} onValueChange={setFilterEvent}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="All Events" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id.toString()}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filterCategory" className="text-white">
                  Category
                </Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {uniqueCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => {
                    setSearchTerm("")
                    setFilterEvent("all")
                    setFilterCategory("all")
                  }}
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add Form Modal */}
        {showAddForm && (
          <Card className="mb-6 bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Add New Participants</CardTitle>
                <Button
                  onClick={() => setShowAddForm(false)}
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="event" className="text-white">
                      Event *
                    </Label>
                    <Select
                      value={formData.event_id}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, event_id: value }))}
                    >
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue placeholder="Select Event" />
                      </SelectTrigger>
                      <SelectContent>
                        {events.map((event) => (
                          <SelectItem key={event.id} value={event.id.toString()}>
                            {event.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="category" className="text-white">
                      Category *
                    </Label>
                    {availableCategories.length > 0 ? (
                      <Select
                        value={formData.category}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger className="bg-white/10 border-white/20 text-white">
                          <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCategories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="category"
                        placeholder="e.g., Junior Dance, Senior Art"
                        value={formData.category}
                        onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                        required
                      />
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="school_code" className="text-white">
                      School Code *
                    </Label>
                    <Input
                      id="school_code"
                      placeholder="e.g., ST001"
                      value={formData.school_code}
                      onChange={(e) => setFormData((prev) => ({ ...prev, school_code: e.target.value }))}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="team_id" className="text-white">
                      Team ID *
                    </Label>
                    <Input
                      id="team_id"
                      placeholder="e.g., TEAM_001"
                      value={formData.team_id}
                      onChange={(e) => setFormData((prev) => ({ ...prev, team_id: e.target.value }))}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="solo_marking"
                    checked={formData.solo_marking}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, solo_marking: checked as boolean }))
                    }
                  />
                  <Label htmlFor="solo_marking" className="text-white">
                    Solo Marking (each team member gets individual marks)
                  </Label>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-white">Participants *</Label>
                    <Button
                      type="button"
                      onClick={addNameField}
                      size="sm"
                      className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Member
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {formData.names.map((name, index) => (
                      <div key={index} className="grid md:grid-cols-4 gap-2 items-end">
                        <div>
                          <Label className="text-white text-xs">Name *</Label>
                          <Input
                            placeholder="Participant Name"
                            value={name}
                            onChange={(e) => updateNameField(index, e.target.value)}
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-white text-xs">Class *</Label>
                          <Input
                            placeholder="e.g., 10A"
                            value={formData.classes[index] || ""}
                            onChange={(e) => updateClassField(index, e.target.value)}
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-white text-xs">Scholar Number *</Label>
                          <Input
                            placeholder="Scholar Number"
                            value={formData.scholar_numbers[index] || ""}
                            onChange={(e) => updateScholarField(index, e.target.value)}
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                            required
                          />
                        </div>
                        <div>
                          {formData.names.length > 1 && (
                            <Button
                              type="button"
                              onClick={() => removeNameField(index)}
                              size="sm"
                              variant="outline"
                              className="bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? "Adding..." : "Add Participants"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    variant="outline"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Participants List */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Participants ({filteredParticipants.length})</CardTitle>
              <div className="text-sm text-white/70">Total: {participants.length} participants</div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredParticipants.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-16 h-16 text-white/30 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No Participants Found</h3>
                <p className="text-white/70">
                  {participants.length === 0
                    ? "No participants have been added yet."
                    : "No participants match your current filters."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="text-left py-3 px-2 text-white font-bold">Name</th>
                      <th className="text-left py-3 px-2 text-white font-bold">Event</th>
                      <th className="text-left py-3 px-2 text-white font-bold">Category</th>
                      <th className="text-left py-3 px-2 text-white font-bold">School</th>
                      <th className="text-left py-3 px-2 text-white font-bold">Team ID</th>
                      <th className="text-left py-3 px-2 text-white font-bold">Class</th>
                      <th className="text-left py-3 px-2 text-white font-bold">Scholar</th>
                      <th className="text-left py-3 px-2 text-white font-bold">Type</th>
                      <th className="text-center py-3 px-2 text-white font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.map((participant) => (
                      <tr key={participant.id} className="border-b border-white/10 hover:bg-white/5">
                        {editingParticipant?.id === participant.id ? (
                          <EditParticipantRow
                            participant={editingParticipant}
                            events={events}
                            onSave={handleUpdate}
                            onCancel={() => setEditingParticipant(null)}
                            saving={saving}
                          />
                        ) : (
                          <>
                            <td className="py-3 px-2 text-white">{participant.name}</td>
                            <td className="py-3 px-2 text-white/80 text-sm">{participant.event_name}</td>
                            <td className="py-3 px-2 text-white/80 text-sm">{participant.category || "-"}</td>
                            <td className="py-3 px-2">
                              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                                {participant.school_code}
                              </Badge>
                            </td>
                            <td className="py-3 px-2 text-white/80 text-sm">{participant.team_id}</td>
                            <td className="py-3 px-2 text-white/80 text-sm">{participant.class || "-"}</td>
                            <td className="py-3 px-2 text-white/80 text-sm">{participant.scholar_number || "-"}</td>
                            <td className="py-3 px-2">
                              <div className="flex flex-col items-center gap-1">
                                <Badge
                                  className={
                                    participant.solo_marking
                                      ? "bg-orange-500/20 text-orange-300 border-orange-500/30"
                                      : "bg-green-500/20 text-green-300 border-green-500/30"
                                  }
                                >
                                  {participant.solo_marking ? "Solo" : "Team"}
                                </Badge>
                                {!participant.solo_marking && (
                                  <span className="text-xs text-white/60">Solo Marking</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex gap-1 justify-center">
                                <Button
                                  onClick={() => handleEdit(participant)}
                                  size="sm"
                                  className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-500/30"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  onClick={() => handleDelete(participant)}
                                  size="sm"
                                  className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/30"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

// Edit participant row component
function EditParticipantRow({
  participant,
  events,
  onSave,
  onCancel,
  saving,
}: {
  participant: Participant
  events: Event[]
  onSave: (participant: Participant) => void
  onCancel: () => void
  saving: boolean
}) {
  const [editData, setEditData] = useState(participant)
  const [editCategories, setEditCategories] = useState<string[]>([])

  // Fetch categories when event changes in edit mode
  useEffect(() => {
    if (editData.event_id) {
      fetchCategoriesForEditEvent(editData.event_id)
    }
  }, [editData.event_id])

  async function fetchCategoriesForEditEvent(eventId: number) {
    try {
      const { data: participantsData, error } = await supabase
        .from("participants")
        .select("category")
        .eq("event_id", eventId)

      if (error) throw error

      const categories = Array.from(new Set(participantsData?.map((p) => p.category).filter(Boolean) || []))
      setEditCategories(categories)
    } catch (error) {
      console.error("Error fetching categories for edit:", error)
      setEditCategories([])
    }
  }

  return (
    <>
      <td className="py-3 px-2">
        <Input
          value={editData.name}
          onChange={(e) => setEditData((prev) => ({ ...prev, name: e.target.value }))}
          className="bg-white/10 border-white/20 text-white text-sm h-8"
          required
          aria-label="Participant name"
        />
      </td>
      <td className="py-3 px-2">
        <Select
          value={editData.event_id.toString()}
          onValueChange={(value) => setEditData((prev) => ({ ...prev, event_id: Number.parseInt(value) }))}
        >
          <SelectTrigger className="bg-white/10 border-white/20 text-white text-sm h-8" aria-label="Select event">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {events.map((event) => (
              <SelectItem key={event.id} value={event.id.toString()}>
                {event.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-3 px-2">
        {editCategories.length > 0 ? (
          <Select
            value={editData.category || ""}
            onValueChange={(value) => setEditData((prev) => ({ ...prev, category: value }))}
          >
            <SelectTrigger className="bg-white/10 border-white/20 text-white text-sm h-8" aria-label="Select category">
              <SelectValue placeholder="Select Category" />
            </SelectTrigger>
            <SelectContent>
              {editCategories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={editData.category || ""}
            onChange={(e) => setEditData((prev) => ({ ...prev, category: e.target.value }))}
            className="bg-white/10 border-white/20 text-white text-sm h-8"
            placeholder="Enter category"
            aria-label="Category"
            required
          />
        )}
      </td>
      <td className="py-3 px-2">
        <Input
          value={editData.school_code}
          onChange={(e) => setEditData((prev) => ({ ...prev, school_code: e.target.value }))}
          className="bg-white/10 border-white/20 text-white text-sm h-8"
          aria-label="School code"
          required
        />
      </td>
      <td className="py-3 px-2">
        <Input
          value={editData.team_id}
          onChange={(e) => setEditData((prev) => ({ ...prev, team_id: e.target.value }))}
          className="bg-white/10 border-white/20 text-white text-sm h-8"
          aria-label="Team ID"
          required
        />
      </td>
      <td className="py-3 px-2">
        <Input
          value={editData.class || ""}
          onChange={(e) => setEditData((prev) => ({ ...prev, class: e.target.value }))}
          className="bg-white/10 border-white/20 text-white text-sm h-8"
          aria-label="Class"
          required
        />
      </td>
      <td className="py-3 px-2">
        <Input
          value={editData.scholar_number || ""}
          onChange={(e) => setEditData((prev) => ({ ...prev, scholar_number: e.target.value }))}
          className="bg-white/10 border-white/20 text-white text-sm h-8"
          aria-label="Scholar number"
          required
        />
      </td>
      <td className="py-3 px-2">
        <div className="flex flex-col items-center gap-2">
          <Select
            value={editData.solo_marking ? "solo" : "team"}
            onValueChange={(value) => setEditData((prev) => ({ ...prev, solo_marking: value === "solo" }))}
          >
            <SelectTrigger
              className="bg-white/10 border-white/20 text-white text-sm h-8 w-20"
              aria-label="Marking type"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="team">Team</SelectItem>
              <SelectItem value="solo">Solo</SelectItem>
            </SelectContent>
          </Select>
          {!editData.solo_marking && (
            <div className="flex items-center gap-1">
              <Checkbox
                id={`solo-marking-${editData.id}`}
                checked={editData.solo_marking}
                onCheckedChange={(checked) => setEditData((prev) => ({ ...prev, solo_marking: checked as boolean }))}
                aria-describedby={`solo-marking-label-${editData.id}`}
              />
              <Label
                htmlFor={`solo-marking-${editData.id}`}
                id={`solo-marking-label-${editData.id}`}
                className="text-xs text-white/80 cursor-pointer"
              >
                Solo Marking
              </Label>
            </div>
          )}
        </div>
      </td>
      <td className="py-3 px-2">
        <div className="flex gap-1 justify-center">
          <Button
            onClick={() => onSave(editData)}
            disabled={saving}
            size="sm"
            className="bg-green-500/20 hover:bg-green-500/30 text-green-300 border-green-500/30"
            aria-label="Save changes"
          >
            <Save className="w-3 h-3" />
          </Button>
          <Button
            onClick={onCancel}
            size="sm"
            className="bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 border-gray-500/30"
            aria-label="Cancel editing"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </td>
    </>
  )
}
