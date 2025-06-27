export function isAdminLoggedIn(): boolean {
  if (typeof window === "undefined") return false
  const isLoggedIn = localStorage.getItem("admin_logged_in") === "true"
  console.log("🔍 Admin login check:", isLoggedIn)
  return isLoggedIn
}

export function getAdminUser() {
  if (typeof window === "undefined") return null
  const user = localStorage.getItem("admin_user")
  const parsedUser = user ? JSON.parse(user) : null
  console.log("🔍 Admin user check:", parsedUser)
  return parsedUser
}

export function logoutAdmin() {
  if (typeof window === "undefined") return
  console.log("🚪 Logging out admin")
  localStorage.removeItem("admin_logged_in")
  localStorage.removeItem("admin_user")
}

export function canAccessEvent(eventId: number): boolean {
  const adminUser = getAdminUser()
  if (!adminUser) {
    console.log("🔍 No admin user found")
    return false
  }

  // God admin can access all events
  if (adminUser.is_god_admin) {
    console.log("🔍 God admin access granted")
    return true
  }

  // Check if event ID is in admin's access list
  const hasAccess = adminUser.event_access && adminUser.event_access.includes(eventId.toString())
  console.log("🔍 Event access check:", { eventId, hasAccess, eventAccess: adminUser.event_access })
  return hasAccess
}

export function getAccessibleEvents(): string[] {
  const adminUser = getAdminUser()
  if (!adminUser) return []

  // God admin can access all events
  if (adminUser.is_god_admin) return []

  return adminUser.event_access || []
}
