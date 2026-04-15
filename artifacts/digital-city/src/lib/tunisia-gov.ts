export interface TunisiaDelegation { ar: string; fr: string; }
export interface TunisiaGov { gov: string; gov_fr: string; delegations: TunisiaDelegation[]; }

export const TUNISIA_GOV: TunisiaGov[] = [
  { gov: "مدنين",      gov_fr: "Médenine",    delegations: [
      { ar: "بن قردان",            fr: "Ben Guerdane" },
      { ar: "مدنين الشمالية",      fr: "Médenine Nord" },
      { ar: "مدنين الجنوبية",      fr: "Médenine Sud" },
      { ar: "جرجيس",               fr: "Zarzis" },
      { ar: "سيدي مخلوف",          fr: "Sidi Makhlouf" },
      { ar: "بني خداش",            fr: "Beni Khedache" },
      { ar: "جربة حومة السوق",     fr: "Djerba - Houmt Souk" },
      { ar: "جربة ميدون",          fr: "Djerba - Midoun" },
      { ar: "جربة أجيم",           fr: "Djerba - Ajim" },
  ]},
  { gov: "تطاوين",    gov_fr: "Tataouine",   delegations: [
      { ar: "تطاوين الشمالية",     fr: "Tataouine Nord" },
      { ar: "تطاوين الجنوبية",     fr: "Tataouine Sud" },
      { ar: "غمراسن",              fr: "Ghomrassen" },
      { ar: "ذهيبة",               fr: "Dhehiba" },
      { ar: "بئر الأحمر",          fr: "Bir Lahmar" },
      { ar: "رمادة",               fr: "Remada" },
  ]},
  { gov: "قابس",      gov_fr: "Gabès",       delegations: [
      { ar: "قابس المدينة",        fr: "Gabès Ville" },
      { ar: "قابس الغربية",        fr: "Gabès Ouest" },
      { ar: "قابس الجنوبية",       fr: "Gabès Sud" },
      { ar: "الحامة",              fr: "El Hamma" },
      { ar: "مطماطة",              fr: "Matmata" },
      { ar: "مارث",                fr: "Mareth" },
      { ar: "منزل الحبيب",         fr: "Menzel Habib" },
  ]},
  { gov: "صفاقس",     gov_fr: "Sfax",        delegations: [
      { ar: "صفاقس المدينة",       fr: "Sfax Ville" },
      { ar: "صفاقس الغربية",       fr: "Sfax Ouest" },
      { ar: "صفاقس الجنوبية",      fr: "Sfax Sud" },
      { ar: "الحنشة",              fr: "El Hencha" },
      { ar: "قرقنة",               fr: "Kerkennah" },
      { ar: "جبنيانة",             fr: "Jebeniana" },
  ]},
  { gov: "قبلي",      gov_fr: "Kébili",      delegations: [
      { ar: "قبلي الشمالية",       fr: "Kébili Nord" },
      { ar: "قبلي الجنوبية",       fr: "Kébili Sud" },
      { ar: "دوز الشمالية",        fr: "Douz Nord" },
      { ar: "دوز الجنوبية",        fr: "Douz Sud" },
      { ar: "فوار",                fr: "Faouar" },
  ]},
  { gov: "توزر",      gov_fr: "Tozeur",      delegations: [
      { ar: "توزر",                fr: "Tozeur" },
      { ar: "نفطة",                fr: "Nefta" },
      { ar: "حامة الجريد",         fr: "Hamet Jérid" },
      { ar: "دقاش",                fr: "Degache" },
  ]},
  { gov: "سوسة",      gov_fr: "Sousse",      delegations: [
      { ar: "سوسة المدينة",        fr: "Sousse Ville" },
      { ar: "سوسة الرياض",         fr: "Sousse Riadh" },
      { ar: "سوسة جوهرة",          fr: "Sousse Jawhara" },
      { ar: "القلعة الكبرى",       fr: "Kalâa Kebira" },
      { ar: "حمام سوسة",           fr: "Hammam Sousse" },
  ]},
  { gov: "المهدية",   gov_fr: "Mahdia",      delegations: [
      { ar: "المهدية",             fr: "Mahdia" },
      { ar: "بومرداس",             fr: "Boumerdes" },
      { ar: "الشابة",              fr: "Chebba" },
      { ar: "قصور الساف",          fr: "Ksour Essaf" },
  ]},
  { gov: "المنستير",  gov_fr: "Monastir",    delegations: [
      { ar: "المنستير",            fr: "Monastir" },
      { ar: "المكنين",             fr: "Moknine" },
      { ar: "صواف",                fr: "Sayada" },
      { ar: "جمال",                fr: "Djemal" },
  ]},
  { gov: "القيروان",  gov_fr: "Kairouan",    delegations: [
      { ar: "القيروان الشمالية",   fr: "Kairouan Nord" },
      { ar: "القيروان الجنوبية",   fr: "Kairouan Sud" },
      { ar: "الشبيكة",             fr: "Chebika" },
      { ar: "حفوز",                fr: "Haffouz" },
  ]},
  { gov: "قصرين",     gov_fr: "Kasserine",   delegations: [
      { ar: "قصرين الشمالية",      fr: "Kasserine Nord" },
      { ar: "قصرين الجنوبية",      fr: "Kasserine Sud" },
      { ar: "سبيطلة",              fr: "Sbeitla" },
      { ar: "تالة",                fr: "Thala" },
  ]},
  { gov: "سيدي بوزيد", gov_fr: "Sidi Bouzid", delegations: [
      { ar: "سيدي بوزيد الغربية",  fr: "Sidi Bouzid Ouest" },
      { ar: "سيدي بوزيد الشرقية",  fr: "Sidi Bouzid Est" },
      { ar: "جلمة",                fr: "Jelma" },
      { ar: "مكثر",                fr: "Meknassy" },
  ]},
  { gov: "قفصة",      gov_fr: "Gafsa",       delegations: [
      { ar: "قفصة الشمالية",       fr: "Gafsa Nord" },
      { ar: "قفصة الجنوبية",       fr: "Gafsa Sud" },
      { ar: "أم العرائس",          fr: "Oum El Arayés" },
      { ar: "الرديف",              fr: "Redeyef" },
  ]},
  { gov: "تونس",      gov_fr: "Tunis",       delegations: [
      { ar: "تونس",                fr: "Tunis" },
      { ar: "قرطاج",               fr: "Carthage" },
      { ar: "المرسى",              fr: "La Marsa" },
      { ar: "سيدي بوسعيد",         fr: "Sidi Bou Saïd" },
  ]},
  { gov: "أريانة",    gov_fr: "Ariana",      delegations: [
      { ar: "أريانة المدينة",      fr: "Ariana Ville" },
      { ar: "سكرة",                fr: "Soukra" },
      { ar: "قلعة الأندلس",        fr: "Kalâat El Andalous" },
  ]},
  { gov: "بن عروس",   gov_fr: "Ben Arous",   delegations: [
      { ar: "بن عروس",             fr: "Ben Arous" },
      { ar: "حمام الأنف",          fr: "Hammam-Lif" },
      { ar: "المحمدية",            fr: "Mohammédia" },
  ]},
  { gov: "منوبة",     gov_fr: "Manouba",     delegations: [
      { ar: "منوبة",               fr: "Manouba" },
      { ar: "دوار هيشر",           fr: "Douar Hicher" },
      { ar: "برج العامري",          fr: "Borj El Amri" },
  ]},
  { gov: "نابل",      gov_fr: "Nabeul",      delegations: [
      { ar: "نابل",                fr: "Nabeul" },
      { ar: "الحمامات",            fr: "Hammamet" },
      { ar: "قربة",                fr: "Korbous" },
      { ar: "منزل تميم",           fr: "Menzel Temime" },
  ]},
  { gov: "زغوان",     gov_fr: "Zaghouan",    delegations: [
      { ar: "زغوان",               fr: "Zaghouan" },
      { ar: "الفحص",               fr: "El Fahs" },
      { ar: "بئر مشارقة",          fr: "Bir Mchergua" },
  ]},
  { gov: "بنزرت",     gov_fr: "Bizerte",     delegations: [
      { ar: "بنزرت الشمالية",      fr: "Bizerte Nord" },
      { ar: "بنزرت الجنوبية",      fr: "Bizerte Sud" },
      { ar: "منزل بورقيبة",        fr: "Menzel Bourguiba" },
      { ar: "ماطر",                fr: "Mateur" },
  ]},
  { gov: "جندوبة",    gov_fr: "Jendouba",    delegations: [
      { ar: "جندوبة الشمالية",     fr: "Jendouba Nord" },
      { ar: "جندوبة الجنوبية",     fr: "Jendouba Sud" },
      { ar: "طبرقة",               fr: "Tabarka" },
      { ar: "عين دراهم",           fr: "Aïn Draham" },
  ]},
  { gov: "الكاف",     gov_fr: "Le Kef",      delegations: [
      { ar: "الكاف الغربية",       fr: "Le Kef Ouest" },
      { ar: "الكاف الشرقية",       fr: "Le Kef Est" },
      { ar: "الجريصة",             fr: "Jerissa" },
  ]},
  { gov: "سليانة",    gov_fr: "Siliana",     delegations: [
      { ar: "سليانة الشمالية",     fr: "Siliana Nord" },
      { ar: "سليانة الجنوبية",     fr: "Siliana Sud" },
      { ar: "القصور",              fr: "Kesra" },
  ]},
  { gov: "باجة",      gov_fr: "Béja",        delegations: [
      { ar: "باجة الشمالية",       fr: "Béja Nord" },
      { ar: "باجة الجنوبية",       fr: "Béja Sud" },
      { ar: "تبرسق",               fr: "Thibar" },
  ]},
];

export const ALL_DELEGATIONS: { ar: string; fr: string; gov: string; gov_fr: string }[] =
  TUNISIA_GOV.flatMap(g => g.delegations.map(d => ({ ar: d.ar, fr: d.fr, gov: g.gov, gov_fr: g.gov_fr })));
