---
layout: post
title: "Breathing Life Into NPCs: The Journey to Autonomous NPC Roaming"
date: 2025-10-15 07:00:00 -0500
categories: [development, ai, npcs, world-building]
tags: [mud, evennia, npc-ai, roaming, persistence, game-design]
author: Development Team
excerpt: "How we built an NPC AI system that makes the world feel alive, from timestamp-based state machines to surviving server reloads, and all the lessons learned along the way."
---

# Breathing Life Into NPCs: The Journey to Autonomous NPC Roaming

Picture this: You're walking through the Storage Container Maze in the Battle Ground district when a Street Thug appears. You engage in combat, but the thug flees down a dark corridor. You pause to heal up, then move to give chase - and realize the thug has vanished into the sprawling industrial complex. They're not sitting in the next room waiting for you. They've *moved*.

This is the magic of autonomous NPC roaming, and it fundamentally changes how the world feels. NPCs aren't static fixtures anymore - they're inhabitants of a living city. This post chronicles our journey from stationary NPCs to a fully autonomous, production-ready AI system that survived multiple dead ends, critical discoveries, and even a fundamental rethinking of how persistence works in MUDs.

## The Vision: A Living World

When we first implemented NPCs in Chatsubo, they served their purpose well. Ratz tended the bar at Chatsubo. Quest givers waited at their posts. Guards stood watch. But something was missing - the sense that this world existed beyond player interactions.

We wanted street thugs prowling their territories. Security patrols moving through corporate sectors. Civilians going about their business. We wanted players to feel like they'd entered an existing world rather than a stage set that only activates when they're present.

Our design goals were ambitious but clear:

- **Autonomous Movement**: NPCs move without manual intervention
- **Configurable Behavior**: Different NPC types behave differently
- **Production Persistence**: System must survive server reloads and restarts
- **Scalability**: Handle hundreds of NPCs without performance degradation
- **Clean Integration**: Work seamlessly with existing combat and dialogue systems

What we didn't realize at the outset was how many fundamental assumptions about NPC behavior would need to be challenged.

## First Attempt: The Delay Trap

Our initial implementation seemed straightforward. NPCs would enter a "roam" state, move to a random connected room, then use Evennia's `delay()` function to schedule their return to idle:

```
NPC enters roam state
  -> Moves to new room
    -> delay(30 seconds, return_to_idle)
      -> NPC returns to idle
        -> Random chance to roam again
```

We tested it in development. It worked beautifully. NPCs roamed, returned to idle, roamed again. We felt accomplished. We deployed to the test environment.

Then we ran `/reload`.

All NPC movement stopped. Every NPC was frozen in whatever state they were in when the reload happened. NPCs in roam state stayed in roam state forever, never moving, never returning to idle. The `delay()` callbacks had vanished.

**The harsh lesson**: Closures don't persist across server reloads.

The `delay()` function creates a callback closure that exists only in memory. When the server reloads and deserializes NPCs from the database, those closures are gone. The NPC remembers it's in roam state, but the scheduled callback to exit that state has evaporated.

Back to the drawing board.

## Second Attempt: The Timestamp Revelation

The core problem was clear: we needed state transitions to persist in the database, not just in memory. The solution emerged from a simple question: "What if we just stored *when* to transition instead of *how* to transition?"

Instead of scheduling a callback, we started storing timestamps:

```
Database Attribute: return_to_idle_at = 1729875600 (Unix timestamp)

Every 20 seconds, AI script checks:
  current_time = time.time()
  if current_time >= return_to_idle_at:
    transition to idle state
```

This architectural shift changed everything. The transition logic exists in the code that runs every tick. The *timing* data persists in the database. When the server reloads, the AI script loads the timestamp from the database and continues checking it. No closures, no lost state, no frozen NPCs.

The state machine became beautifully simple:

```
┌─────────┐
│  IDLE   │◄──────────────┐
└────┬────┘               │
     │                    │
     │ 30% chance         │
     │ per tick          │
     ▼                    │
┌─────────┐               │
│  ROAM   │───────────────┘
└─────────┘  timestamp
             expires
```

When entering roam state, set a timestamp 30-60 seconds in the future. Every tick while in roam state, check if that timestamp has passed. When it has, return to idle. The state transition persists because the timestamp persists.

We deployed this new architecture and tested a reload. NPCs kept moving. The roaming continued. We had persistence.

