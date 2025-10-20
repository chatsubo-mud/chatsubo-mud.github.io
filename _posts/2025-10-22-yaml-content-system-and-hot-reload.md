---
layout: post
title: "Live World Editing: YAML Content System and Hot-Reload"
date: 2025-10-22 07:00:00 -0500
categories: [development, content, world-building, tools]
tags: [mud, evennia, yaml, hot-reload, content-management, workflow]
author: Development Team
excerpt: "How we built a content management system that lets writers edit the world in real-time without destroying rooms, displacing players, or losing NPCs - and the journey from 'rebuild everything' to 'just change the description.'"
---

# Live World Editing: YAML Content System and Hot-Reload

Imagine you're a world builder working on a cyberpunk MUD. You've just written a beautiful room description for the Toxic Waste Pit, complete with bubbling sludge, radiation warnings, and atmospheric details. You deploy it. Players explore it. An NPC boss spawns there. Everything is working.

Then you notice a typo. Just one word: "A narrow alley" should be "An ugly narrow alley."

In traditional MUD development, fixing this requires:
1. Taking the room offline
2. Moving all players out
3. Deleting the room and all its contents
4. Running the build script
5. Rebuilding exits, NPCs, and configuration
6. Hoping you didn't break anything

**Time required:** 5-10 minutes. **Risk level:** High. **Player disruption:** Significant.

With our YAML content system and hot-reload, here's the new workflow:

1. Edit the YAML file
2. Type `@dynspawn/hotreload/apply`

**Time required:** 5 seconds. **Risk level:** Zero. **Player disruption:** None.

This post chronicles how we built a content management system that makes the world editable in real-time, the technical challenges we solved, and what it means for rapid iteration on a living game.

## The Problem: Code and Content Are Married

Traditional MUD development tightly couples content with code. Room descriptions live in Python scripts. Spawn configurations are hard-coded. Changing a description means editing the build script, which means running the build script, which means destroying and recreating the room.

This creates several problems:

### Problem 1: Writers Need to Code
To add a room description, you need to:
- Understand Python syntax
- Navigate the codebase
- Edit build scripts
- Test code execution
- Handle errors and debugging

This puts content creation in the hands of developers, not writers. The person best equipped to write atmospheric cyberpunk prose shouldn't need to understand Python string escaping and indentation rules.

### Problem 2: Iteration Is Expensive
Every content change requires a full rebuild cycle:
- Edit script → Run script → Test → Find issues → Repeat

Each cycle disrupts players, risks data loss, and takes minutes instead of seconds. This slows iteration to a crawl. Writers can't rapidly prototype, test tone, or polish details.

### Problem 3: No Version Control for Content
When content lives in build scripts mixed with logic, version control becomes messy. A `git diff` shows Python code changes and content changes intermingled. Reviewing a description change requires reading through spawn logic, exit creation, and NPC configuration.

### Problem 4: Destructive Updates
The fundamental issue: **Rebuilding destroys state.**

When you rebuild a room, you lose:
- NPCs currently in the room
- Players exploring the area
- Items on the ground
- Active scripts and timers
- Combat encounters in progress

Every content update becomes a mini-crisis of preservation and restoration.

## The Vision: Content as Data, Not Code

We wanted a system where:

1. **Writers work in plain text** - No Python knowledge required
2. **Changes go live instantly** - Edit file, reload, done
3. **Content is versioned separately** - Clean diffs, clear history
4. **Updates preserve state** - NPCs, players, and items stay put
5. **Conflicts are impossible** - No merge conflicts between description edits and code changes

The solution: Separate content from code entirely.

## Part 1: The YAML Content System

We built a content management layer that loads all game text from YAML files at runtime.

### Architecture

```
content/writing/
├── areas/
│   ├── battle_ground.yaml      # Area configurations
│   └── chatsubo_bar.yaml
├── enemies/
│   ├── tier1/
│   │   └── street_trash.yaml   # Enemy templates
│   ├── tier2/
│   └── tier3/
├── items/
│   └── consumables/
│       └── stim_packs.yaml     # Item definitions
└── quests/
    └── tutorial/
        └── first_blood.yaml    # Quest content
```

Each YAML file has a unique ID and contains structured content:

```yaml
# content/writing/areas/battle_ground.yaml
id: area.battle_ground.main

name: Battle Ground
description: Abandoned district behind Black Clinic

spawn_config:
  enabled: true
  max_population: 6
  spawn_interval: 15
  threat_distribution:
    tier_1_weight: 80
    tier_2_weight: 20
    tier_3_weight: 0

rooms:
  toxic_pit:
    name: "Toxic Waste Pit"
    aliases:
      - "pit"
      - "waste"
      - "toxic"

    description: |
      A depression in the ground has filled with chemical
      runoff from nearby factories, creating a bubbling pool
      of multicolored sludge. Warning signs hang askew on
      rusted chains, their radiation symbols barely visible
      through corrosion.

    details:
      pool: "The toxic pool bubbles sluggishly..."
      signs: "Faded warning signs dangle from chains..."
      walkways: "Narrow bridges made from scrap metal..."

    echoes:
      - "The toxic pool bubbles and gurgles ominously."
      - "A pocket of gas escapes with a wet hiss."
      - "Warning signs clank together in toxic updrafts."
```

### The Content Loader

`utils/content_loader.py` provides a singleton that loads and caches all YAML content:

```python
from utils.content_loader import content

# Get content with dot notation
description = content.get("area.battle_ground.main.rooms.toxic_pit.description")

# Get with defaults
echoes = content.get("area.battle_ground.main.rooms.toxic_pit.echoes", default=[])

# Reload from disk
content.reload()  # Picks up file changes
```

The loader walks through `content/writing/`, loads all YAML files, indexes them by ID, and provides fast access via dot notation.

### Build Scripts Use Content

Build scripts become thin wrappers that create objects and populate them from YAML:

```python
# Old way: Hard-coded content
room = create_object(Room, key="Toxic Waste Pit")
room.db.desc = "A depression in the ground has filled with..."
room.db.echoes = ["The toxic pool bubbles...", "A pocket of gas..."]

# New way: Content-driven
room_config = content.get("area.battle_ground.main.rooms.toxic_pit")
room = create_object(Room, key=room_config['name'])
room.db.desc = room_config['description']
room.db.echoes = room_config['echoes']
```

Content lives in YAML. Code creates objects and applies content. Clean separation.

### Benefits Realized

This immediately solved several problems:

**Writers can edit content directly** - No Python knowledge needed. Edit YAML, save, done.

**Version control is clean** - Content changes show up as YAML diffs, not Python code diffs.

**Content is portable** - The same YAML can be used by multiple build scripts, documentation generators, or external tools.

But we still had the rebuild problem. To see content changes, you had to rebuild the area, which destroyed state.

We needed hot-reload.

## Part 2: The Hot-Reload System

Hot-reload solves the fundamental problem: **How do you update content without destroying state?**

The answer: Compare YAML against the database, detect differences, and apply only the changes.

### Architecture: The Area Differ

We built `utils/area_differ.py`, which implements a three-step process:

**Step 1: Content Key Tracking**

Build scripts now store metadata linking database objects to YAML content:

```python
# On each room
room.db.content_key = "area.battle_ground.main.rooms.toxic_pit"

# On the area anchor room
anchor_room.db.area_content_key = "area.battle_ground.main"
```

This creates a bidirectional mapping: Database → YAML, YAML → Database.

**Step 2: Difference Detection**

The `AreaDiffer` class compares YAML configuration against database state:

```python
from utils.area_differ import get_area_differ

differ = get_area_differ(room)
diffs = differ.get_differences()
```

It compares:
- Room descriptions
- Room aliases
- Room details (examine targets)
- Ambient echoes and intervals
- Spawn configuration (population, threat distribution, level range)
- AI configuration (roaming behavior, aggression)
- Room-specific spawn bias

For each field, it detects:
- **Modified** values (old ≠ new)
- **Added** values (exists in YAML, not in DB)
- **Removed** values (exists in DB, not in YAML)

**Step 3: Change Application**

`differ.apply_changes()` updates the database to match YAML:

```python
# Update room description
room.db.desc = new_description

# Update aliases
room.aliases.clear()
for alias in new_aliases:
    room.aliases.add(alias)

# Update echoes (restart ticker with new content)
room.stop_random_echoes()
room.db.echoes = new_echoes
room.start_random_echoes(interval=new_interval)
```

Crucially, this **never deletes rooms, moves players, or destroys NPCs**. It only updates attributes on existing objects.

### The Command Interface

We added `@dynspawn/hotreload` to the admin spawn commands:

