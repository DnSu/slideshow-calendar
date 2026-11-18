# Google Calendar

## Make the calendar public and find its ID

1. In Google Calendar, open Settings, pick the calendar, Access permissions, tick **Make available to public** (events only need to be visible; "See all event details" shows titles, locations and descriptions).
2. Under Integrate calendar, copy the **Calendar ID** (like `xxxx@group.calendar.google.com`). That is `CALENDAR_ID`.

The app reads the calendar's public iCal feed (`https://calendar.google.com/calendar/ical/<CALENDAR_ID>/public/basic.ics`). Google can take a while to refresh that feed after you edit an event.

## Who can put events on the screens

Add events **directly on the calendar**: share it (Settings → Share with specific people) with "Make changes to events" for the people who post, and they create events on it. Those events belong to the calendar, so they show.

**Invitations are left out.** An event someone sends to the calendar as an invitation (adding its ID as a guest) has the sender as its organizer, and the screens skip it, so a stranger who learns the calendar ID can't put an event on the lobby screens. This also means that inviting the calendar from your own calendar doesn't work; create the event on the shared calendar instead. Skipped invitations are counted in the server log.

[← Back to the README](../README.md)
