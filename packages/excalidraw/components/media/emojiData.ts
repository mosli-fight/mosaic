/**
 * The emoji the media panel offers.
 *
 * The panel is a self-contained affair: no emoji service, no font pack, no
 * network round-trip. The whole catalogue is a list of unicode emoji and
 * their names, kept here as short strings so that it costs one small
 * module.
 *
 * The names double as the search index. Typing "smile" finds the smileys,
 * typing "cake" finds the cake, typing an emoji itself finds that emoji —
 * the panel never has to ask a server what the user meant.
 */

import type { TranslationKeys } from "../../i18n";

export type EmojiCategoryId =
  | "smileys"
  | "people"
  | "nature"
  | "food"
  | "activity"
  | "travel"
  | "objects"
  | "symbols";

export type EmojiEntry = {
  /** the emoji itself */
  char: string;
  /** the name it is searched by */
  name: string;
};

export type EmojiCategory = {
  id: EmojiCategoryId;
  /** the i18n key of the category's heading */
  labelKey: TranslationKeys;
};

export const EMOJI_CATEGORIES: readonly EmojiCategory[] = [
  { id: "smileys", labelKey: "labels.media.categories.smileys" },
  { id: "people", labelKey: "labels.media.categories.people" },
  { id: "nature", labelKey: "labels.media.categories.nature" },
  { id: "food", labelKey: "labels.media.categories.food" },
  { id: "activity", labelKey: "labels.media.categories.activity" },
  { id: "travel", labelKey: "labels.media.categories.travel" },
  { id: "objects", labelKey: "labels.media.categories.objects" },
  { id: "symbols", labelKey: "labels.media.categories.symbols" },
];

/**
 * Reads a category out of its compact form.
 *
 * A category is a list of `emoji name` pairs separated by `|`. The name may
 * contain spaces; the emoji may not, so the first space is the boundary.
 */
const parse = (raw: string): EmojiEntry[] =>
  raw.split("|").map((pair) => {
    const [char, ...name] = pair.trim().split(" ");
    return { char, name: name.join(" ") };
  });

const SMILEYS = parse(
  "😀 grinning|😃 smiley|😄 smile|😁 grin|😅 sweat smile|😂 joy|🤣 rolling laughter|😊 blush|😇 innocent|🙃 upside down|😉 wink|😌 relieved|😍 heart eyes|🥰 smiling with hearts|😘 kiss|😗 kissing closed eyes|😙 kissing smiling eyes|😚 kissing closed eyes with a smile|😋 yum|😛 stuck out tongue|😜 wink tongue|🤪 zany|😝 squinting|🤑 money mouth|🤗 hugging|🤭 hand over mouth|🤫 shushing|🤔 thinking|🤐 zipper mouth|🤨 raised eyebrow|😐 neutral|😑 expressionless|😶 no mouth|😏 smirk|😒 unamused|🙄 rolling eyes|😬 grimacing|🤥 lying|😴 sleeping|🤤 drooling|😪 sleepy|😵 dizzy|🤯 mind blown|🥳 partying|🥺 pleading|😦 frowning|😧 anguished|😨 fearful|😰 cold sweat|😥 sad relieved|😢 crying|😭 sobbing|😱 screaming|😖 confounded|😣 persevering|😞 disappointed|😓 sweat|😩 weary|😫 tired|🥱 yawning|😤 triumph|😡 rage|😠 angry|🤬 cursing|😈 smiling imp|💀 skull|☠️ skull and crossbones|💩 pile of poo|🤡 clown|👻 ghost|👽 alien|🤖 robot",
);