```
@dynspawn/hotreload        # Preview changes
@dynspawn/hotreload/apply  # Apply changes
```

### Example Workflow

Let's walk through a real hot-reload session:

**1. Edit YAML File**

```yaml
# Change description
description: |
  An ugly narrow alley behind the Black Clinic opens into
  a makeshift training area. Concrete walls are scarred
  with bullet impacts and blade marks.

# Add new echo
echoes:
  - "The distant crack of gunfire echoes from deeper in the district."
  - "A piece of loose metal clangs against the wall in the wind."
  - "The neon warning sign flickers and buzzes."
  - "Footsteps echo from somewhere in the maze of alleys."  # NEW
```

**2. Preview Changes**

```
@dynspawn/hotreload

======================================================================
Area Hot-Reload Diff Summary
======================================================================
Area: Battle Ground
Content Key: area.battle_ground.main

Room Changes: (1 room affected)

Back Alley Training Ground
  Description:
    Old: A narrow alley behind the Black Clinic opens into ...
    New: An ugly narrow alley behind the Black Clinic opens...
  Echoes: 3 -> 4

Total changes:
  Spawn config: 0 fields
  AI config: 0 fields
  Rooms: 1 room
======================================================================

To apply these changes, use: @dynspawn/hotreload/apply
```

**3. Apply Changes**

```
@dynspawn/hotreload/apply

======================================================================
Applying Changes...
======================================================================
Updated description: Back Alley Training Ground
Updated echoes: Back Alley Training Ground

======================================================================
Hot-reload complete! Applied 2 changes.
======================================================================

Note: Changes are live immediately:
  - Room descriptions updated
  - Echoes restarted with new content/intervals
  - Details added/removed/modified
  - Spawn config updated for future spawns
  - AI config updated for new NPCs
```

**4. Verify**

```
look

Back Alley Training Ground
An ugly narrow alley behind the Black Clinic opens into a makeshift
training area. Concrete walls are scarred with bullet impacts and
blade marks. Someone has spray-painted target circles on the walls,
and discarded shell casings crunch underfoot. A flickering neon sign
reads "DANGER - ACTIVE COMBAT ZONE" in red kanji.

Footsteps echo from somewhere in the maze of alleys.
```

The description updated instantly. The new echo is already playing. Players in the room never moved. NPCs stayed put. No rebuild, no data loss.

**Total time: 5 seconds.**

## What Can Be Hot-Reloaded

The system supports hot-reloading:

### Room Content
- Descriptions
- Aliases
- Details (examine targets)
- Echoes (ambient messages)
- Echo intervals

### Spawn Configuration
- Max population
- Threat distribution (tier weights)
- Level ranges
- Spawn intervals and cooldowns
- Room-specific spawn bias

### AI Configuration
- Roaming behavior (roam_chance)
- Idle duration ranges
- Roam cooldowns
- Max enemies per room

### What Requires Rebuild

Some changes are structural and need a full rebuild:
- Adding/removing rooms
- Changing exit connections
- Renaming rooms
- Fixed NPC changes (detected but require manual spawn/delete)

For these, we still have `@dynspawn/rebuild`, but now it's for structural changes only. Content changes use hot-reload.

## The Technical Challenges

Building hot-reload required solving several non-trivial problems:

### Challenge 1: Detecting Differences Accurately

Comparing nested YAML structures against database attributes isn't straightforward. Consider spawn configuration:

```yaml
# YAML
threat_distribution:
  tier_1_weight: 80
  tier_2_weight: 20
  tier_3_weight: 0
```

```python
# Database
anchor_room.db.threat_distribution = {
    'tier_1_weight': 80,
    'tier_2_weight': 20,
    'tier_3_weight': 0
}
```

Looks identical, but Python dictionaries can have ordering differences, None vs missing keys, and int vs float issues. We needed deep comparison logic that handles these edge cases.

### Challenge 2: Applying Changes Safely

Some updates have side effects. Changing echo intervals requires:
1. Stop the current echo ticker
2. Update the interval in the database
3. Restart the ticker with new interval

If you just update the interval without restarting the ticker, nothing changes. If you restart without checking if echoes are active, you create orphaned tickers.

We implemented state-aware updates:

```python
# Update echo interval
if 'echo_interval' in room_diffs:
    room.db.echo_interval = new_interval

    # Only restart if echoes are active
    if getattr(room.db, 'echoes', []):
        if hasattr(room, 'stop_random_echoes'):
            room.stop_random_echoes()
        room.start_random_echoes(interval=new_interval)
```

