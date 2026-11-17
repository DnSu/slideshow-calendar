# Google Calendar

## Make the calendar public and find its ID

1. In Google Calendar, open Settings, pick the calendar, Access permissions, tick **Make available to public** (events only need to be visible; "See all event details" shows titles, locations and descriptions).
2. Under Integrate calendar, copy the **Calendar ID** (like `xxxx@group.calendar.google.com`). That is `CALENDAR_ID`.

The app reads the calendar's public iCal feed (`https://calendar.google.com/calendar/ical/<CALENDAR_ID>/public/basic.ics`). Google can take a while to refresh that feed after you edit an event.

[← Back to the README](../README.md)
