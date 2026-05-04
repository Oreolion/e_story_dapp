import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { safeCompare } from "@/lib/crypto";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/seed
 * Seeds the platform with sample public stories and featured profiles.
 * Protected by ADMIN_SECRET + strict rate limiting.
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 requests per hour per IP (admin endpoints are sensitive)
    const ip = getClientIp(req);
    const { allowed, remaining } = checkRateLimit(`admin:seed:${ip}`, 10, 60 * 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const authHeader = req.headers.get("authorization");
    const adminSecret = process.env.ADMIN_SECRET;

    if (!adminSecret || !authHeader || !safeCompare(authHeader, `Bearer ${adminSecret}`)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();

    // Check if seed data already exists
    const { count: existingStories } = await admin
      .from("stories")
      .select("*", { count: "exact", head: true })
      .eq("is_public", true);

    if (existingStories && existingStories >= 15) {
      return NextResponse.json({
        message: "Platform already has enough public stories. Skipping seed.",
        existingCount: existingStories,
      });
    }

    // Get the first admin/staff user to attribute stories to.
    // If none exists, we need at least one user in the system.
    const { data: staffUsers } = await admin
      .from("users")
      .select("id, name, username")
      .eq("is_onboarded", true)
      .order("created_at", { ascending: true })
      .limit(3);

    if (!staffUsers || staffUsers.length === 0) {
      return NextResponse.json(
        { error: "No onboarded users found. Complete onboarding first, then seed." },
        { status: 400 }
      );
    }

    // Distribute stories across available users
    const seedStories = getSeedStories();
    const insertedIds: string[] = [];

    for (let i = 0; i < seedStories.length; i++) {
      const story = seedStories[i];
      const user = staffUsers[i % staffUsers.length];

      const { data, error } = await admin
        .from("stories")
        .insert({
          author_id: user.id,
          title: story.title,
          content: story.content,
          is_public: true,
          mood: story.mood,
          tags: story.tags,
          story_type: story.story_type,
          story_date: story.story_date,
          created_at: story.created_at,
          likes: Math.floor(Math.random() * 20) + 1,
        })
        .select("id")
        .single();

      if (data) insertedIds.push(data.id);
      if (error) console.warn(`[SEED] Story insert failed: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      inserted: insertedIds.length,
      total: seedStories.length,
      message: `Seeded ${insertedIds.length} stories across ${staffUsers.length} users.`,
    });
  } catch (err) {
    console.error("[ADMIN/SEED] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function getSeedStories() {
  const now = new Date();
  const daysAgo = (d: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    return date.toISOString();
  };

  return [
    {
      title: "The Morning I Decided to Write",
      content: "There's something about early mornings that strips away the noise. The world hasn't started yet, and in that silence, you can finally hear your own thoughts. I've been thinking about why I don't write more. Not emails or messages — actual writing. The kind where you sit with an idea and follow it somewhere unexpected.\n\nI think the answer is fear. Not of the blank page, but of what might come out. When you write honestly, you can't hide from yourself. Every sentence is a mirror. And some mornings, you're not ready for what you see.\n\nBut today felt different. Maybe it was the light coming through the window, or the fact that I slept well for the first time in weeks. Whatever it was, I sat down and started. And I haven't stopped.",
      mood: "reflective",
      tags: ["writing", "morning", "reflection"],
      story_type: "personal_journal",
      story_date: daysAgo(2),
      created_at: daysAgo(2),
    },
    {
      title: "Why History Repeats — A Pattern I Can't Unsee",
      content: "I've been reading about the fall of the Roman Republic lately. Not for any class or assignment — just because something about our current moment feels familiar in a way I can't quite articulate.\n\nThe parallels are uncomfortable. A republic that stopped being able to govern itself. Institutions that everyone agreed were important but no one was willing to defend when it mattered. The slow erosion of norms until someone came along and said, 'Why pretend these rules still apply?'\n\nWhat strikes me isn't the big dramatic moments — it's the mundane ones. The years where everyone knew something was wrong but assumed someone else would fix it. The way ordinary people adjusted to each new abnormality until the abnormal became the baseline.\n\nI don't think history repeats exactly. But it rhymes in ways that should make us pay attention.",
      mood: "analytical",
      tags: ["history", "politics", "patterns"],
      story_type: "historical_narrative",
      story_date: daysAgo(5),
      created_at: daysAgo(5),
    },
    {
      title: "My Grandmother's Recipe Book",
      content: "My grandmother never measured anything. A pinch of this, a handful of that, cook until it smells right. When I was young, this drove me crazy. How was I supposed to learn if she wouldn't give me exact measurements?\n\nNow I understand. The recipes weren't about the food — they were about presence. She was teaching me to pay attention. To trust my senses. To be in the kitchen, fully, instead of following a script.\n\nShe's been gone for three years now. I found her recipe book last week while cleaning out the old house. The pages are stained with decades of cooking. Her handwriting gets shakier as the years go on. Some entries are just a single word — 'beautiful' — next to a dish she'd perfected.\n\nI'm going to cook every recipe in this book. Not to replicate her food, but to spend time with her memory. To stand where she stood and feel the warmth of the kitchen she built.",
      mood: "nostalgic",
      tags: ["family", "memory", "cooking", "heritage"],
      story_type: "cultural_story",
      story_date: daysAgo(8),
      created_at: daysAgo(8),
    },
    {
      title: "The AI Revolution: What We're Not Talking About",
      content: "Everyone is talking about which jobs AI will replace. But I think we're missing the bigger question: what happens to human identity when work is no longer the primary source of meaning?\n\nFor centuries, we've defined ourselves by what we do. 'I'm a teacher.' 'I'm an engineer.' 'I'm a writer.' Strip that away, and most people don't know who they are.\n\nI've been thinking about this since I watched my father retire. He was a machinist for 40 years. The day he stopped working, something in him dimmed. Not because the work was fulfilling — he complained about it constantly — but because it gave his days structure and his life a story he could tell.\n\nThe meaning crisis isn't coming. It's here. AI is just going to make it impossible to ignore.",
      mood: "contemplative",
      tags: ["AI", "meaning", "work", "identity"],
      story_type: "geopolitical_analysis",
      story_date: daysAgo(3),
      created_at: daysAgo(3),
    },
    {
      title: "Walking Through Lagos at Dawn",
      content: "Lagos at 5 AM is a different city. Before the traffic and the noise and the 20 million people trying to get somewhere, there's a quiet that most visitors never see.\n\nI walked from Lekki to Victoria Island this morning. The air was cool — actually cool, which in Lagos means below 28 degrees — and the ocean was doing that thing where it catches the first light and turns everything silver.\n\nA woman was selling akara on the corner. She'd been there since 4 AM, she said. Does this every day. Her grandmother did the same thing on the same corner. Three generations of dawn.\n\nPeople write about Lagos like it's chaos. It's not. It's a system so complex that it looks like chaos to people who don't know how to read it. Every hawker, every danfo, every generator humming in the darkness — it all works because millions of people have built an infrastructure of relationships and trust that no government planned.\n\nThat's the story of Africa that never gets told. Not the poverty or the conflicts, but the extraordinary daily achievement of people building functional societies from the ground up.",
      mood: "inspired",
      tags: ["Lagos", "Africa", "culture", "travel"],
      story_type: "cultural_story",
      story_date: daysAgo(1),
      created_at: daysAgo(1),
    },
    {
      title: "Letter to My Future Self",
      content: "Dear future me,\n\nI hope you still remember what it felt like to be uncertain. I hope success — if it came — didn't make you forget the nights where nothing made sense and you wrote just to keep breathing.\n\nRight now, I'm sitting in a small apartment with a laptop that's too slow and an internet connection that drops every twenty minutes. I have more ideas than I know what to do with and zero certainty about any of them.\n\nBut here's what I know: I'm alive, I'm writing, and I care about something. That's more than a lot of people can say.\n\nIf you're reading this and things worked out: remember this version of yourself. They're the one who kept going.\n\nIf you're reading this and things didn't work out: that's okay too. You tried something real. That's its own kind of success.",
      mood: "hopeful",
      tags: ["future", "self-reflection", "growth"],
      story_type: "personal_journal",
      story_date: daysAgo(10),
      created_at: daysAgo(10),
    },
    {
      title: "The Music My Mother Played",
      content: "My mother played Fela Kuti every Sunday morning. The whole house would fill with those long, looping horn arrangements and his voice cutting through the music like a sermon.\n\nI didn't appreciate it then. I wanted to listen to whatever was on the radio — American pop, mostly. But she insisted. 'You need to know where the music comes from,' she said.\n\nShe was right, of course. Mothers usually are, on a timeline delayed enough that you can't tell them.\n\nNow I play Fela on Sunday mornings in my own apartment. My neighbors probably hate it. The songs go on for fifteen minutes, sometimes twenty. But that's the point — Fela wasn't making songs, he was making spaces. You enter the music and you live there for a while.\n\nLast Sunday I called my mother. 'Guess what I'm listening to,' I said. She laughed. 'It took you long enough.'",
      mood: "warm",
      tags: ["music", "family", "culture", "Fela"],
      story_type: "creative_nonfiction",
      story_date: daysAgo(6),
      created_at: daysAgo(6),
    },
    {
      title: "What I Learned From Reading 50 Books This Year",
      content: "I set out to read 50 books this year. Not to hit a number, but because I noticed my attention span shrinking and wanted to fight back.\n\nHere's what I learned:\n\n1. The best books change how you see, not what you know. Information fades. New lenses are permanent.\n\n2. Fiction teaches empathy better than any self-help book. You can read about emotional intelligence all day, but nothing teaches it like living inside someone else's mind for 300 pages.\n\n3. Reading widely matters more than reading deeply. A book about mycology changed how I think about networks. A novel set in 1920s Istanbul changed how I think about identity. The connections between disciplines is where the real insight lives.\n\n4. Physical books are better. Not for any productivity reason — I just remember more when I can feel the pages.\n\n5. Most books have one good idea stretched across 300 pages. That's okay. The stretching is where you find the nuances.",
      mood: "thoughtful",
      tags: ["reading", "books", "learning", "growth"],
      story_type: "personal_journal",
      story_date: daysAgo(4),
      created_at: daysAgo(4),
    },
    {
      title: "The Night Sky in Rural Kenya",
      content: "I saw the Milky Way for the first time last month in the Kenyan highlands. Actually saw it — not as a smudge of light pollution, but as a river of stars so dense it looked painted.\n\nI cried. I'm not ashamed of that. Something about seeing the scale of the universe, really seeing it, resets every problem you've ever worried about. That promotion you didn't get? There are 100 billion stars in this galaxy alone. That argument with your partner? The light you're looking at left its star before humans existed.\n\nThe Maasai guide who was with us said his grandmother used to navigate by the stars. Not in some abstract way — she knew the sky like we know Google Maps. Every constellation had a name and a story, and the stories contained directions.\n\nWe've traded that knowledge for GPS and light pollution. I'm not saying we should go back. But we should notice what we've lost.",
      mood: "awed",
      tags: ["nature", "Kenya", "stars", "perspective"],
      story_type: "creative_nonfiction",
      story_date: daysAgo(12),
      created_at: daysAgo(12),
    },
    {
      title: "Why I Left Social Media for 30 Days",
      content: "Thirty days without Twitter, Instagram, or TikTok. Here's what happened:\n\nWeek 1: Phantom scrolling. I picked up my phone 40+ times a day to open apps that weren't there. Genuinely unsettling how automatic it was.\n\nWeek 2: Boredom. Real, deep, uncomfortable boredom. The kind I haven't felt since childhood. And then, slowly, ideas started showing up in the space the boredom created.\n\nWeek 3: I finished a short story I'd been 'working on' for six months. Turns out I wasn't lacking talent or time. I was lacking attention.\n\nWeek 4: I had dinner with three friends and nobody checked their phone. We talked for four hours. About real things. I remembered why I liked these people.\n\nDay 31: I reinstalled the apps. Then deleted them again an hour later. The experiment was supposed to be temporary, but I don't think I'm going back.",
      mood: "empowered",
      tags: ["social media", "digital detox", "attention"],
      story_type: "personal_journal",
      story_date: daysAgo(7),
      created_at: daysAgo(7),
    },
    {
      title: "Cooking Jollof Rice: A Love Story",
      content: "Every West African family has a jollof recipe they believe is the correct one. This conviction is held with a certainty usually reserved for religious faith.\n\nMy family's jollof starts with charred tomatoes. This is non-negotiable. You blacken the tomatoes over an open flame until the skin peels and the flesh goes sweet and smoky. Then you blend them with scotch bonnets and a fistful of onions.\n\nThe rice goes in unwashed. I know, I know. But the starch is what gives it that texture — each grain separate but clinging to the sauce like it's been in a long-term relationship.\n\nYou cook it low and slow, with the lid sealed. No peeking. This is the hardest part. The temptation to lift the lid is enormous. But trust the process. The steam does the work.\n\nWhen it's done right, the bottom layer — the socarrat, the party jollof, call it what you want — that bottom layer is where the magic lives. Crispy, caramelized, slightly burnt. It's the best part, and everyone knows it.",
      mood: "joyful",
      tags: ["food", "cooking", "West Africa", "culture"],
      story_type: "cultural_story",
      story_date: daysAgo(9),
      created_at: daysAgo(9),
    },
    {
      title: "The Economics of Being Young in 2026",
      content: "My parents bought their first house at 28. I'm 28 and my rent just went up for the third time this year.\n\nI'm not writing this to complain. I'm writing this because the numbers tell a story that's worth documenting. Adjusted for inflation, my parents' generation earned more at every age than mine does. They had access to cheaper education, more stable employment, and a housing market that hadn't been turned into an investment vehicle.\n\nMeanwhile, we have better phones.\n\nI think the interesting question isn't 'why is this happening?' — that's been well documented. The question is 'what stories will this generation tell itself to make sense of this reality?'\n\nEvery generation creates a narrative to explain its circumstances. The Boomers had the American Dream. Gen X had cynicism. Millennials had 'we're all in this together.' What will ours be?",
      mood: "analytical",
      tags: ["economics", "generational", "housing", "society"],
      story_type: "geopolitical_analysis",
      story_date: daysAgo(11),
      created_at: daysAgo(11),
    },
    {
      title: "Three AM Thoughts on Creativity",
      content: "It's 3 AM and I can't sleep because an idea won't leave me alone. This is how it always happens — never at a convenient time, never when I'm sitting at my desk with a cup of coffee and good lighting.\n\nCreativity doesn't respect schedules. It shows up at 3 AM in your pajamas, at the grocery store when you're comparing cereal prices, in the shower when you can't reach your phone.\n\nI've stopped fighting it. I keep a notebook by my bed now. The handwriting is terrible — half-asleep scrawl that I can barely read the next morning. But the ideas are real. Some of the best things I've written started as 3 AM scribbles.\n\nMaybe creativity needs darkness to work. Not metaphorical darkness — actual, literal darkness. The silence of a sleeping world. The absence of input. In the quiet, your brain stops processing and starts generating.\n\nI'm going to write this idea down and go back to sleep. Or try to. The ideas don't always stop at one.",
      mood: "creative",
      tags: ["creativity", "writing", "night", "ideas"],
      story_type: "personal_journal",
      story_date: daysAgo(14),
      created_at: daysAgo(14),
    },
    {
      title: "What Migration Really Looks Like",
      content: "The news shows migration as a crisis. Numbers on a screen. Boats in the Mediterranean. Political debates.\n\nBut here's what migration actually looks like up close: it looks like my cousin Amara spending three months learning a language on her phone so she could pass an exam in a country she'd never visited. It looks like my uncle sending 40% of his salary home every month for twelve years so his children could go to school.\n\nIt looks like loss. Not dramatic, cinematic loss — the quiet kind. The kind where you miss a season changing. Where your mother's voice on the phone sounds older each time and you can't quite remember the exact blue of the sky at home.\n\nAnd it looks like building. Always building. A new life in a new place with a new language, and somehow making it work. Not because you're brave or special, but because going back isn't an option and standing still isn't in your nature.\n\nThe stories of migrants are, at their core, stories of extraordinary ordinary resilience. They deserve to be told by the people living them.",
      mood: "poignant",
      tags: ["migration", "family", "diaspora", "resilience"],
      story_type: "cultural_story",
      story_date: daysAgo(13),
      created_at: daysAgo(13),
    },
    {
      title: "The Day I Started Recording My Thoughts",
      content: "I used to think journaling was for people with simpler lives than mine. People who had time to sit with a leather-bound notebook and a fountain pen and reflect on their day.\n\nThen I discovered voice recording. Something about speaking your thoughts out loud — not to anyone, just to the air — changes how you think. Writing can be edited and perfected until it doesn't sound like you anymore. But your voice? Your voice is honest.\n\nThe hesitations are honest. The 'um's and 'uh's and long pauses where you're figuring out what you actually think — those are the most interesting parts. That's where the real thinking happens.\n\nI've been recording myself for six months now. I have 47 recordings. Some are three minutes. Some are thirty. Together, they form a map of who I've been becoming.\n\nThe version of me from six months ago sounds like a stranger. Not because I've changed dramatically, but because I can hear things in his voice that he couldn't hear himself. The doubt. The hope. The way he talked around the thing he really wanted to say.\n\nThat's why this matters. Not for anyone else. For you, years from now, listening back.",
      mood: "inspired",
      tags: ["voice", "journaling", "self-discovery", "recording"],
      story_type: "personal_journal",
      story_date: daysAgo(0),
      created_at: daysAgo(0),
    },
  ];
}
