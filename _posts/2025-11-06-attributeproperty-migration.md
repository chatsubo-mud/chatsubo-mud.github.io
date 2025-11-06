---
layout: post
title: "Zero Database Queries: The Great AttributeProperty Migration"
date: 2025-11-06 07:00:00 -0500
categories: [architecture]
tags: [mud, evennia, database, optimization, refactoring]
author: Development Team
excerpt: "How we eliminated 90% of database queries and solved cache invalidation by deleting four Django models and rebuilding our entire character progression system."
---

## The Problem: When Players Level Up, But Nobody Notices

Imagine you're playing Chatsubo, grinding through combat encounters, finally earning enough XP to hit level 5. You level up, see the confirmation message, and eagerly type `who` to show off your new level to other players.

The command shows you at level 4.

You try again. Still level 4. You log out and back in. Now it shows level 5.

This was Issue #188, and it revealed a fundamental architectural problem that would require one of the most comprehensive refactoring efforts in Chatsubo's development history.

## The Root Cause: Fighting the Framework

The cache invalidation bug traced back to a decision made early in Chatsubo's development: implementing character progression using Django models instead of Evennia's native attribute system.

We had created four custom Django models:
- `CharacterProgression` - Level, XP, role
- `CharacterAttributes` - Intelligence, Reflexes, Cool, etc.
- `CharacterSkills` - 24 skills with levels and XP
- `InstalledCyberware` - Cyberware installations and status

On the surface, this seemed reasonable. Django's ORM is powerful, and these models had proper foreign keys, migrations, and schema validation. What could go wrong?

**Everything**, as it turns out.

### The Django ORM Cache Problem

Django's ORM aggressively caches related objects. When you access `character.progression`, Django loads the `CharacterProgression` object and caches it. Future accesses return the cached version, even if the database has changed.

In a traditional web application with request/response cycles, this is fine - each request gets a fresh cache. But Evennia is a persistent server where character objects live in memory for hours or days. The Django ORM cache becomes stale, and manual cache invalidation is error-prone and incomplete.

### The Performance Problem

Every access to progression data required database queries:
- Check character level: 1 query
- Get character attributes: 1-2 queries
- Look up skills: 1+ queries
- Check cyberware status: 1-2 queries

In combat, where we check health, level, and attributes constantly, this meant 5-10 database queries per attack. With 50 NPCs fighting across multiple rooms, that's 250+ queries per combat round.

### The Evennia Way

When we reported the cache invalidation issue, the Evennia developers pointed us to the right path:

> "It is rarely a good idea or needed to write a custom model vs. using Attributes. The attributes system is designed specifically to be able to smoothly handle data that is:
> - attached to a specific typeclassed entity
> - not useful without the context of the owner entity
> - potentially storing references to other typeclassed entities"

The message was clear: we were fighting the framework. Evennia's `AttributeProperty` system was designed exactly for this use case, with automatic cache invalidation and zero query overhead.

## The Decision: Delete Everything and Start Over

We had a choice:
1. Try to patch the cache invalidation with manual refreshes
2. Completely migrate to `AttributeProperty` and delete the Django models

Option 1 was tempting - less work, less risk. But it would leave us with:
- Ongoing performance problems
- Brittle cache invalidation logic
- Architecture fighting against Evennia's design
- Technical debt compounding over time

We chose option 2. Complete migration. No backward compatibility wrappers. Delete the old code entirely.

## What is AttributeProperty?

Before we dive into the migration, let's understand what we were migrating to.

**Before (Django Model)**:
```python
class CharacterProgression(models.Model):
    character = models.OneToOneField(Character)
    level = models.IntegerField(default=1)
    current_xp = models.IntegerField(default=0)
    # Every access = database query
    # ORM caching causes stale data
```

**After (AttributeProperty)**:
```python
# In the Character typeclass
progression_data = AttributeProperty(default=dict, autocreate=True)
# Stores: {'level': 1, 'current_xp': 0, 'total_xp_earned': 0}
# Zero database queries (cached in memory)
# Evennia handles cache invalidation automatically
```

`AttributeProperty` is Evennia's system for storing structured data on game objects. It:
- Stores data in Evennia's attribute table (one row per attribute)
- Caches in memory with automatic invalidation
- Requires zero database queries for reads
- Persists automatically on writes
- Integrates perfectly with Evennia's typeclass system

