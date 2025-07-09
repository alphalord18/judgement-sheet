"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { AlertCircle, Shield, Eye, EyeOff } from "lucide-react"
import Link from "next/link"

export default function AdminLoginPage() {
  const [credentials, setCredentials] = useState({ username: "", password: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      console.log("🔐 Attempting login with:", credentials.username)

      // Check database for admin user
      const { data: adminUser, error } = await supabase
        .from("admin_users")
        .select("*")
        .eq("username", credentials.username)
        .single()

      console.log("🔍 Database query result:", { adminUser, error })

      if (error || !adminUser) {
        console.log("❌ User not found in database")
        throw new Error("Invalid credentials")
      }

      // Simple password check (in production, use proper password hashing)
      if (credentials.password !== adminUser.password_hash) {
        throw new Error("Invalid credentials")
      }

      console.log("✅ Admin user authenticated:", adminUser)

      // Store admin session
      localStorage.setItem("admin_logged_in", "true")
      localStorage.setItem("admin_user", JSON.stringify(adminUser))

      // Redirect based on admin type
      if (adminUser.is_god_admin) {
        // God admin goes to home page
        router.push("/")
      } else if (adminUser.event_access && adminUser.event_access.length === 1) {
        // Event-specific admin goes directly to their event's marks page
        router.push(`/marks/${adminUser.event_access[0]}`)
      } else {
        // Multiple events or no specific events - go to marks page
        router.push("/marks")
      }
    } catch (error: any) {
      console.error("❌ Login error:", error)
      setError("Invalid username or password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">Admin Login</CardTitle>
          <p className="text-white/70">Access administrative features</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-white">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                placeholder="Enter username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 pr-10"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-bold"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-white/70 hover:text-white text-sm">
              ← Back to Events
            </Link>
          </div>

          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="text-xs text-blue-300 space-y-1">
              <p>
                <strong>God Admin:</strong> admin / admin123
              </p>
              <p>
                <strong>Dance Admin:</strong> dance_admin / dance123
              </p>
              <p>
                <strong>Rap Admin:</strong> rap_admin / rap123
              </p>
              <p>
                <strong>Art Admin:</strong> art_admin / art123
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