But we still had a problem: NPCs weren't moving at all.

## The Scheduling Mystery

Our AI scripts were created. They showed up in the scripts list. They were marked as active. But the `at_repeat()` method - the tick function that should run every 20 seconds - never executed.

We checked everything:
- Script interval: 20 seconds ✓
- Script repeats: 0 (infinite) ✓
- Script persistent: True ✓
- Script active: True ✓

But when we checked the ticker handler status, we saw the problem:

```
ai_handler_123 [Active] [next: --]
```

That `[next: --]` was the tell. The script existed, was active, but wasn't *scheduled*. Evennia's ticker handler had no idea when to run it next.

After hours of testing and diving into Evennia's source code, we discovered the critical detail: **Scripts need explicit parameters when calling `start()`**.

This doesn't work:
```
script.start()  # Script never executes
```

This works:
```
script.start(interval=20, repeats=0)  # Properly scheduled
```

Even if the script has `self.interval = 20` and `self.repeats = 0` set in its creation, calling `start()` without parameters doesn't schedule it properly. The parameters must be *passed to the start() method* for the ticker handler to recognize them.

We updated every `start()` call in the codebase with explicit parameters. Suddenly, NPCs started roaming.

## The Auto-Restart Challenge

We had working, persistent NPC roaming. Then we deployed to production and restarted the server.

All movement stopped again.

This was different from the delay() problem. The timestamp logic worked. The scripts existed. But they were inactive - `is_active` returned `False`. They needed to be manually restarted with explicit commands.

This wouldn't work in production. We couldn't manually restart hundreds of AI scripts every time the server rebooted.

We needed auto-restart.

The solution required understanding Evennia's object lifecycle. When the server starts and loads objects from the database, several hooks fire in sequence:

1. `at_init()` - Called when object first loads into memory
2. `at_start()` - Called when script starts (for scripts)

We implemented a dual-hook strategy:

**In the AI script itself:**
```
def at_start(self):
    # If not scheduled, start with explicit parameters
    if not self.time_until_next_repeat():
        self.start(interval=self.interval, repeats=self.repeats)
```

**In the NPC class:**
```
def at_init(self):
    # Find all AI scripts attached to this NPC
    ai_scripts = self.scripts.all()
    for script in ai_scripts:
        if script.key.startswith("ai_handler_"):
            script.at_start()  # Trigger the script's auto-start
```

This dual approach ensures:
- Scripts auto-restart when they load (via `at_start()`)
- NPCs auto-restart their scripts when they load (via `at_init()`)

We tested it with multiple server restarts, `/reload` commands, and even crashes. NPCs kept roaming. Finally, we had production-ready persistence.

## Movement Messages: The Details Matter

With working roaming, we noticed something that felt off. When NPCs moved, players saw:

```
Street Thug is leaving Storage Container Maze, heading for Training Arena.
[In the next room]
From Storage Container Maze, Street Thug arrives.
```

It worked, but it felt verbose and broke immersion. Players don't need to know the full room names. They need to know the *direction*.

We reimplemented the movement announcement system:

```
Street Thug leaves east.
[In the next room]
Street Thug arrives from the west.
```

This required implementing custom `announce_move_from()` and `announce_move_to()` methods that:
- Extract the exit direction from the movement
- Map exits to their opposites (north↔south, east↔west, etc.)
- Generate clean, directional messages

The difference seems small, but it transformed the feel of the world. NPCs now move like inhabitants, not like tour guides announcing their itinerary.

## Performance Optimization: Silence is Golden

During testing, we enabled debug logging to track state transitions:

```
[LOG] AI for Street Thug: idle -> roam
[LOG] Street Thug attempting movement
[LOG] Street Thug moved to Training Arena
[LOG] Will return to idle in 45.3s
[LOG] AI for Fresh Ganger: roam tick
[LOG] AI for Rogue Cyber-Psycho: idle tick
```

With five test NPCs, the logs were helpful. Then we considered production scale.

With 100 NPCs, each ticking every 20 seconds, that's 300 log entries per minute just for state transitions. With 500 NPCs, it's 1,500 log entries per minute. The logs would become unusable.

We changed our logging strategy: comment out logs instead of deleting them.

```
# logger.log_info(f"AI for {self.obj.key}: {old_state} -> {new_state}")
```

