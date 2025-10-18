(function(){
  'use strict';

  window.I18N = {
    ru: {
      appTitle: "Lexitron",
      tagline: "Он научит!",

      modeHard: "Сложный режим",
modeNormal: "Обычный режим",
donateTitle: "Поддержать проект",
settingsTitle: "Настройки",
      settingsInDev: "",
      confirmTitle: "Подтверждение",
      confirmOk: "ОК",
      confirmCancel: "Отмена",
      confirmModeReset: "Переключение режима сбросит прогресс в текущем словаре. Продолжить?",
      confirmFavReset: "Очистить «Избранное» для активного языка? Действие нельзя отменить.",
      confirmMistakesReset: "Очистить «Мои ошибки» для активного языка? Действие нельзя отменить.",

      ok: "OK",
      choose: "Выберите перевод",
      iDontKnow: "Не знаю",

      modalTitle: "Словари",
      dictsHeader: "Словари",
      langLabel: "Язык",
      repeatLabel: "Сложность",
      themeLabel: "Тема",
      tt_ui_theme: "Тема",
      tt_ui_lang: "Язык интерфейса",
      tt_dicts: "Словари",
      tt_favorites: "Избранное",
      tt_help: "Инструкция",
      tt_support: "Поддержка",
      tt_settings: "Настройки",

      totalWords: "Всего слов в словаре",
      learned: "Выучено",
      errors: "Ошибок",
      badgeSetWords: "Слов в наборе",
      badgeLearned: "Выучено",

      mistakesName: "Мои ошибки",
      allMistakesDone: "Все ошибки закрыты!",
      favTitle: "Избранное",
      ttPreview: "Предпросмотр",

      pos_verbs: "Глаголы",
      pos_nouns: "Существительные",
      pos_adjs: "Прилагательные",
      pos_advs: "Наречия",
      pos_preps: "Предлоги",
      pos_pronouns: "Местоимения",
      pos_conjs: "Союзы",
      pos_particles: "Частицы",
      pos_numbers: "Числительные",
      pos_misc: "Словарь",

      infoTitle: "Инструкция",
      infoSteps: [
        "Запоминайте слова — увидели слово — выберите перевод.",
        "Добавляйте в Избранное — отмечайте важные слова, чтобы вернуться к ним позже.",
        "Используйте кнопку «Не знаю» — это помогает продвигаться дальше и не считается ошибкой."
      ],
      version: "Версия",
      status: "Статус",
      licensed: "Зарегистрировано",
      notLicensed: "Не зарегистрировано",
    },

    uk: {
      appTitle: "Lexitron",
      tagline: "Він навчить!",

      modeHard: "Складний режим",
modeNormal: "Звичайний режим",
donateTitle: "Підтримати проєкт",
settingsTitle: "Налаштування",
      settingsInDev: "",
      confirmTitle: "Підтвердження",
      confirmOk: "ОК",
      confirmCancel: "Скасувати",
      confirmModeReset: "Перемикання режиму скине прогрес у поточному словнику. Продовжити?",
      confirmFavReset: "Очистити «Обране» для активної мови? Дію не можна скасувати.",
      confirmMistakesReset: "Очистити «Мої помилки» для активної мови? Дію не можна скасувати.",

      ok: "OK",
      choose: "Оберіть переклад",
      iDontKnow: "Не знаю",

      modalTitle: "Словники",
      dictsHeader: "Словники",
      langLabel: "Мова",
      repeatLabel: "Складність",
      themeLabel: "Тема",
      tt_ui_theme: "Тема",
      tt_ui_lang: "Мова інтерфейсу",
      tt_dicts: "Словники",
      tt_favorites: "Обране",
      tt_help: "Інструкція",
      tt_support: "Підтримка",
      tt_settings: "Налаштування",

      totalWords: "Всього слів в словнику",
      learned: "Вивчено",
      errors: "Помилок",
      badgeSetWords: "Слів у наборі",
      badgeLearned: "Вивчено",

      mistakesName: "Мої помилки",
      allMistakesDone: "Усі помилки закриті!",
      favTitle: "Обране",
      ttPreview: "Попередній перегляд",

      pos_verbs: "Дієслова",
      pos_nouns: "Іменники",
      pos_adjs: "Прикметники",
      pos_advs: "Прислівники",
      pos_preps: "Прийменники",
      pos_pronouns: "Займенники",
      pos_conjs: "Сполучники",
      pos_particles: "Частки",
      pos_numbers: "Числівники",
      pos_misc: "Словник",

      infoTitle: "Інструкція",
      infoSteps: [
        "Запам’ятовуйте слова — побачили слово — оберіть переклад.",
        "Додавайте в Обране — позначайте важливі слова, щоб повернутися до них пізніше.",
        "Користуйтесь кнопкою «Не знаю» — це допомагає рухатися далі й не вважається помилкою."
      ],
      version: "Версія",
      status: "Статус",
      licensed: "Зареєстровано",
      notLicensed: "Не зареєстровано",
    },
  };

  try {
    if (window.App && App.locales) {
      App.locales.ru = Object.assign(App.locales.ru||{}, { allLangs: "Все языки",  lang_sr: "Сербский" });
      App.locales.uk = Object.assign(App.locales.uk||{}, { allLangs: "Всі мови",   lang_sr: "Сербська" });
    }
  } catch(_) {}

})();

(function(){
  try{
    var I = window.I18N || {};
    if (I.ru) Object.assign(I.ru, {
      backupTitle: "Резервное копирование",
      backupExport: "Экспортировать",
      backupImport: "Импортировать",
      backupExportOk: "Файл резервной копии успешно сохранён.",
      backupExportFail: "Ошибка при создании резервной копии.",
      backupImportOk: "Резервная копия восстановлена. Приложение перезапустится.",
      backupImportFail: "Ошибка восстановления. Проверьте файл."
    });
    if (I.uk) Object.assign(I.uk, {
      backupTitle: "Резервне копіювання",
      backupExport: "Експортувати",
      backupImport: "Імпортувати",
      backupExportOk: "Файл резервної копії успішно збережено.",
      backupExportFail: "Помилка під час створення резервної копії.",
      backupImportOk: "Резервну копію відновлено. Додаток перезапуститься.",
      backupImportFail: "Помилка відновлення. Перевірте файл."
    });
    if (I.en) Object.assign(I.en, {
      backupTitle: "Backup",
      backupExport: "Export",
      backupImport: "Import",
      backupExportOk: "Backup file saved successfully.",
      backupExportFail: "Failed to create backup file.",
      backupImportOk: "Backup restored. The app will restart.",
      backupImportFail: "Backup restore failed. Check the file."
    });
  }catch(_){}
})();
(function(){
  try{
    var I = window.I18N || {};
    if (I.ru) I.ru.modeSelection = "Выбор режима";
    if (I.uk) I.uk.modeSelection = "Вибір режиму";
    if (I.en) I.en.modeSelection = "Mode selection";
  }catch(_){}
})();