### The New Architecture: 6 Properties Replace 4 Models

We designed six `AttributeProperty` properties to replace our Django models:

1. **progression_data** - Replaces CharacterProgression
   - `{'level': 1, 'current_xp': 0, 'total_xp_earned': 0, 'xp_phase': 1, 'role_key': 'solo'}`

2. **base_attributes** - Replaces CharacterAttributes
   - `{'intelligence': 3, 'reflexes': 3, 'cool': 3, 'technical_ability': 3, 'body': 3, 'empathy': 3}`

3. **skills_data** - Replaces CharacterSkills
   - `{'handguns': {'level': 2, 'xp': 15, 'specialization': ''}, ...}` (24 skills)

4. **installed_cyberware_data** - Replaces InstalledCyberware
   - `[{'item_id': 5, 'installed_at': '2025-01-15', 'is_active': True}, ...]`

5. **economic_data** - Replaces scattered `.db.credits` attributes
   - `{'nuyen': 10000, 'lifetime_earned': 50000, 'lifetime_spent': 40000}`

6. **health_data** - Replaces scattered `.db.health*` attributes
   - `{'current_hp': 100, 'max_hp': 100, 'edge': 3, 'mental_health': 100, 'cyberpsychosis': 0}`

### The Manager Pattern

To keep the code clean, we created specialized managers:

- **ProgressionManager** - XP and leveling logic
- **SkillManager** - Skill advancement
- **CyberwareManager** - Cyberware installation
- **EconomicManager** - NuYen/credits transactions
- **HealthManager** - HP, edge, mental health

Each manager operates on `AttributeProperty` data with zero database queries.

## The Implementation Sprint

We estimated a 10-phase migration. Reality was different.

Once we committed to the migration, momentum built. The vision was clear, the architecture was right, and the benefits were obvious.

### Phase 1-2: Foundation (November 3)

**Day 1: Schema and Tests**
- Defined all six `AttributeProperty` properties
- Added automatic migration logic to Character typeclass
- Created 36 unit tests covering all data structures
- Verified existing characters auto-migrate on access

The foundation was critical. We needed confidence that the new system worked before touching production code.

### Phase 3-5: Manager Refactoring (November 3-4)

**Day 2: Zero Query Managers**
- Refactored ProgressionManager: 0 queries (was 2-3 per operation)
- Refactored SkillManager: 0 queries (was 1+ per operation)
- Refactored CyberwareManager: 0 queries (was 1-2 per operation)

All managers now read and write directly to `AttributeProperty` data. No database round trips.

**Before**:
```python
# Every call hits the database
progression = character.progression  # 1 query
level = progression.level  # Cached, but stale
```

**After**:
```python
# Zero queries - reads from in-memory cache
data = character.progression_data  # AttributeProperty
level = data.get('level', 1)  # Direct dict access
```

### Phase 6-7: System Updates (November 4)

**Day 3: Touching 30+ Files**
- Updated 12 command files (level, xp, skills, cyberware, stats)
- Refactored combat handler (20+ references to progression/health)
- Updated quest system, tutorial, vendor system, admin tools
- Changed every reference from Django ORM to AttributeProperty

This was mechanical but critical. Every `character.progression.level` became `character.progression_data.get('level', 1)`.

### Phase 8: The Economic & Health Migration

This phase deserves special attention because it exemplified our "delete old code" philosophy.

**The Old Pattern**:
Scattered across the codebase were patterns like:
```python
character.db.credits = 5000
character.db.health = 100
character.db.max_health = 100
```

These were `.db` attributes - Evennia's untyped key-value storage. They worked, but they were:
- Inconsistent (sometimes `credits`, sometimes `nuyen`)
- Unstructured (no schema validation)
- Hard to track (scattered across 20+ files)

**The Migration**:
We created `EconomicManager` and `HealthManager`, added `economic_data` and `health_data` properties, and updated all 20 files.

**Critically, we did NOT do this**:
```python
# WRONG - Backward compatibility wrapper
@property
def credits(self):
    return self.db.credits or self.economic_data.get('nuyen', 0)
```

