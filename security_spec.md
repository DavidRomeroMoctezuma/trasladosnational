# Security Spec - National Car Rental Traslados

## Data Invariants
1. A trip must link to a valid driver and destination.
2. `pointsEarned` on a trip must be positive.
3. Driver `totalPoints` should be the sum of their trips (computed client-side or via transaction, but rules must guard updates).
4. Only authenticated users can read or write.

## Dirty Dozen Payloads
1. **The Ghost Field**: Adding `isAdmin: true` to a Driver document.
2. **The Points Steal**: Updating a Driver's `totalPoints` to 1000 without a corresponding trip.
3. **The Identity Spoof**: Creating a Trip with `driverId` that doesn't match the requester (though in this app, one person might log for others). Let's assume an "admin" or "coordinator" logs these.
4. **The Negative Trip**: A trip with -50 points.
5. **The Long ID**: A destination ID of 2KB of random characters.
6. **The Outcome Override**: Changing a trip's `pointsEarned` after it has been logged.
7. **The Future Date**: Setting a trip date to the year 3000.
8. **The Orphaned Trip**: Creating a trip for a driver ID that doesn't exist.
9. **The Schema Junk**: Adding extra fields to the Destination object.
10. **The Self-Promotion**: A user updating their own driver profile to be more active or have more points.
11. **The Query Scrape**: Attempting to list all users' private info (if we had any).
12. **The Rapid Fire**: Flooding the database with 100 trips in 1 second.

## Tests
I will implement rules that prevent these using `isValidEntry()` logic.
