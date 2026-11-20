import type { FestivalThemeId } from '../types';

export interface FestivalThemeConfig {
  id: FestivalThemeId;
  name: string;
  gujaratiName: string;
  occasion: string;
  bannerText: string;
  accentHex: string;
  accentBgClass: string;
  accentTextClass: string;
  bannerClasses: string;
  topStripGradient: string;
  pageBgTint: string;
  cardAccentBorder: string;
  swatchColors: [string, string, string];
}

export const FESTIVAL_THEMES: Record<FestivalThemeId, FestivalThemeConfig> = {
  normal: {
    id: 'normal',
    name: 'Normal Theme',
    gujaratiName: 'સામાન્ય સત્તાવાર થીમ',
    occasion: 'Year-round saffron, white & green civic design',
    bannerText: '',
    accentHex: '#EA580C',
    accentBgClass: 'bg-orange-600 hover:bg-orange-700',
    accentTextClass: 'text-orange-700 dark:text-orange-400',
    bannerClasses: 'bg-orange-50/90 text-orange-900 border-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-900/50',
    topStripGradient: 'from-orange-600 via-amber-500 to-emerald-700',
    pageBgTint: 'bg-[#FAF9F6] dark:bg-slate-950',
    cardAccentBorder: 'border-orange-200 dark:border-orange-900/40',
    swatchColors: ['#EA580C', '#FAF9F6', '#15803D'],
  },
  diwali: {
    id: 'diwali',
    name: 'Diwali Theme',
    gujaratiName: 'દિવાળી દીપોત્સવ થીમ',
    occasion: 'Festival of Lights · Marigold gold & warm saffron diya tones',
    bannerText: 'Shubh Deepavali · May the lamps of Seva & Harmony shine bright',
    accentHex: '#D97706',
    accentBgClass: 'bg-amber-600 hover:bg-amber-700',
    accentTextClass: 'text-amber-700 dark:text-amber-400',
    bannerClasses: 'bg-amber-50 text-amber-950 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800/50',
    topStripGradient: 'from-amber-600 via-yellow-500 to-orange-600',
    pageBgTint: 'bg-[#FFFDF5] dark:bg-slate-950',
    cardAccentBorder: 'border-amber-200 dark:border-amber-800/40',
    swatchColors: ['#D97706', '#F59E0B', '#7C2D12'],
  },
  navratri: {
    id: 'navratri',
    name: 'Navratri Theme',
    gujaratiName: 'નવરાત્રી શક્તિ ઉત્સવ',
    occasion: 'Nine Nights of Shakti · Deep crimson, rose & sacred gold',
    bannerText: 'Shubh Navratri · Celebrating Matrushakti, Courage & Devotion',
    accentHex: '#BE123C',
    accentBgClass: 'bg-rose-700 hover:bg-rose-800',
    accentTextClass: 'text-rose-700 dark:text-rose-400',
    bannerClasses: 'bg-rose-50 text-rose-950 border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-900/50',
    topStripGradient: 'from-rose-700 via-orange-600 to-amber-500',
    pageBgTint: 'bg-[#FFF9FA] dark:bg-slate-950',
    cardAccentBorder: 'border-rose-200 dark:border-rose-900/40',
    swatchColors: ['#BE123C', '#F43F5E', '#D97706'],
  },
  ram_navami: {
    id: 'ram_navami',
    name: 'Ram Navami Theme',
    gujaratiName: 'શ્રી રામ નવમી મહોત્સવ',
    occasion: 'Maryada & Dharma · Sacred kesariya saffron & vermilion',
    bannerText: 'Jai Shri Ram · Ram Navami Celebrations & Community Seva',
    accentHex: '#C2410C',
    accentBgClass: 'bg-orange-700 hover:bg-orange-800',
    accentTextClass: 'text-orange-700 dark:text-orange-400',
    bannerClasses: 'bg-orange-50 text-orange-950 border-orange-200 dark:bg-orange-950/50 dark:text-orange-200 dark:border-orange-900/50',
    topStripGradient: 'from-orange-700 via-orange-500 to-amber-500',
    pageBgTint: 'bg-[#FFFBF7] dark:bg-slate-950',
    cardAccentBorder: 'border-orange-200 dark:border-orange-900/50',
    swatchColors: ['#C2410C', '#EA580C', '#FBBF24'],
  },
  hanuman_jayanti: {
    id: 'hanuman_jayanti',
    name: 'Hanuman Jayanti Theme',
    gujaratiName: 'હનુમાન જયંતિ શક્તિ પર્વ',
    occasion: 'Seva & Strength · Sindoor vermilion & radiant saffron',
    bannerText: 'Hanuman Jayanti · Devotion, Strength & Youth Service Week',
    accentHex: '#DC2626',
    accentBgClass: 'bg-red-600 hover:bg-red-700',
    accentTextClass: 'text-red-700 dark:text-red-400',
    bannerClasses: 'bg-red-50 text-red-950 border-red-200 dark:bg-red-950/50 dark:text-red-200 dark:border-red-900/50',
    topStripGradient: 'from-red-600 via-orange-600 to-amber-500',
    pageBgTint: 'bg-[#FFF9F8] dark:bg-slate-950',
    cardAccentBorder: 'border-red-200 dark:border-red-900/40',
    swatchColors: ['#DC2626', '#EA580C', '#FDE68A'],
  },
  janmashtami: {
    id: 'janmashtami',
    name: 'Janmashtami Theme',
    gujaratiName: 'શ્રી કૃષ્ણ જન્માષ્ટમી',
    occasion: 'VHP Foundation Day · Peacock teal, flute gold & indigo',
    bannerText: 'Shri Krishna Janmashtami & VHP Foundation Day Greetings',
    accentHex: '#0F766E',
    accentBgClass: 'bg-teal-700 hover:bg-teal-800',
    accentTextClass: 'text-teal-700 dark:text-teal-400',
    bannerClasses: 'bg-teal-50 text-teal-950 border-teal-200 dark:bg-teal-950/50 dark:text-teal-200 dark:border-teal-900/50',
    topStripGradient: 'from-teal-700 via-indigo-600 to-amber-500',
    pageBgTint: 'bg-[#F7FCFC] dark:bg-slate-950',
    cardAccentBorder: 'border-teal-200 dark:border-teal-900/40',
    swatchColors: ['#0F766E', '#4338CA', '#F59E0B'],
  },
  holi: {
    id: 'holi',
    name: 'Holi Theme',
    gujaratiName: 'હોળી – રંગોત્સવ',
    occasion: 'Festival of Unity & Colors · Vibrant saffron, green & magenta',
    bannerText: 'Shubh Holi · Unity, Brotherhood & Joyful Cultural Greetings',
    accentHex: '#A21CAF',
    accentBgClass: 'bg-fuchsia-700 hover:bg-fuchsia-800',
    accentTextClass: 'text-fuchsia-700 dark:text-fuchsia-400',
    bannerClasses: 'bg-fuchsia-50 text-fuchsia-950 border-fuchsia-200 dark:bg-fuchsia-950/50 dark:text-fuchsia-200 dark:border-fuchsia-900/50',
    topStripGradient: 'from-fuchsia-600 via-orange-500 to-emerald-600',
    pageBgTint: 'bg-[#FDF9FF] dark:bg-slate-950',
    cardAccentBorder: 'border-fuchsia-200 dark:border-fuchsia-900/40',
    swatchColors: ['#A21CAF', '#EA580C', '#16A34A'],
  },
  makar_sankranti: {
    id: 'makar_sankranti',
    name: 'Makar Sankranti Theme',
    gujaratiName: 'મકર સંક્રાંતિ · ઉત્તરાયણ',
    occasion: 'Uttarayan Harvest · Clear sky blue & warm sun gold',
    bannerText: 'Happy Makar Sankranti · Uttarayan Cultural & Seva Greetings',
    accentHex: '#0284C7',
    accentBgClass: 'bg-sky-700 hover:bg-sky-800',
    accentTextClass: 'text-sky-700 dark:text-sky-400',
    bannerClasses: 'bg-sky-50 text-sky-950 border-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-900/50',
    topStripGradient: 'from-sky-600 via-amber-500 to-emerald-600',
    pageBgTint: 'bg-[#F7FBFF] dark:bg-slate-950',
    cardAccentBorder: 'border-sky-200 dark:border-sky-900/40',
    swatchColors: ['#0284C7', '#F59E0B', '#15803D'],
  },
};

export const FESTIVAL_THEME_LIST: FestivalThemeConfig[] = Object.values(FESTIVAL_THEMES);
