---
layout: post
title: "Building the Foundation: The Three-Tier Scaling System"
date: 2025-10-16 23:00:00 -0500
categories: [development, progression, combat, scaling]
tags: [mud, evennia, game-design, balance, leveling, npcs]
author: Development Team
excerpt: "How we built a centralized scaling system that makes progression feel rewarding from level 1 to 50, integrated dynamic area-based spawning, and created a minimal leveling system that keeps combat meaningful - all while preparing for the comprehensive Leveling System to come."
---

# Building the Foundation: The Three-Tier Scaling System

There's a fundamental tension in RPG design: you want players to feel more powerful as they level up, but you also want combat to stay engaging. Give them linear stat growth and high-level content becomes tedious. Give them exponential growth and they trivialize everything. Traditional MMOs solve this by making leveling progressively slower - at level 50, you're grinding for hours just to see that XP bar creep forward.

We decided to solve it differently.

The Three-Tier Scaling System isn't just about enemy difficulty tiers. It's a complete rethinking of how progression, combat, and spawning systems work together. At its heart is a deceptively simple idea: **what if leveling got *faster* instead of slower?**

This post chronicles our journey from concept to implementation, the mathematical foundations that make it work, and the integrated systems that bring it all together.

## The Problem We're Solving

When we started designing Chatsubo's combat progression, we identified several problems with traditional RPG scaling:

### Problem 1: The Grind Wall
Traditional power law scaling (exponential growth) creates a "grind wall" at high levels. You're killing the same enemies over and over, watching tiny percentages tick up on your XP bar. It feels like punishment for reaching endgame.

### Problem 2: Inconsistent Challenge
Without centralized scaling, different systems implement their own math. Enemy HP grows at one rate, player damage at another, XP requirements at yet another. The result? Progression feels broken at certain level ranges - too easy here, impossibly hard there.

### Problem 3: Meaningless Numbers
Some games avoid big numbers to keep combat "grounded." Others embrace billion-damage crits. But both miss the opportunity to make numbers *mean* something. We wanted epic endgame numbers that still represented the same proportional challenge.

### Problem 4: Static Spawning
Traditional spawn systems put enemies in fixed locations. You clear a room, it respawns. But with roaming NPCs, this creates population explosions. A room spawns 5 enemies, they roam to other rooms, the room thinks it's empty and spawns 5 more. Repeat until the server melts.

## The Solution: Centralized Power Law Scaling

Everything begins with `utils/scaling.py` - a single file that defines how *all* progression works in Chatsubo. Every combat stat, every XP calculation, every level requirement flows through this module.

### The Math That Makes It Work

We use two different power law exponents for two different purposes:

**Combat Scaling: level^1.5**
```python
def combat_scale(base_value, level):
    """Scale HP, damage, and XP rewards."""
    scaling_factor = level ** 1.5
    return int(base_value * scaling_factor)
```

This creates dramatic power growth. A level 50 player deals **353x** the damage of a level 1 player. Enemy HP scales identically, maintaining consistent "attacks to kill" ratios.

**Progression Scaling: level^1.3**
```python
def progression_scale(base_value, level):
    """Scale XP requirements to level up."""
    scaling_factor = level ** 1.3
    return int(base_value * scaling_factor)
```

This grows *slower* than combat power. XP requirements only scale **185x** from level 1 to 50.

### The Magic: Accelerating Progression

Here's where it gets interesting. Because combat power grows faster than XP requirements, high-level players level **1.9x faster** than low-level players relative to their power.

At level 1, you deal 5 damage and need 100 XP to level up.
At level 50, you deal 1,942 damage and need 18,478 XP to level up.

That sounds like more XP is required. But the enemies you're fighting at level 50 give **353x more XP** than level 1 enemies. You're killing them in the *same number of hits* but getting massively more XP per kill.

Result: **Leveling feels progressively faster, not slower.**

No daily XP caps needed. No artificial gates. The math just works.

## Three Tiers of Challenge

Every enemy in Chatsubo belongs to one of three tiers, each calibrated for a specific number of attacks to kill:

**Tier 1: Tutorial Enemies (3-4 attacks)**
- Street trash, burnt junkies, weak gangers
- 18 base HP at level 1
- 30 base XP reward
- Quick encounters, low threat

**Tier 2: Standard Enemies (5-7 attacks)**
- Gangers, thugs, enforcers
- 35 base HP at level 1
- 100 base XP reward
- Main combat experience

**Tier 3: Boss Enemies (10-14 attacks)**
- Cyber-psychos, security bots, gang leaders
- 68 base HP at level 1
- 300 base XP reward
- Epic encounters, high reward

These ratios stay consistent across all 50 levels because *everything* scales with level^1.5. A level 25 Tier 3 boss still takes 10-14 attacks, even though it has 8,500 HP and you're dealing 253 damage per hit.

## Level Difference Scaling: Anti-Farming and Anti-Power-Leveling

We implemented a hard cutoff system that prevents both farming trivial content and power-leveling friends:

```python
def apply_level_difference_scaling(base_xp, enemy_level, player_level):
    level_diff = enemy_level - player_level

    # Hard cutoff: must be within +/- 5 levels
    if abs(level_diff) > 5:
        return 0

    # Within range: 10% change per level difference
    scaling_factor = 1.0 + (level_diff * 0.1)
    return int(base_xp * scaling_factor)
```

**Enemies must be within +/- 5 levels. Outside this range = 0 XP.**

Real examples:
- Level 10 player vs Level 10 enemy: **Full XP** (appropriate challenge)
- Level 10 player vs Level 15 enemy: **150% XP** (risky but rewarding!)
- Level 10 player vs Level 16+ enemy: **0 XP** (too dangerous, exploit prevention)
- Level 10 player vs Level 4- enemy: **0 XP** (trivial, no reward)
- Level 50 player vs Level 1 enemy: **0 XP** (no power-leveling friends)

This prevents high-level players from dragging low-level friends through endgame content for easy XP, while still allowing some flexibility for groups with mixed levels.

## Area-Based Dynamic Spawning

The Three-Tier System needed intelligent spawning that works with roaming NPCs. We built an area-based spawn manager that solves the population explosion problem.

### How It Works

Instead of each room spawning independently, one spawn manager controls an entire area:

```yaml
# Area configuration example
area: battle_ground
max_population: 8
spawn_rooms:
  - /rooms/battle_ground/alley_01
  - /rooms/battle_ground/alley_02
  - /rooms/battle_ground/container_maze_01
restricted_rooms:
  - /rooms/battle_ground/boss_chamber
threat_distribution:
  tier_1: 0.50  # 50% Tier 1 spawns
  tier_2: 0.35  # 35% Tier 2 spawns
  tier_3: 0.15  # 15% Tier 3 spawns
```

The system:
1. Tracks total population across ALL rooms in the area
2. Only counts *living* NPCs (health > 0)
3. Spawns at random spawn points when below max_population
4. Prevents roaming NPCs from entering restricted rooms (boss chambers stay clear)
5. Supports per-room spawn bias to override area defaults

NPCs can roam freely within the area, and the system maintains balanced population without explosions.

### Fixed NPC vs Roaming NPCs

We implemented two distinct NPC types:

**Roaming NPCs:**
- Spawn at random spawn points
- Can move between rooms in the area
- Count toward area max_population
- Respawn when the population dips

**Fixed NPCs (Bosses):**
- Spawn at specific locations
- Optional `unique: true` flag (only one exists game-wide)
- Optional `can_roam: false` flag (stays in spawn room)
- Independent respawn system
- Don't count toward population limits

This lets us have 8 roaming gangers in Battle Ground plus a unique boss that respawns 30 minutes after defeat.

## YAML Integration: Content-Driven Configuration

All enemy templates and spawn configurations are defined in YAML files, completely separate from code:

```yaml
# enemies/tier2/street_ganger.yaml
id: enemy.tier2.street_ganger
name: "Street Ganger"
tier: 2
name_variants:
  - "Street Ganger"
  - "Fresh Ganger"
  - "Rogue Ganger"
description: |
  A rough-looking street fighter with a cybernetic arm
  and a bad attitude. Clearly looking for trouble.
combat_messages:
  on_spawn: "{name} notices you and growls menacingly!"
  on_attack:
    - "{name} throws a wild punch!"
    - "{name} attempts a roundhouse kick!"
ai_config:
  aggressive: true
  flee_threshold: 0.3
```

The spawn system loads these templates and creates NPCs with properly scaled stats based on tier and area level. Writers can create new enemies without touching code.

## Integration with Future Systems

Everything we've built is designed to integrate seamlessly with planned systems:

### Leveling System Integration
The comprehensive Leveling System will:
- Replace automatic stat increases with attribute point allocation
- Add 24 skills across 4 categories
- Implement 5 character roles with specializations
- Use the same `utils/scaling.py` for all calculations

Our implementation uses the same XP tracking and level-up hooks, making migration straightforward.

### Skill System Integration (Designed, Not Built)
We've already solved the "skill damage bonus problem" in our design:

Skills will add flat damage bonuses (not percentages). To prevent trivializing content, enemy HP includes 50% skill compensation:

```python
def get_enemy_hp(tier, level):
    base_hp = {1: 18, 2: 35, 3: 68}[tier]

    # Assume players have 50% of expected skill for their level
    expected_skill = get_expected_skill_for_level(level)
    skill_compensation = 1.0 + (expected_skill * 0.05)

    adjusted_base = int(base_hp * skill_compensation)
    return combat_scale(adjusted_base, level)
```

This ensures:
- Unskilled players find combat challenging but fair (15% more attacks than ideal)
- Average players hit the target "attacks to kill" ratios
- High-skill players feel rewarded with faster clears (15% fewer attacks)

### Quest System Integration
The quest system is ready for enemy kill objectives:
```yaml
objectives:
  - type: kill_enemies
    tier: 2
    count: 5
    description: "Defeat 5 Tier 2 enemies"
```

We just need to add the hook in combat_handler.py to notify the quest system when enemies die.

## What We've Accomplished

Let's take stock of where we are:

**Phase 1: Centralized Scaling ✅**
- Created `utils/scaling.py` with level^1.5 combat scaling
- Implemented level^1.3 progression scaling
- All systems use centralized formulas

**Phase 2: Dynamic Area-Based Spawning ✅**
- Area spawn managers prevent population explosions
- Roaming NPCs work correctly with spawn limits
- Fixed NPCs for bosses and unique encounters
- YAML-driven configuration for all spawns

**Phase 4: Minimal Player Leveling ✅**
- XP awarded from combat using proper scaling
- Level-up system with stat increases
- Character sheet with progress visualization
- XP overflow and multiple level-ups handled correctly

**Integration Points Defined:**
- Health regeneration rates coordinated with combat pacing
- Skill system integration designed (Hybrid 50% compensation)
- Quest system ready for kill objective tracking
- Equipment/loot system requirements documented

## The Numbers Tell the Story

Here's what progression looks like with everything integrated:

**Level 1 Player:**
- 100 max HP
- 5.5 average damage
- Needs 1,000 XP to reach level 2
- Tier 1 enemy gives 30 XP (~30-35 kills to level)
- Tier 2 enemy gives 100 XP (~10 kills to level)
- Tier 3 enemy gives 300 XP (~3-4 kills to level)

**Level 10 Player:**
- 190 max HP
- 66.7 average damage
- Needs 19,950 XP to reach level 11
- Tier 1 enemy gives 949 XP (~20-25 kills to level)
- Tier 2 enemy gives 3,162 XP (~6-7 kills to level)
- Tier 3 enemy gives 9,480 XP (~2-3 kills to level)

**Level 25 Player:**
- 340 max HP
- 253.5 average damage
- Needs 65,720 XP to reach level 26
- Tier 1 enemy gives 3,750 XP (~17-18 kills to level)
- Tier 2 enemy gives 12,475 XP (~5-6 kills to level)
- Tier 3 enemy gives 37,500 XP (~2 kills to level)

**Level 50 Player:**
- 590 max HP
- 710.5 average damage
- MAX LEVEL REACHED
- Tier 1 enemy gives 10,590 XP
- Tier 2 enemy gives 35,300 XP
- Tier 3 enemy gives 105,900 XP

The key insight: Because combat power (level^1.5) grows faster than XP requirements (level^1.3), the kills-per-level actually *decreases* as you progress. At level 1, you need ~10 Tier 2 kills to level up. At level 25, you need ~5-6 Tier 2 kills. This creates a satisfying sense of accelerating progression - you're getting more powerful *and* leveling faster.

## Lessons Learned

Building the Three-Tier System taught us several crucial lessons:

### 1. Centralization Is Critical
Having `utils/scaling.py` as the single source of truth for all scaling math was the best decision we made. When we need to adjust balance, we change one exponent and the entire game adjusts proportionally.

### 2. Power Law > Linear
Linear scaling feels flat. Exponential scaling creates grind walls. Power law (level^1.5) creates satisfying growth that stays balanced.

### 3. Different Exponents for Different Purposes
Using level^1.5 for combat and level^1.3 for progression creates accelerating advancement without breaking balance.

### 4. Area-Based Spawning Is Essential
Per-room spawning doesn't work with roaming NPCs. Area-based management solves population control elegantly.

### 5. Build Integration Points First
We documented how skills, quests, and equipment will integrate *before* those systems exist. When we build them, they'll slot right in.

## What's Next

With the foundation complete, we're ready for the next phases:

**Phase 3: YAML Enemy Templates** (In Progress)
- Rich enemy descriptions and lore
- Varied combat messages
- Personality-driven AI behaviors

**Phase 5: Health Regeneration** (Integration Needed)
- Update regen rates to match combat pacing
- 10-second combat delay before regeneration
- 36 HP/min out-of-combat healing

**Phase 7: Loot System** (Design Phase)
- Tier-based item drops
- Healing items from combat
- Equipment that enhances progression

**Comprehensive Leveling System** (Design Phase)
- 6 primary attributes
- 24 skills across 4 categories
- 5 character roles with specializations
- Builds on Phase 4's XP/level foundation

## The Foundation Is Strong

The Three-Tier Scaling System isn't just about combat balance - it's a complete framework for progression that makes numbers meaningful, leveling rewarding, and endgame exciting.

We've built a system where:
- A level 1 player can understand the tiers and make tactical decisions
- A level 25 player feels dramatically more powerful while facing proportional challenges
- A level 50 player sees epic numbers that still represent balanced gameplay
- The entire journey from 1-50 takes 20-25 hours of gameplay, with leveling *accelerating* instead of grinding to a halt

And perhaps most importantly, we've built it in a way that integrates cleanly with every system we're planning. The comprehensive Leveling System, when it arrives, will slot right into the XP framework we've built. The skill system will use the damage formulas we've designed. The loot system will use the tier classifications we've established.

The foundation is strong. Now we build upward.

---

*Want to try it yourself? Join us in Chatsubo MUD and fight your way through the Battle Ground. Experience firsthand how power law scaling makes progression feel rewarding from your first ganger to your fiftieth boss fight.*
