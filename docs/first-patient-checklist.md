# First real patient: one-page checklist

## Before they arrive (5 minutes)
- [ ] Double-click `start.bat`. It takes a backup, starts the app and opens http://localhost:3001. Keep that black window open while you work.
- [ ] Sign in with **your own** account (not the demo logins). If you forget your password, close the app and run `npm run make-admin` again with the same email.
- [ ] Laptop screen lock on, disk encryption on (Windows: Settings > Privacy & security > Device encryption or BitLocker). Close other people's access to this computer.
- [ ] Printed: consent form (`docs/consent-and-privacy.md`), test-day guide (`docs/test-protocols.md`).
- [ ] Equipment: barbell and rack, treadmill, phone on tripod, tape measure, floor tape, stopwatch.

## In the room
1. **Consent first.** Give the notice, answer questions, get the signature. Then tick the consent box in the app. (Nothing else is recorded until this is done.)
2. **New runner** on the home screen: name, sex, age, body mass, event, goal time, race date, their goals in their words.
3. Open the case and follow the **Guide: what to do next** box at the top. It tells you the next step and where to click.
4. **Screening questions in private.** Record any pain site honestly. A flag does not block you; it means *you* decide, and a flagged athlete needs your recorded review note before the program can be approved.
5. **Test day**, in the guide's order. Each test has a "How to run" panel in the form. Not every test is needed on day one: leave blanks for tests you skip. Do the race or time trial on another day.
6. **Save and run engine interpretation.** Read it, then record **your own** interpretation before leaning on the engine's.
7. **Program tab:** choose sessions per week (2 is the default), generate, check week 1 loads (secondary lifts are estimates), approve.
8. **Invite** the athlete if they will log from their phone (one-time link). Or log for them under Progress.

## After
- [ ] Close the app (close the black window) when finished.
- [ ] Copy the `backups` folder to a USB drive or cloud drive now and then. A backup on the same computer is not enough if the computer is lost.
- [ ] Note anything awkward in the app. It is easier to fix after the first real use.

## Remember
- The app is decision support. You decide, and you can edit or reject anything.
- Some rules are labelled *needs verification* or *proposed default*. Check the Rules page and have a second clinician review them when you can.
- If something goes wrong with the data: close the app and run `npm run restore` to list backups.