**We did this instead**:
1. Updated ALL references to use `EconomicManager`
2. Deleted ALL old `.db.credits` assignments
3. Let any missed references fail with clear errors

This is the "delete old code, don't preserve it" principle. Backward compatibility wrappers hide migration bugs. Clean deletion exposes them immediately.

### Phase 8.3-8.7: Django Model Deletion

**The Moment of Truth**

After all code was migrated, we deleted the Django models entirely:

- Migration 0009: Drop `characterprogression` table
- Migration 0010: Drop `characterattributes` table
- Migration 0011: Drop `characterskills` and `installedcyberware` tables

Four Django models, completely removed. No traces left except in git history.

**Why Delete Instead of Deprecate?**

1. **Single source of truth** - One way to access data, not multiple
2. **Force errors** - Missed migrations fail immediately, not silently
3. **Clean codebase** - No "legacy support" cruft
4. **Clear intent** - This is the new way, not an alternative

If we'd kept the models "for backward compatibility," we'd have:
- Dual code paths to maintain
- Uncertainty about which system to use
- Silent bugs where old code paths still worked but used stale data

Delete old code. Use git if you need history.

## The Bug Hunt: When Theory Meets Production

We deployed to production on November 5. Within hours, we found six critical bugs.

This wasn't a failure - it was the "delete old code" philosophy working as designed. Instead of silent stale data, we got loud crashes that pointed directly to missed migrations.

### Bug #1: Combat Death Crash

**The Error**:
```
KeyError: 'level'
Combat handler crashed when character died
```

**The Cause**:
```python
# Old pattern in combat_handler.py
level = getattr(character.db, 'level')  # Fails - no longer in .db
```

**The Fix**:
```python
# New pattern using helper for player/NPC compatibility
level = _get_attribute(character, 'level', 1)
```

We found and fixed six locations using the old pattern. Without deleting the old code, these would have silently used stale data forever.

### Bug #2: Spawn Manager Diagnostics

**The Error**:
```
TypeError: '>' not supported between 'NoneType' and int
Room enemy counting crashed
```

**The Cause**:
```python
# Incomplete migration in spawn_manager.py
if getattr(npc.db, "health", 0) > 0:  # Returns None, not 0
```

**The Fix**:
```python
# Use health manager method
if hasattr(npc, "get_health") and npc.get_health() > 0:
```

Found in two locations. Again, deletion forced the issue to surface.

### Bug #3: Hostile NPC Auto-Attack

**The Error**:
```
TypeError: '<=' not supported between 'NoneType' and int
Hostile NPC attack logic crashed
```

**The Cause**:
Two more locations in `hostile_utils.py` using old `.db.health` pattern.

**The Fix**:
Same health check pattern - use the manager, not direct attribute access.

### Bugs #4-6: Stale Attribute Access

Multiple edge cases where code still accessed:
- `.db.progression_data` instead of `.progression_data` (AttributeProperty vs .db attribute)
- Direct dictionary access without `.get()` fallbacks
- HealthManager method name mismatches

All fixed within hours of discovery. Each fix made the system more robust.

## The Results: Quantified Victory

After a few days of implementation and (so far) one day of bug fixes, the migration was complete. The results exceeded our expectations.

### Performance Impact

**Database Queries: 90%+ Reduction**
- Character progression access: 0 queries (was 2-3)
- Skill lookups: 0 queries (was 1+)
- Cyberware calculations: 0 queries (was 1-2)
- Health checks: 0 queries (was 1-2)
- Economic operations: 0 queries (was 1)

**Combat Performance**
- Before: 5-10 queries per attack
- After: 0 queries per attack
- At 50 NPCs fighting: 250+ queries/round eliminated

### Reliability Impact

**Cache Invalidation: 100% Resolved**
- Issue #188 (`who` command stale data): Fixed
- All progression updates immediately visible
- No manual cache refresh needed ever
- Evennia's automatic invalidation works perfectly

### Code Quality Impact

**Codebase Cleanliness**
- 4 Django models deleted
- 30+ files updated to single pattern
- 0 backward compatibility wrappers
- 1 source of truth for all character data

**Developer Experience**
- Clear patterns for accessing character data
- Manager classes encapsulate all logic
- Zero confusion about "which system to use"
- New features use AttributeProperty from day one

