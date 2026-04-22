
const DATA_PATH="data/";

const NAME_MAP={
  "matt murdock":"Matt Murdock","matt":"Matt Murdock","murdock":"Matt Murdock",
  "daredevil":"Matt Murdock","the man in black":"Matt Murdock","devil":"Matt Murdock",
  "wilson fisk":"Wilson Fisk","fisk":"Wilson Fisk","kingpin":"Wilson Fisk",
  "foggy nelson":"Foggy Nelson","foggy":"Foggy Nelson","nelson":"Foggy Nelson",
  "karen page":"Karen Page","karen":"Karen Page",
  "claire temple":"Claire Temple","claire":"Claire Temple",
  "james wesley":"James Wesley","wesley":"James Wesley",
  "father lantom":"Father Lantom","lantom":"Father Lantom",
  "leland owsley":"Leland Owsley","leland":"Leland Owsley",
  "vanessa marianna":"Vanessa","vanessa":"Vanessa",
  "ben urich":"Ben Urich","ben":"Ben Urich",
  "sgt. brett mahoney":"Brett Mahoney","brett mahoney":"Brett Mahoney","brett":"Brett Mahoney",
  "turk barrett":"Turk Barrett","turk":"Turk Barrett","stick":"Stick",
  "vladimir ranskahov":"Vladimir","vladimir":"Vladimir",
  "anatoly ranskahov":"Anatoly","anatoly":"Anatoly",
  "frank castle":"Frank Castle","frank":"Frank Castle","punisher":"Frank Castle",
  "elektra natchios":"Elektra","elektra":"Elektra",
  "ray nadeem":"Ray Nadeem","ray":"Ray Nadeem",
  "benjamin dex poindexter":"Dex","dex":"Dex","benjamin poindexter":"Dex","bullseye":"Dex",
  "maggie grace":"Maggie","maggie":"Maggie",
  "ellison":"Ellison","mitchell ellison":"Ellison",
  "jack murdock":"Jack Murdock","jack":"Jack Murdock",
};

const CORE_CHARS=[
  "Matt Murdock","Wilson Fisk","Foggy Nelson","Karen Page",
  "Claire Temple","James Wesley","Father Lantom","Leland Owsley",
  "Vanessa","Ben Urich","Brett Mahoney","Stick",
  "Vladimir","Frank Castle","Elektra","Ray Nadeem",
  "Dex","Maggie","Ellison","Jack Murdock",
];

