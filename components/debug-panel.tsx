"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type DebugPanelProps = {
  event: any
  participants: any[]
  criteria: any[]
  teams: any[]
}

export function DebugPanel({ event, participants, criteria, teams }: DebugPanelProps) {
  if (process.env.NODE_ENV === "production") return null

  return (
    <Card className="bg-red-500/10 border-red-500/20 mb-4">
      <CardHeader>
        <CardTitle className="text-white text-sm">Debug Info</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-white/80">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="font-bold mb-2">Event:</div>
            <div>ID: {event?.id}</div>
            <div>Rounds: {event?.rounds}</div>

            <div className="font-bold mb-2 mt-4">Participants ({participants.length}):</div>
            {participants.map((p) => (
              <div key={p.id} className="mb-1">
                {p.name} - {p.team_id} - Solo: {p.solo_marking ? "Yes" : "No"}
              </div>
            ))}
          </div>

          <div>
            <div className="font-bold mb-2">Criteria ({criteria.length}):</div>
            {criteria.map((c) => (
              <div key={c.id} className="mb-1">
                {c.criteria_name} ({c.max_marks})
              </div>
            ))}

            <div className="font-bold mb-2 mt-4">Teams ({teams.length}):</div>
            {teams.map((t) => (
              <div key={t.team_id} className="mb-1">
                {t.team_id} - {t.participants.length} members - Solo: {t.participants[0]?.solo_marking ? "Yes" : "No"}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
