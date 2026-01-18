import { useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, AlertCircle } from 'lucide-react'
import { MonitorRow } from '../components/MonitorRow'
import IncidentTimeline from '../components/IncidentTimeline'
import AnnouncementBanner from '../components/AnnouncementBanner'
import type { Announcement } from '../components/AnnouncementBanner'
import { Card, CardContent } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import { fetchMonitors, fetchIncidents, fetchAnnouncements } from '../services/api'
import { useSmartPolling } from '../hooks/useSmartPolling'
import { cn } from '../lib/utils'
import type { Monitor, Incident } from '../types'
import { motion, type Variants } from 'framer-motion'

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  }
}

export default function StatusPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    try {
      const [monitorsData, incidentsData, announcementsData] = await Promise.all([
        fetchMonitors(),
        fetchIncidents(),
        fetchAnnouncements(),
      ])

      setMonitors(monitorsData)
      setIncidents(incidentsData)
      setAnnouncements(announcementsData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // Smart polling: 10s when active, 60s when tab hidden
  useSmartPolling({
    onPoll: loadData,
    activeInterval: 10000,
    inactiveInterval: 60000,
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto space-y-12">
          {/* Header Skeleton */}
          <div className="space-y-4 py-8 border-b border-border">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-8 w-64" />
            </div>
            <Skeleton className="h-4 w-96" />
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-4 gap-8 py-8 border-b border-border">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>

          {/* List Skeleton */}
          <div className="space-y-6">
            <Skeleton className="h-8 w-48 mb-6" />
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between py-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-6 w-48" />
                  </div>
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span>Error: {error}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const activeIncidents = incidents.filter(i => !i.resolvedAt)
  const hasIssues = activeIncidents.length > 0 || monitors.some(m => m.currentStatus !== 'up')
  const allDown = monitors.length > 0 && monitors.every(m => m.currentStatus === 'down')

  // Calculate overall uptime
  const overallUptime = monitors.length > 0
    ? monitors.reduce((sum, m) => sum + (m.uptime ?? 100), 0) / monitors.length
    : 100

  const getStatusIcon = () => {
    if (allDown) return <XCircle className="h-8 w-8" />
    if (hasIssues) return <AlertTriangle className="h-8 w-8" />
    return <CheckCircle className="h-8 w-8" />
  }

  const getStatusText = () => {
    if (allDown) return 'All Systems Down'
    if (hasIssues) return 'Some Systems Experiencing Issues'
    return 'All Systems Operational'
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Announcements */}
      {announcements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto px-4 sm:px-6 pt-6"
        >
          <AnnouncementBanner announcements={announcements} />
        </motion.div>
      )}

      {/* Main Content Container */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-3xl mx-auto px-4 sm:px-6"
      >

        {/* Status Header - Minimalist */}
        <motion.div variants={itemVariants} className="py-8 sm:py-12 border-b border-border">
          <div className="flex items-center gap-3 sm:gap-4 mb-4">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "p-2 rounded-full",
                allDown && "bg-destructive text-destructive-foreground",
                hasIssues && !allDown && "bg-warning text-warning-foreground",
                !hasIssues && "bg-success text-success-foreground"
              )}
            >
              {getStatusIcon()}
            </motion.div>
            <h2 className={cn(
              "text-2xl sm:text-3xl font-bold font-serif leading-tight",
              allDown && "text-destructive",
              hasIssues && !allDown && "text-warning",
              !hasIssues && "text-foreground" // Use foreground for "Operational" for a cleaner look
            )}>
              {getStatusText()}
            </h2>
          </div>
          <p className="text-muted-foreground font-serif text-base sm:text-lg">
            Current status of all services as of {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
          </p>
        </motion.div>

        {/* Active Incidents - Clear & Urgent */}
        {activeIncidents.length > 0 && (
          <motion.section variants={itemVariants} className="py-10 border-b border-border">
            <h3 className="text-xl font-bold font-serif mb-6 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Active Incidents
            </h3>
            <IncidentTimeline incidents={activeIncidents} />
          </motion.section>
        )}

        {/* System Metrics - Simplified to Text/Minimal Stats */}
        <motion.section variants={itemVariants} className="py-10 border-b border-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <motion.div whileHover={{ y: -2 }}>
              <div className="text-3xl font-bold font-serif mb-1">{overallUptime.toFixed(2)}%</div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Uptime</div>
            </motion.div>
            <motion.div whileHover={{ y: -2 }}>
              <div className="text-3xl font-bold font-serif mb-1">{monitors.length}</div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Services</div>
            </motion.div>
            <motion.div whileHover={{ y: -2 }}>
              <div className="text-3xl font-bold font-serif mb-1">{monitors.filter(m => m.currentStatus === 'up').length}</div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Operational</div>
            </motion.div>
            <motion.div whileHover={{ y: -2 }}>
              <div className="text-3xl font-bold font-serif mb-1">{activeIncidents.length}</div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Incidents</div>
            </motion.div>
          </div>
        </motion.section>

        {/* Services List - Clean List */}
        <motion.section variants={itemVariants} className="py-10 border-b border-border">
          <h3 className="text-xl font-bold font-serif mb-6">System Status</h3>
          <div className="space-y-4">
            {monitors.map((monitor) => (
              <MonitorRow key={monitor.id} monitor={monitor} />
            ))}
          </div>
        </motion.section>

        {/* Past Incidents */}
        <motion.section variants={itemVariants} className="py-10">
          <h3 className="text-xl font-bold font-serif mb-6">Recent Activity</h3>
          {incidents.length > 0 ? (
            <IncidentTimeline incidents={incidents.slice(0, 5)} />
          ) : (
            <p className="text-muted-foreground font-serif italic">
              No recent incidents reported.
            </p>
          )}
        </motion.section>

      </motion.div>
    </div>
  )
}