const PEOPLE = parse(
  "👋 waving hand|🤚 raised back of hand|✋ raised hand|👌 ok hand|🤌 pinched fingers|✌️ victory|🤞 crossed fingers|🤟 love you gesture|🤘 sign of the horns|🤙 call me|👈 backhand index pointing left|👉 backhand index pointing right|👆 backhand index pointing up|👇 backhand index pointing down|👍 thumbs up|👎 thumbs down|✊ raised fist|👊 oncoming fist|👏 clapping|🙌 raising hands|👐 open hands|🤲 palms up|🤝 handshake|🙏 folded hands|✍️ writing hand|💅 nail polish|🤳 selfie|💪 flexed biceps|🦾 mechanical arm|🦵 leg|🦶 foot|👂 ear|👃 nose|🧠 brain|🦷 tooth|👀 eyes|👁️ eye|👅 tongue|👶 baby|🧒 child|👦 boy|👧 girl|🧑 adult|👨 man|👩 woman|🧓 older person|👴 old man|👵 old woman|🙍 person frowning|🙅 person gesturing no|🙆 person gesturing ok|💁 person tipping hand|🙋 person raising hand|🧏 deaf person|🙇 person bowing|🤦 facepalm|🤷 shrugging|🚶 person walking|🏃 person running|💃 woman dancing|🕺 man dancing|🧘 person in lotus position|🛀 person taking bath|🧖 person in sauna",
);

const NATURE = parse(
  "🐶 dog|🐱 cat|🐭 mouse|🐹 hamster|🐰 rabbit|🦊 fox|🐻 bear|🐼 panda|🐨 koala|🐯 tiger|🦁 lion|🐮 cow|🐷 pig|🐸 frog|🐵 monkey|🐔 chicken|🐧 penguin|🐦 bird|🦆 duck|🦅 eagle|🦉 owl|🦇 bat|🐺 wolf|🐗 boar|🐴 horse|🦄 unicorn|🐝 bee|🐛 bug|🦋 butterfly|🐌 snail|🐞 lady beetle|🐜 ant|🕷️ spider|🐢 turtle|🐍 snake|🦎 lizard|🐙 octopus|🦑 squid|🐳 whale|🐬 dolphin|🐟 fish|🐠 tropical fish|🐡 blowfish|🦀 crab|🌵 cactus|🌲 evergreen tree|🌳 deciduous tree|🌴 palm tree|🌱 seedling|🌿 herb|☘️ shamrock|🍀 four leaf clover|🎋 bamboo|🍃 leaf|🍂 fallen leaf|🍁 maple leaf|🌸 cherry blossom|🌼 blossom|🌻 sunflower|🌹 rose|🥀 wilted flower|🌺 hibiscus|🌷 tulip|🌞 sun with face|🌝 full moon|🌚 new moon|⭐ star|🌟 glowing star|✨ sparkles|⚡ high voltage|☄️ comet|🔥 fire|🌈 rainbow|☀️ sun|🌙 crescent moon|⛅ sun behind cloud|☁️ cloud|❄️ snowflake|🌊 water wave",
);

const FOOD = parse(
  "🍏 green apple|🍎 red apple|🍐 pear|🍊 tangerine|🍋 lemon|🍌 banana|🍉 watermelon|🍇 grapes|🍓 strawberry|🫐 blueberries|🍈 melon|🍒 cherries|🍑 peach|🥭 mango|🍍 pineapple|🥥 coconut|🥝 kiwi fruit|🍅 tomato|🥑 avocado|🥦 broccoli|🥬 leafy green|🥒 cucumber|🌶️ hot pepper|🌽 corn|🥕 carrot|🧄 garlic|🧅 onion|🥔 potato|🍠 sweet potato|🥐 croissant|🥯 bagel|🍞 bread|🥖 baguette bread|🧀 cheese|🥚 egg|🍳 cooking|🧇 waffle|🥓 bacon|🍔 hamburger|🍟 french fries|🍕 pizza|🌭 hot dog|🥪 sandwich|🌮 taco|🌯 burrito|🥗 green salad|🍲 pot of food|🍜 steaming bowl|🍣 sushi|🍱 bento box|🍚 cooked rice|🍙 rice ball|🍘 rice cracker|🥟 dumpling|🥠 fortune cookie|🍢 oden|🍡 dango|🍧 shaved ice|🍨 ice cream|🍦 soft ice cream|🥧 cake|🧁 cupcake|🍰 shortcake|🎂 birthday cake|🍮 custard|🍭 lollipop|🍬 candy|🍫 chocolate bar|🍿 popcorn|🍩 doughnut|🍪 cookie|🌰 chestnut|🥜 peanut|🍯 honey pot|🧂 salt|🥛 glass of milk|☕ hot beverage|🍵 teacup|🧃 beverage box|🥤 cup with straw|🍺 beer mug|🍻 clinking beer mugs|🥂 champagne glasses|🍷 wine glass|🍸 cocktail glass",
);

