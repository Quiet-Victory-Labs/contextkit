import type { HTMLAttributes } from 'react';

export interface ActivityEvent {
  id: string;
  type: string;
  actor?: string;
  message: string;
  timestamp: string;
}

export interface ActivityFeedProps extends HTMLAttributes<HTMLDivElement> {
  events: ActivityEvent[];
}

export function ActivityFeed({
  events,
  className,
  ...props
}: ActivityFeedProps) {
  const classes = ['rc-activity-feed', className].filter(Boolean).join(' ');

  if (events.length === 0) {
    return (
      <div className={classes} {...props}>
        <p className="rc-activity-feed__message">No recent activity.</p>
      </div>
    );
  }

  return (
    <div className={classes} {...props}>
      {events.map((event) => (
        <div key={event.id} className="rc-activity-feed__item">
          <span className="rc-activity-feed__dot" />
          <span className="rc-activity-feed__message">{event.message}</span>
          <span className="rc-activity-feed__meta">{event.timestamp}</span>
        </div>
      ))}
    </div>
  );
}