### Challenge 3: Content Key Consistency

For hot-reload to work, database objects need accurate content keys. But what if:
- An area was built before content keys existed?
- Someone manually creates a room without a content key?
- The YAML file is renamed/moved?

We handle these gracefully:

```python
differ = get_area_differ(room)

if not differ:
    msg("This room is not part of an area spawn system.")
    msg("Hot-reload only works for areas built with YAML configuration.")
    return

if not differ.area_content_key:
    msg("Room has no area_content_key attribute.")
    msg("The area needs to be rebuilt with the updated build script.")
    return
```

Clear error messages guide users to the solution.

### Challenge 4: Fixed NPC Changes

Fixed NPCs (bosses, unique encounters) are spawned by the build script, not the spawn manager. When their configuration changes in YAML, hot-reload can detect the changes but can't safely auto-apply them:

- **Adding a fixed NPC**: Requires spawning it with proper configuration
- **Removing a fixed NPC**: Requires deleting the existing one
- **Modifying a fixed NPC**: Requires updating stats, which may affect active combat

We made a design decision: **Hot-reload detects NPC changes but doesn't auto-apply them.**

Instead, it warns the user:

```
Warning: Toxic Waste Pit has 1 new fixed NPCs in YAML
  You must manually spawn these or run a full rebuild
```

This keeps hot-reload safe and predictable. For NPC changes, use `@dynspawn/rebuild`.

## The Diff Display Challenge

Early versions of hot-reload showed diffs like this:

```
Description changed.
Echoes changed.
Spawn config changed.
```

Useless. What changed? What are the old vs new values?

We needed git-style diffs that show exactly what's changing:

```
Back Alley Training Ground
  Description:
    Old: A narrow alley behind the Black Clinic opens into ...
    New: An ugly narrow alley behind the Black Clinic opens...

  Echoes: 3 -> 4

  Details: 2 changes
    + fumes (added)
    ~ pool (modified)
```

For long descriptions, we truncate with ellipses. For lists, we show counts. For nested dicts, we recurse and show field-by-field changes.

The result is clear, scannable output that tells you exactly what will change before you apply it.

## Integration with the Build Pipeline

Hot-reload doesn't replace build scripts - it augments them.

### When to Build

Use build scripts when:
- Creating new areas
- Adding/removing rooms
- Changing exit connections
- Restructuring spawn systems
- Setting up initial configuration

The build script runs once, creates the structure, and sets content keys.

### When to Hot-Reload

Use hot-reload when:
- Polishing descriptions
- Adjusting ambient echoes
- Tuning spawn rates
- Balancing threat distribution
- Tweaking AI behavior
- Adding/updating examine details

Hot-reload is for iteration, refinement, and content updates.

### The Workflow

1. **Initial build**: `@py exec(open('world/batch/build_battle_ground_inline.py').read())`
2. **Test area**: Players explore, combat happens, spawns activate
3. **Edit content**: Adjust descriptions, echoes, spawn config in YAML
4. **Hot-reload**: `@dynspawn/hotreload/apply`
5. **Verify**: Check that changes appear correctly
6. **Repeat 3-5**: Iterate rapidly without rebuilding

This workflow enables **rapid iteration on live content** without disrupting players.

## What This Means for Development Velocity

Let's quantify the impact:

### Before YAML + Hot-Reload
**Fixing a typo:**
- Edit build script (Python)
- Test script syntax
- Run rebuild (destroys area)
- Move players to safety
- Verify NPCs respawned correctly
- Check spawn config still works
- **Time:** 5-10 minutes
- **Risk:** High (can break spawns, lose NPCs)

**Adjusting spawn balance:**
- Edit spawn config in build script
- Run rebuild
- Wait for NPCs to spawn
- Test spawn rates
- Repeat
- **Time:** 15-20 minutes per iteration
- **Iterations:** 3-5 to dial in balance
- **Total:** 1-2 hours

### After YAML + Hot-Reload
**Fixing a typo:**
- Edit YAML file
- `@dynspawn/hotreload/apply`
- **Time:** 5 seconds
- **Risk:** Zero

**Adjusting spawn balance:**
- Edit spawn config in YAML
- `@dynspawn/hotreload/apply`
- Observe for 60 seconds
- Repeat
- **Time:** 1-2 minutes per iteration
- **Iterations:** As many as needed
- **Total:** 5-10 minutes

