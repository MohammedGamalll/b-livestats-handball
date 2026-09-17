// Minimal AR/EN i18n with localStorage persistence.
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Lang = "en" | "ar";

const dict: Record<string, { en: string; ar: string }> = {
  // Common
  "app.name": { en: "B LiveStats", ar: "ب لايف ستاتس" },
  "common.home": { en: "Home", ar: "الرئيسية" },
  "common.start": { en: "Start", ar: "بدء" },
  "common.stop": { en: "Stop", ar: "إيقاف" },
  "common.undo": { en: "Undo", ar: "تراجع" },
  "common.print": { en: "Print", ar: "طباعة" },
  "common.export": { en: "Export", ar: "تصدير" },
  "common.save": { en: "Save", ar: "حفظ" },
  "common.cancel": { en: "Cancel", ar: "إلغاء" },

  // Menus
  "menu.file": { en: "File", ar: "ملف" },
  "menu.game": { en: "Game", ar: "المباراة" },
  "menu.reports": { en: "Reports", ar: "التقارير" },
  "menu.settings": { en: "Settings", ar: "الإعدادات" },
  "menu.help": { en: "Help", ar: "مساعدة" },
  "menu.newGame": { en: "New Game", ar: "مباراة جديدة" },

  // Game
  "game.scoreboard": { en: "Scoreboard View", ar: "شاشة النتيجة" },
  "game.boxscore": { en: "Box Score", ar: "إحصائيات اللاعبين" },
  
  "game.standings": { en: "Standings", ar: "الترتيب" },
  "game.heatmap": { en: "Heatmap", ar: "خريطة حرارية" },
  "game.starters": { en: "Starters", ar: "الأساسيين" },
  "game.bench": { en: "Bench", ar: "البدلاء" },
  "game.timeouts": { en: "Timeouts", ar: "وقت مستقطع" },
  "game.suspensions": { en: "Suspensions", ar: "الإيقافات" },
  "game.actionLog": { en: "Action Log", ar: "سجل الأحداث" },
  "game.half": { en: "Half", ar: "الشوط" },
  "game.possession": { en: "Possession", ar: "الاستحواذ" },
};

interface State {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

export const useI18n = create<State>()(
  persist(
    (set, get) => ({
      lang: "en",
      setLang: (lang) => {
        set({ lang });
        if (typeof document !== "undefined") {
          document.documentElement.lang = lang;
          document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
        }
      },
      t: (key) => {
        const entry = dict[key];
        if (!entry) return key;
        return entry[get().lang] ?? entry.en;
      },
    }),
    {
      name: "b-livestats-lang",
      onRehydrateStorage: () => (state) => {
        if (state && typeof document !== "undefined") {
          document.documentElement.lang = state.lang;
          document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
        }
      },
    },
  ),
);
