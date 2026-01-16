import { useState } from 'react'

export interface Announcement {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'maintenance'
  active: boolean
  starts_at?: string
  ends_at?: string
}

interface AnnouncementBannerProps {
  announcements: Announcement[]
}

export default function AnnouncementBanner({ announcements }: AnnouncementBannerProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  if (announcements.length === 0) return null

  const visibleAnnouncements = announcements.filter(a => !dismissedIds.has(a.id))
  if (visibleAnnouncements.length === 0) return null

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]))
  }

  const getIcon = (type: Announcement['type']) => {
    switch (type) {
      case 'info':
        return (
          <svg className="announcement-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'warning':
        return (
          <svg className="announcement-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )
      case 'maintenance':
        return (
          <svg className="announcement-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )
    }
  }

  const getColors = (type: Announcement['type']) => {
    switch (type) {
      case 'info':
        return {
          bg: 'var(--color-info-bg)',
          border: 'var(--color-info)',
          text: 'var(--color-info)'
        }
      case 'warning':
        return {
          bg: 'var(--color-warning-bg)',
          border: 'var(--color-warning)',
          text: 'var(--color-warning)'
        }
      case 'maintenance':
        return {
          bg: 'var(--color-maintenance-bg)',
          border: 'var(--color-maintenance)',
          text: 'var(--color-maintenance)'
        }
    }
  }

  return (
    <div className="announcements-container">
      {visibleAnnouncements.map(announcement => {
        const colors = getColors(announcement.type)
        return (
          <div
            key={announcement.id}
            className="announcement-banner"
            style={{
              backgroundColor: colors.bg,
              borderLeft: `4px solid ${colors.border}`,
            }}
          >
            <div className="announcement-content">
              <span style={{ color: colors.text }}>
                {getIcon(announcement.type)}
              </span>
              <div className="announcement-text">
                <strong className="announcement-title">{announcement.title}</strong>
                <span className="announcement-message">{announcement.message}</span>
              </div>
            </div>
            <button
              className="announcement-dismiss"
              onClick={() => handleDismiss(announcement.id)}
              aria-label="Dismiss announcement"
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