const CHAR_COL={
  "Matt Murdock":"#ff2a2a","Wilson Fisk":"#8b0000","Foggy Nelson":"#4a9eff",
  "Karen Page":"#e74c3c","Claire Temple":"#16a085","James Wesley":"#7f8c8d",
  "Father Lantom":"#f39c12","Leland Owsley":"#8e44ad","Vanessa":"#d35400",
  "Ben Urich":"#27ae60","Brett Mahoney":"#2c3e50","Stick":"#795548",
  "Vladimir":"#455a64","Frank Castle":"#546e7a","Elektra":"#ad1457",
  "Ray Nadeem":"#0288d1","Dex":"#6a1b9a","Maggie":"#558b2f",
  "Ellison":"#00695c","Jack Murdock":"#bf360c",
};
// THIS IS FOR THE WORD CLOUD AND OTHER VISUALIZATIONS
const IGNORE_WORDS = new Set([
  "where", "working", "both", "why", "enough","better", "cause", "theyll", "anymore",
  "whatever", "thing", "things", "something", "anything", "everything", "nothing",
  "questions", "shot", "client", "hit", "around", "whatever", "melvin", "help", "ill",
  "heard", "else", "building", "guess", "fight", "ever", "case", "part", "life", "world",
  "answer", "walk", "half", "suit", "men", "women", "guy", "kid", "people", "person", "dad", "mom",
  "get", "got", "getting", "make", "made", "making", "take", "took", "taking", "go", "went", "going",
  "come", "came", "coming", "see", "saw", "seen", "look", "looking", "know", "knew", "known", "want", "wanted",
  "need", "needed", "try", "trying", "tell", "told", "say", "said", "find", "found", "keep", "leave", "call", "talk", "ask",
  "happen", "happened", "doing", "done", "stop", "start", "feel", "felt", "care", "believe", "thought", "think",
  "understand", "understood", "remember", "forgot", "time", "day", "night", "way", "place", "work", "job", "case", "part",
  "life", "world", "name", "money", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "matt", "murdock", "matthew", "fisk", "wilson", "foggy", "karen", "elektra", "frank", "castle", "stick", "wesley", "ben", "page",
  "nelson", "dex", "poindexter", "vanessa", "lantom", "claire", "i", "me", "my", "mine", "we", "our", "ours", "you", "your", "yours",
 "he", "him", "his", "she", "her", "hers", "it", "its", "they", "them", "their", "theirs", "is", "are", "was", "were", "be", "been", "being",
  

  "i","me","my","mine","we","our","ours","you","your","yours",
  "he","him","his","she","her","hers","it","its","they","them","their","theirs",

  "is","are","was","were","be","been","being",
  "have","has","had","do","does","did",
  "can","could","should","would","will","shall","may","might","must",

  "a","an","the","and","but","if","or","because","as","until","while",
  "of","at","by","for","with","about","against","between","into",
  "through","during","before","after","above","below",
  "to","from","up","down","in","out","on","off","over","under",

  "im","youre","hes","shes","its","theyre","ive","weve","youve",
  "dont","didnt","doesnt","cant","couldnt","wouldnt","shouldnt",
  "wont","isnt","arent","wasnt","werent","havent","hasnt","hadnt",

  "yeah","okay","ok","right","well","uh","um","hmm",
  "hey","hi","hello","bye","goodbye",
  "please","sorry","thanks","thank","yes","no",

  "maybe","sure","really","actually","basically","literally",
  "just","even","still","already","again",

  "thing","things","something","anything","everything","nothing",
  "someone","anyone","everyone","nobody",
  "stuff","kind","sort","bit","lot",

  "man","woman","guy","kid","people","person","dad","mom",

  "get","got","getting",
  "make","made","making",
  "take","took","taking",
  "go","went","going",
  "come","came","coming",
  "see","saw","seen",
  "look","looking",
  "know","knew","known",
  "want","wanted",
  "need","needed",
  "try","trying",
  "tell","told",
  "say","said",

  "find","found","keep","leave","call","talk","ask",
  "happen","happened","doing","done","stop","start",

  "feel","felt","care","believe","thought","think",
  "understand","understood","remember","forgot",

  "time","day","night","way","place","work","job","case","part",
  "life","world","name","money",

  "one","two","three","four","five","six","seven","eight","nine","ten",

  "matt","murdock","matthew","fisk","wilson","foggy","karen",
  "elektra","frank","castle","stick","wesley","ben","page",
  "nelson","dex","poindexter","vanessa","lantom","claire",

  "i","me","my","myself","we","our","you","your","he","him","his","she","her",
  "it","its","they","them","their","what","which","who","is","am","are","was",
  "were","be","been","being","have","has","had","do","does","did","will","would",
  "could","should","may","might","shall","can","a","an","the","and","but","if",
  "or","because","as","at","by","for","in","into","of","on","out","so","that",
  "to","too","up","with","this","from","yes","no","yeah","oh","ah","uh","well",
  "just","not","all","now","know","think","get","got","go","going","s","t","re",
  "ll","ve","d","m","don","didn","doesn","isn","wasn","aren","weren","wouldn",
  "couldn","shouldn","won","there","here","when","then","than","more","about",
  "after","before","over","never","always","only","even","back","down","how",
  "make","made","want","need","come","came","tell","said","say","look","like",
  "way","good","right","okay","ok","gonna","gotta","wanna","hey","please","let",
  "much","many","some","any","very","really","still","again","every","same",
  "long","see","put","give","take","left","new","old","little","own","big",
  "first","last","next","few","something","nothing","everything","anything",

]);
const SEASON_EPS={1:13,2:13,3:9};
const ALL_EPS=[];
for(let s=1;s<=3;s++) for(let e=1;e<=SEASON_EPS[s];e++) ALL_EPS.push(`S0${s}E${e<10?"0"+e:e}`);

const EMO_COL={anger:"#e74c3c",fear:"#8e44ad",sadness:"#2980b9",joy:"#f1c40f",neutral:"#555",disgust:"#27ae60",surprise:"#e67e22",unknown:"#333"};

const THEMES_FULL=["justice","violence","guilt","religion"];
const THEME_COL={justice:"#22d3ee",violence:"#ff2a2a",guilt:"#9b59b6",religion:"#f1c40f"};
const THEME_KW={
  justice:["justice","right","wrong","deserve","fair","truth","guilty","innocent"],
  violence:["kill","fight","hit","blood","gun","beat","dead","pain","hurt","weapon"],
  guilt:["guilt","sorry","fault","blame","regret","confess","forgive","sin"],
  religion:["god","father","church","pray","faith","devil","hell","bless","sin","soul"],
};

const LAWYER_W=["law","court","case","client","judge","attorney","legal","jury","evidence","witness","firm"];
const VIGIL_W=["fight","hit","stop","kill","blood","dark","devil","mask","pain","danger","threat"];

const STOP=new Set([

]);

const S={
  lines:[],scenes:[],
  season:"all", epIdx:0, char:"all", mode:"lawyer",
  activeThemes:new Set(THEMES_FULL),
  trendWords:new Set(["justice","violence","fear","devil"]),
  playing:false, playTimer:null, playEpIdx:0,
  firstMF:null,
  // persistent network state
  netSim:null, netSVG:null, netG:null,
  netNodes:[], netEdges:[],
  netLinks:null, netNodeSel:null, netScales:null,
  netFull:null, netW:0, netH:0,
  netInitialized:false,
};

const TT=document.getElementById("tooltip")||document.createElement("div");
export {
  DATA_PATH,
  NAME_MAP,
  CORE_CHARS,
  CHAR_COL,
  IGNORE_WORDS,
  SEASON_EPS,
  ALL_EPS,
  EMO_COL,
  THEMES_FULL,
  THEME_COL,
  THEME_KW,
  LAWYER_W,
  VIGIL_W,
  STOP,
  S,
  TT,
};