### Migration Velocity

**Why So Fast?**
1. **Clear vision** - We knew exactly what we were building
2. **Good architecture** - AttributeProperty fit our needs perfectly
3. **Delete old code** - No time wasted on backward compatibility
4. **Comprehensive tests** - 36 unit tests gave us confidence to move fast

## Lessons Learned: Engineering Philosophy

This migration taught us several key lessons that apply beyond this specific refactoring.

### 1. Framework Best Practices Exist for a Reason

When Evennia developers say "use AttributeProperty, not custom models," they mean it. They've built hundreds of MUDs and know the patterns that work.

We spent months fighting Django ORM caching because we thought we knew better. We didn't. The framework designers had already solved this problem.

**Lesson**: When framework documentation strongly recommends a pattern, especially for your specific use case, follow it. The creators have seen your problems before.

### 2. Delete Old Code, Don't Preserve It

The biggest risk in this migration was missing a reference to old code. Our strategy:
- Delete immediately, don't deprecate
- No backward compatibility wrappers
- Force compilation/runtime errors

This felt risky, but it worked perfectly. Every missed migration caused a loud, immediate crash that pointed directly to the problem. We fixed six bugs in production within hours - bugs that would have been silent data corruption with backward compatibility.

**Lesson**: Backward compatibility is not always a virtue. Sometimes, the best migration strategy is to delete the old system and let errors expose missed references.

### 3. Measure Impact with Real Numbers

We tracked exact metrics:
- Query counts before and after
- Timeline estimates vs. actuals
- Number of files touched
- Number of bugs found

This gave us concrete evidence of success and helped us learn where our estimates were wrong (we're faster than we think when the architecture is right).

**Lesson**: Quantify your improvements. "Better performance" is vague. "0 queries instead of 2-3" is concrete.

### 4. Momentum Matters

Once we committed fully to the migration, we built momentum. Each phase completed successfully gave us confidence for the next. The vision was clear, so decisions were fast. The tests passed, so we moved quickly.

Half-hearted migrations drag on forever. Full commitment creates momentum.

**Lesson**: When doing major refactoring, commit fully. Half-migrations create more problems than they solve.

### 5. Production Bugs Are Learning Opportunities

We found six bugs in production. We could have felt bad about this. Instead, we documented each one, understood the root cause, and used them to validate our "delete old code" approach.

Every bug was a place where backward compatibility would have hidden a problem. Every bug made the codebase stronger.

**Lesson**: Bugs found quickly in production (with good error messages) are better than bugs hidden by backward compatibility wrappers.

## The Future: Building on Solid Ground

The AttributeProperty migration wasn't just about fixing cache invalidation or improving performance. It was about building a solid architectural foundation for future development.

### What We Gained

**For Players**:
- No more stale data in commands
- Faster combat (though imperceptibly - we weren't slow before)
- More reliable progression system
- Better uptime (fewer database-related issues)

**For Developers**:
- Clear patterns for character data
- Zero-query managers for all operations
- Single source of truth - no confusion
- Confidence to build new systems the right way

### What's Next

With this foundation in place, we can now:
- Add new progression features without schema migrations
- Extend character data without touching the database
- Build new systems following the AttributeProperty pattern from day one
- Focus on gameplay instead of fighting framework issues

The migration was painful, but it was worth it. We now have an architecture that scales, performs, and aligns with Evennia's design philosophy.

## Conclusion: The Right Architecture Matters

The Great AttributeProperty Migration was one of the most comprehensive refactoring efforts in Chatsubo's history. We touched 30+ files, deleted four Django models, fixed six production bugs, and eliminated 90% of our database queries.

But the real victory wasn't the performance improvement or the bug fixes. It was the shift in architecture from fighting the framework to working with it.

Evennia's developers designed AttributeProperty for exactly our use case. By trusting their expertise and fully committing to their recommended pattern, we not only solved our immediate problems but also positioned ourselves for faster, more reliable development in the future.

When you find yourself fighting your framework, stop and ask: "Am I doing this the way the framework designers intended?" The answer might save you months of technical debt.

---

*For technical details on AttributeProperty, see the [Evennia documentation](https://www.evennia.com/docs/latest/Components/Attributes.html).*
