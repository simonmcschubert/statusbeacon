import { memo } from 'react'
import { Clock, CheckCircle } from 'lucide-react'
import { Badge } from './ui/badge'
import type { Incident } from '../types'

interface IncidentTimelineProps {
  incidents: Incident[]
}

function getStatusVariant(status: string): 'success' | 'destructive' | 'warning' {
  switch (status) {
    case 'resolved':
      return 'success'
    case 'investigating':
      return 'warning'
    case 'identified':
      return 'destructive'
    case 'monitoring':
      return 'success'
    default:
      return 'warning'
  }
}

export const IncidentTimeline = memo(function IncidentTimeline({ incidents }: IncidentTimelineProps) {
  if (incidents.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground font-serif italic">
        <CheckCircle className="h-5 w-5 mr-2 text-success" />
        <span>No incidents to display</span>
      </div>
    )
  }

  return (
    <div className="space-y-12">
      {incidents.map((incident) => (
        <article key={incident.id} className="relative pl-8 md:pl-0">
          {/* Timeline Connector (Desktop) */}
          <div className="hidden md:block absolute left-[-24px] top-2 bottom-[-48px] w-px bg-border last:bottom-0" />
          <div className="hidden md:block absolute left-[-28px] top-2 h-2.5 w-2.5 rounded-full border border-border bg-background z-10" />

          <header className="mb-3">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {new Date(incident.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="text-muted-foreground/40">•</span>
              <Badge variant={getStatusVariant(incident.status)} className="font-sans text-[10px] px-1.5 h-5 rounded-sm">
                {incident.status}
              </Badge>
            </div>
            <h3 className="text-2xl font-bold font-serif text-foreground leading-tight">
              {incident.title}
            </h3>
          </header>

          <div className="prose prose-neutral dark:prose-invert prose-p:text-muted-foreground prose-p:font-serif prose-p:leading-relaxed max-w-none">
            <p>{incident.description}</p>
          </div>

          <footer className="mt-4 flex items-center gap-4 text-xs text-muted-foreground font-medium">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>{new Date(incident.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {incident.resolvedAt && (
              <>
                <span className="text-muted-foreground/40">•</span>
                <div className="flex items-center gap-1.5 text-success">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Resolved {new Date(incident.resolvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </>
            )}
          </footer>
        </article>
      ))}
    </div>
  )
});

export default IncidentTimeline;