This gives us:
- Silent operation in production (no log spam)
- Quick debugging by uncommenting specific lines
- Preserved context for understanding the code

Combined with a 20-second tick interval (instead of faster rates like 5-10 seconds), the system scales efficiently to hundreds of NPCs without performance degradation.

## The Battle Ground: A Living Laboratory

To test and demonstrate the AI system, we built the Battle Ground - a five-room combat training area:

```
              [Medical Bay]
                    |
                  north
                    |
[Training Arena]--west--[Storage Container]--east--[Supply Depot]
                   Maze        |
                             south
                               |
                        [Obstacle Course]
```

Three test NPCs populate the area:
- Fresh Ganger Alpha (aggressive roaming)
- Street Thug (moderate roaming)
- Rogue Cyber-Psycho (active roaming)

When players visit, they encounter NPCs in different locations on each visit. Combat can scatter NPCs across the complex. The area feels *alive* because NPCs don't wait for players - they exist independently.

This area serves as both a testing ground for developers and a demonstration for players. It shows the system at work: NPCs roaming, engaging in combat, fleeing when outmatched, and resuming their patterns when left alone.

## Lessons Learned: Design Philosophy in Practice

### Persistence Isn't Optional

In a MUD, persistence is everything. Players expect the world to maintain state across logins, server restarts, and maintenance windows. Any system that doesn't persist is fundamentally broken for production use.

The timestamp-based approach taught us: **Store state in the database, logic in the code.**

### Explicit is Better Than Implicit

The `start()` parameter requirement was frustrating to discover, but it taught a valuable lesson. Don't rely on implicit configuration that might not be respected by framework internals. Be explicit about critical parameters.

### Test at Scale

A system that works with 5 NPCs might fail with 500. Performance testing, log volume analysis, and scalability considerations aren't optional - they're essential from the beginning.

### Iterate Based on Feel

The movement message change seemed minor, but it significantly impacted how the world felt. Don't dismiss "small" improvements to user experience. Details matter.

## Future Enhancements: Where We're Headed

### Combat Integration

NPCs currently roam and engage in combat, but combat doesn't affect roaming patterns. Future enhancements will include:
- NPCs fleeing to specific safe zones when health is low
- Guard NPCs pursuing combatants who flee
- NPCs returning to "home" locations after combat

### Patrol Routes

Some NPCs should follow specific paths rather than random movement:
- Security guards patrolling corporate sectors
- Delivery NPCs moving between known locations
- Faction members traversing territory boundaries

### Zone Restrictions

NPCs should stay within appropriate areas:
- Street thugs in industrial zones, not corporate lobbies
- Civilians avoiding combat zones
- Faction-based territorial restrictions

### Scheduled Behaviors

Time-based behaviors would add depth:
- Vendors at market stalls during day, at home at night
- Security patrols changing patterns by time of day
- NPC density varying with in-game time

## The Technical Achievement

What we built isn't just an NPC roaming system - it's a foundation for dynamic world simulation that:

- **Scales efficiently**: Hundreds of NPCs with minimal server impact
- **Persists reliably**: Survives restarts, reloads, and crashes
- **Integrates cleanly**: Works with combat, dialogue, and other systems
- **Configures flexibly**: Different behaviors for different NPC types
- **Feels authentic**: Creates the illusion of a living world

The journey from stationary NPCs to autonomous roaming taught us as much about MUD architecture as it did about NPC AI. We learned about Evennia's persistence model, discovered framework quirks, and developed patterns that will inform future systems.

## A Living World Awaits

The next time you visit the Battle Ground, pay attention to the NPCs. They're not waiting for you. They're moving through the complex, following their patterns, existing in the world. When you engage one in combat and they flee, they're not just changing rooms - they're making tactical decisions based on their state.

This is what makes worlds feel real. Not perfect AI or complex decision trees, but the simple fact that things happen when you're not looking. The city lives independently of player presence, and players step into an existing world rather than activating a dormant stage.

The NPCs of Chatsubo are no longer furniture in a set. They're inhabitants of a living city, and the city feels more real because of it.

---

The AI system is live in production. Visit the Battle Ground to see it in action, or observe any roaming NPC in the city. The world is alive, and it's only going to get more dynamic from here.

*The future of Chatsubo MUD is one where the world exists independently of player actions - a living, breathing cyberpunk city that players explore rather than activate.*