---
layout: post
title: "Why We've Been Quiet"
date: 2026-02-13 16:47:00 -0600
author: mauvehed
categories: [community]
tags: [personal, mental-health, community, open-development]
excerpt: "An honest update on where we've been, what happened, and what Chatsubo needs to move forward."
---

# Why We've Been Quiet

The last post on this blog was December 1st. It's now mid-February. Two and a half months of silence from a project that was posting regular development updates. If you've been following along, you probably noticed. If you're new here, now you know.

This isn't a technical post. There are no code snippets, no system breakdowns, no architecture diagrams. This is a personal one. For the first time, I'm writing as myself - mauvehed - rather than as "Development Team." Because the reason for the silence is personal, and I think it deserves honesty rather than a vague "life got busy" handwave.

## What Happened

I spent most of December and January dealing with depression. That's the whole explanation, really. There's no dramatic story behind it, no single triggering event. Depression showed up, settled in, and made everything feel impossibly heavy for weeks.

I want to be straightforward about this because I think it matters. Open source projects, indie games, passion projects - they're built by people, and people sometimes struggle. The instinct is to go quiet, come back later, and pretend it was just a busy period. I'd rather not do that. Depression is common, it's not a character flaw, and treating it like something shameful only makes it harder for everyone who deals with it.

Depression doesn't care about your project roadmap. It doesn't care about your community commitments or your ambitious feature plans. It just takes your energy, your focus, and your ability to care about things you normally care deeply about. For roughly two months, I couldn't write code, couldn't write content, couldn't engage with the community in any meaningful way. The project was fully paused. Not on a slow burn - completely stopped.

I didn't start feeling better until mid-to-late January. Recovery isn't a switch you flip. It's slow, uneven, and fragile for a while. But I'm here now, writing this, which is itself a sign that things have shifted.

## The People Who Showed Up

Here's the part that genuinely gets to me. While I was absent, people stuck around. Testers who had joined the project kept checking in. Community members stayed in the Discord. People who had invested their time into testing an early alpha of a cyberpunk MUD - built by someone they'd mostly interacted with through commit messages and dev blog posts - didn't walk away when that someone went quiet.

That means more than I know how to express without sounding performative, so I'll keep it simple: thank you. To everyone who tested, who reported bugs, who offered encouragement, who stayed - you kept this community alive when I couldn't. I owe you a genuine debt of gratitude, and I won't forget it.

You're the reason this post exists instead of a quiet archive of a project that faded out.

## The Hard Truth

Now for the part that's been on my mind since I started feeling better. The part I've been avoiding because it means admitting something uncomfortable.

One person cannot be both lead developer and lead writer. Not sustainably. Not at the level this project needs.

The development work - building features, designing systems, maintaining infrastructure, fixing bugs, architecting the codebase - is a full-time effort. Every system you've read about on this blog (combat, quests, NPCs, dialogue, hot-reload, the YAML content pipeline) represents weeks of focused engineering. That work isn't done. There's more to build.

But content work is also a full-time effort. Room descriptions, atmospheric text, NPC dialogue, quest narratives, zone design, environmental storytelling, lore, faction histories - building a world that feels alive and coherent requires the same depth of sustained creative energy that building the engine does. These are fundamentally different skills and different kinds of creative work. Being good at one doesn't make you good at the other, and trying to do both means doing neither well.

Right now, the engine runs. The tools exist. The YAML content system lets writers create rooms, NPCs, dialogue, and quests without touching code. Hot-reload means content goes live in seconds. The technical infrastructure is waiting. But the world is largely empty, because the one person building this project has been spending all available energy on the systems rather than the stories. And then spent two months unable to do either.

The only solo alternative is alternating - a month of development, then a month of writing, back and forth. But that pace slows everything to a crawl and risks losing the community momentum that's been so hard to build.

## What Chatsubo Needs

I'll be direct: **Chatsubo needs a lead writer and world builder.** Someone who can own the story and the world the way I own the code. Someone who gets excited about building a cyberpunk setting from the inside out - not just the big lore beats, but the small details that make a street corner feel real.

Without this role filled, the project cannot reach a proper release. This is the bottleneck. Full stop.

Beyond that central need, any creative contribution helps. Specific roles that would make a real difference:

- **Writers** - Room descriptions, atmospheric text, NPC dialogue, quest narratives. The voice of Night City.
- **World builders** - Zone design, room layouts, area connections, environmental storytelling. The geography and feel of the sprawl.
- **Quest designers** - Story arcs, quest chains, branching narratives, meaningful objectives. The reasons players explore.
- **Lore contributors** - Backstory, faction histories, world-building documents. The depth beneath the surface.

But I want to be honest about this too: without someone willing to take on the lead creative role - to provide vision and coherence - individual contributions stay fragmented. A room here, a quest there, but no unified world. The sprawl needs a creative director as much as it needs a technical one.

You don't need to be a programmer. The YAML content system was specifically designed so that writers can work without writing code. You edit text files, the game loads them automatically, and you can see your work in-game within seconds. If you can write compelling prose and think spatially about interconnected places, you have every skill you need.

This is a genuine open invitation. Not a corporate recruiting pitch, not a call for unpaid labor on someone else's vision. This is an open-source passion project that needs more passionate people to become what it could be.

## Where Things Stand

The foundation is solid. Everything described in previous blog posts works: combat, leveling, NPCs with schedules and dialogue, the quest system, hot-reload content, three-tier scaling. The engine is real and functional. If you telnet in today, you can create a character, explore, fight, and interact with NPCs.

What's built is the machine. What's empty is the world it's meant to run. The streets of Night City need stories, characters, atmosphere, and purpose. The technical infrastructure is ready and waiting for content to fill it.

## Moving Forward

I'm not going to pretend the last two months didn't happen or promise it won't happen again. What I can say is that I'm back, I'm working, and I'm committed to being honest about this project - its progress, its struggles, and its needs.

I can't keep Chatsubo alive alone. But I'm not ready to give up on it. If this project resonates with you - if you've ever wanted to help build a cyberpunk world from the ground up, with real tools and a real community - reach out. Join the [Discord](https://discord.gg/aD3eRKpb6h). Send me a message. Tell me what you'd want to build.

The sprawl needs more than one person to build it. Let's find out who else wants to try.

 --  mauvehed