const ACTIVITY = parse(
  "⚽ soccer ball|🏀 basketball|🏈 american football|⚾ baseball|🎾 tennis|🏐 volleyball|🏉 rugby football|🎱 8 ball|🏓 ping pong|🏸 badminton|🥊 boxing glove|🥋 martial arts uniform|⛳ flag in hole|🏹 bow and arrow|🎣 fishing pole|🤿 diving mask|🥅 goal net|⛸️ ice skate|🎿 skis|🛷 toboggan|🏆 trophy|🥇 1st place medal|🥈 2nd place medal|🥉 3rd place medal|🏅 sports medal|🎖️ military medal|🎯 bullseye|🎮 video game|🕹️ joystick|🎲 game die|🎨 artist palette|🧩 puzzle piece|🎭 performing arts|🎤 microphone|🎧 headphone|🎸 guitar|🎹 musical keyboard|🥁 drum|🎺 trumpet|🎻 violin|🎬 clapper board|🎉 party popper|🎊 confetti ball|🎈 balloon|🎁 wrapped gift|🪅 pinata|🪄 magic wand|🧨 firecracker|🎇 sparkler|🧧 red envelope|🎽 running shirt|🛹 skateboard|🥌 curling stone|🏂 snowboarder|🏋️ weight lifter|🤼 wrestler|🤸 cartwheeling|🤺 fencer|🤾 handball|🏌️ golfer|🏄 surfer|🚣 rowboat|🏊 swimmer|⛷️ skier|🎪 circus tent",
);

const TRAVEL = parse(
  "🚗 automobile|🚕 taxi|🚙 sport utility vehicle|🚌 bus|🚎 trolleybus|🏎️ racing car|🚓 police car|🚑 ambulance|🚒 fire engine|🛻 pickup truck|🚚 delivery truck|🚛 articulated lorry|🚜 tractor|🛵 motor scooter|🏍️ motorcycle|🚲 bicycle|🛴 kick scooter|🚨 police car light|🚦 vertical traffic light|🚧 construction|⛵ sailboat|🚤 speedboat|🛥️ motor boat|🚢 ship|⚓ anchor|✈️ airplane|🛩️ small airplane|🚀 rocket|🛸 flying saucer|🚁 helicopter|🪂 parachute|🗺️ world map|🧭 compass|🏝️ desert island|🏔️ snow capped mountain|🌋 volcano|🗽 statue of liberty|🏕️ camping|🏖️ beach umbrella|🏜️ desert|🏞️ national park|🏟️ stadium|🏗️ building construction|🧱 brick|🌉 bridge at night|🗿 moai|🎡 ferris wheel|🎢 roller coaster|🎠 carousel horse|⛲ fountain|🗼 tower bridge|🏰 castle|🚏 bus stop|🛣️ motorway|🛤️ railway|🧳 luggage|⛺ tent|🎫 ticket|🪪 identification card|🛞 wheel|⛽ fuel pump|🚰 potable water|🚾 restroom|🛶 canoe",
);

