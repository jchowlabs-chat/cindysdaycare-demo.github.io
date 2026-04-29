-- Analytics events table
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    session_id TEXT NOT NULL,
    device_type TEXT,
    screen_size TEXT,
    ip_country TEXT,
    referrer TEXT,
    user_agent TEXT,
    is_bot INTEGER DEFAULT 0,
    payload TEXT,
    timestamp INTEGER NOT NULL
);

CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_session ON events(session_id);
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_bot ON events(is_bot);