**Development velocity increased by ~10-20x for content iteration.**

## Real-World Impact: Battle Ground Tuning

When we first deployed the Battle Ground area, spawn rates were too aggressive. NPCs spawned too fast, creating overwhelming encounters for new players.

**Old workflow:**
1. Get player feedback about spawn rates
2. Schedule maintenance window
3. Edit build script
4. Rebuild area (displacing active players)
5. Monitor for 30 minutes
6. Find balance still wrong
7. Schedule another maintenance window
8. Repeat

**New workflow:**
1. Get player feedback
2. Edit YAML spawn config
3. `@dynspawn/hotreload/apply` (players don't even notice)
4. Monitor for 5 minutes
5. Adjust again if needed
6. Done

We tuned spawn rates from "overwhelming" to "balanced" in **15 minutes** with **zero player disruption**. Players were fighting NPCs the whole time, not even aware the world was being edited around them.

This is the power of hot-reload.

## Lessons Learned

### 1. Separation of Concerns Is Worth It

Separating content from code felt like extra work initially. Why not just hard-code descriptions in the build script?

The payoff became clear immediately:
- Writers work in YAML without learning Python
- Content diffs are clean and reviewable
- Hot-reload becomes possible
- Content can be used by multiple systems

The upfront investment in architecture paid massive dividends.

### 2. Preview Before Apply

Early versions of hot-reload just applied changes immediately. This caused problems when:
- Someone edited the wrong file
- YAML syntax was invalid
- Changes were more extensive than expected

Adding the preview step (`@dynspawn/hotreload`) made the system much safer. You see exactly what will change before committing to it.

### 3. Clear Error Messages Save Time

When hot-reload fails, it needs to explain why:
- "Room has no content key" → Rebuild with updated build script
- "No YAML config found" → Check file path and YAML ID
- "Content key doesn't match" → Verify content_key attribute

Good error messages turn confusion into action.

### 4. Not Everything Should Be Hot-Reloadable

We initially tried to hot-reload everything, including:
- Adding rooms
- Changing exits
- Spawning fixed NPCs

This added massive complexity for edge cases that rarely happen. We decided: **Hot-reload is for content updates, rebuild is for structural changes.**

This simplification made the system more reliable and easier to understand.

## Future Enhancements

Several improvements are on the horizon:

### Content Validation
Pre-validate YAML before applying:
- Syntax checking
- Required field validation
- Cross-reference checking (exits point to real rooms)

This prevents applying broken configuration.

### Rollback Support
Store the previous state before applying changes:
- One-command rollback if something goes wrong
- Version history for auditing
- Ability to preview rollback before executing

### Multi-Area Operations
Hot-reload multiple areas at once:
- Update all areas in one operation
- Batch changes during maintenance
- Coordinate changes across related areas

### Content Pipeline Integration
Integrate with external content tools:
- Export YAML to Google Docs for writers
- Import edited content back to YAML
- Track review status and approvals

## The Technical Achievement

What we've built is more than a content management system - it's a complete development workflow transformation:

**Before:**
- Content changes require code edits
- Iteration is slow and risky
- Writers depend on developers
- Player disruption is inevitable
- Testing changes is expensive

**After:**
- Content lives in YAML files
- Hot-reload applies changes in seconds
- Writers work independently
- Players never notice updates
- Rapid iteration is the default

This is the infrastructure that enables continuous content improvement on a live game.

## A Living, Breathing World

The YAML content system and hot-reload represent a fundamental shift in how we think about world building.

Traditional MUD development treats the world as static: you build it, deploy it, and changes are rare, risky events. Players explore a frozen snapshot that only updates during major patches.

With hot-reload, the world becomes **continuously editable**. Descriptions can be polished. Echoes can be refined. Spawn rates can be tuned. Balance can be adjusted. All while players explore, combat happens, and the game stays live.

This is the infrastructure that makes Chatsubo feel like a living world. Because it literally is - we're editing it in real-time as players experience it.

The next time you visit the Battle Ground and notice that room descriptions have been refined, echoes have new variety, or spawn rates feel perfectly tuned - that's hot-reload at work. The world is being written around you, improving continuously, never stopping.

---

*Want to see hot-reload in action? Join us in Chatsubo MUD and explore the Battle Ground. Then check back in a week - the descriptions might be even better.*