const OBJECTS = parse(
  "⌚ watch|📱 mobile phone|💻 laptop|🖥️ desktop computer|🖨️ printer|⌨️ keyboard|🖱️ computer mouse|💽 minidisc|💾 floppy disk|💿 optical disc|📀 dvd|🧮 abacus|🎥 movie camera|📷 camera|📸 camera with flash|📹 video camera|📼 videocassette|🔍 magnifying glass|🔎 magnifying glass tilted left|🕯️ candle|💡 light bulb|🔦 flashlight|🏮 lantern|🪔 diya lamp|🧯 fire extinguisher|🛢️ oil drum|💸 money with wings|💵 dollar banknote|💳 credit card|💎 gem stone|⚖️ balance scale|🔧 wrench|🔨 hammer|🛠️ hammer and wrench|⚙️ gear|🧰 toolbox|🧲 magnet|🔗 link|⛓️ chains|🧪 test tube|🧫 petri dish|🔬 microscope|🔭 telescope|📡 satellite antenna|📿 prayer beads|🧸 teddy bear|🛍️ shopping bags|🛒 shopping cart|🎀 ribbon|📔 notebook with decorative cover|📕 closed book|📗 green book|📘 blue book|📙 orange book|📚 books|📝 memo|✏️ pencil|🖊️ pen|🖌️ paintbrush|🖍️ crayon|📄 page facing up|📃 page with curl|🗒️ spiral notepad|📋 clipboard|📁 folder|📅 calendar|📇 card index|📈 chart increasing|📉 chart decreasing|📊 bar chart|⏰ alarm clock|⏳ hourglass done|⌛ hourglass not done|🕰️ mantelpiece clock",
);

const SYMBOLS = parse(
  "✅ check mark button|☑️ check box with check|✔️ check mark|❌ cross mark|➕ plus|➖ minus|➗ divide|✖️ multiply|♾️ infinity|‼️ double exclamation mark|⁉️ exclamation question mark|❓ question mark|❔ white question mark|❗ red exclamation mark|💯 hundred points|🔰 beginner|⭕ hollow red circle|🔴 red circle|🟠 orange circle|🟡 yellow circle|🟢 green circle|🔵 blue circle|🟣 purple circle|⚫ black circle|⚪ white circle|🟥 red square|🟧 orange square|🟨 yellow square|🟩 green square|🟦 blue square|🟪 purple square|⬛ black large square|⬜ white large square|🔶 large orange diamond|🔷 large blue diamond|🔸 small orange diamond|🔹 small blue diamond|🔺 red triangle pointed up|🔻 red triangle pointed down|🔔 bell|🔕 bell with slash|🔇 mute|🔊 speaker|📢 loudspeaker|📣 megaphone|💬 speech balloon|💭 thought balloon|♻️ recycling symbol|🔱 trident emblem|⚜️ fleur de lis|☮️ peace symbol|✡️ star of david|☢️ radioactive|☣️ biohazard|🆗 ok button|🆕 new button|🆙 up button|🆒 cool button|🆘 sos button|❇️ sparkle|✳️ eight spoked asterisk|💟 heart decoration|🆚 vs button|〰️ wavy dash|➰ curly loop|〽️ part alternation mark|㊗️ Japanese congratulations button|㊙️ Japanese secret button",
);

export const EMOJIS: Record<EmojiCategoryId, EmojiEntry[]> = {
  smileys: SMILEYS,
  people: PEOPLE,
  nature: NATURE,
  food: FOOD,
  activity: ACTIVITY,
  travel: TRAVEL,
  objects: OBJECTS,
  symbols: SYMBOLS,
};

/** a category and the emoji of it that matched a search */
export type EmojiGroup = {
  category: EmojiCategory;
  entries: EmojiEntry[];
};

/**
 * The emoji matching a search, grouped by the category they belong to.
 *
 * An empty search returns every category in full. A search matches on the
 * name of an emoji as well as on the emoji itself, so both "cake" and "🍰"
 * find the cake. Categories that end up with nothing in them are dropped,
 * so the panel never shows an empty heading.
 */
export const searchEmojis = (query: string): EmojiGroup[] => {
  const trimmed = query.trim();
  const needle = trimmed.toLowerCase();

  return EMOJI_CATEGORIES.reduce<EmojiGroup[]>((groups, category) => {
    const entries = EMOJIS[category.id].filter(
      (entry) =>
        !needle ||
        entry.name.toLowerCase().includes(needle) ||
        entry.char.includes(trimmed),
    );

    if (entries.length) {
      groups.push({ category, entries });
    }

    return groups;
  }, []);
};

/** how many emoji the panel offers in total */
export const getEmojiCount = () =>
  EMOJI_CATEGORIES.reduce(
    (count, category) => count + EMOJIS[category.id].length,
    0,
  );
