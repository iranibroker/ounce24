export interface BotTranslation {
  welcome: (count: number) => string;
  welcomeSignalMenu: string;
  firstSignalRewardMessage: string;
  joinChannelRequired: string;
  marketClosed: string;
  languageSelected: (lang: string) => string;
  selectLanguage: string;
  supportPrompt: string;
  supportSent: string;
  ibanPrompt: string;
  ibanInvalid: string;
  ibanSaved: string;
  searchPrompt: string;
  sendMessagePrompt: string;
  podcastText: string;
  podcastChannel: string;
  signalChannelPolicy: (minScore: string) => string;
  joinSignalChannel: string;
  riskWarning: string;
  aboutUs: string;
  buttons: {
    webApp: string;
    signalChannel: string;
    liveMarket: string;
    newSignal: string;
    closedSignals: string;
    mySignals: string;
    leaderboard: string;
    profileScore: string;
    myAlarms: string;
    priceAlarm: string;
    aiPodcast: string;
    goldChart: string;
    missionRisk: string;
    aboutUs: string;
    support: string;
    language: string;
  };
  pushNotifications: {
    aiShieldTitle: string;
    signalStatusTitle: string;
    signalCreated: (type: string) => string;
    signalCreatedByFollowing: (traderName: string, type: string) => string;
    signalActive: (type: string, price: string) => string;
    signalClosed: (type: string, result: string) => string;
    signalCanceled: (type: string) => string;
    buy: string;
    sell: string;
    makeRiskFree: string;
    closeSignal: string;
    applyNewTp: (price: string) => string;
    applyNewSl: (price: string) => string;
    cancelSignal: string;
    entryPrice: string;
    stopLoss: string;
    takeProfit: string;
    owner: string;
    viewAndApply: string;
  };
}

export const BOT_TRANSLATIONS: Record<string, BotTranslation> = {
  en: {
    firstSignalRewardMessage: `🎉 <b>Welcome!</b>\n\n` +
      `On the occasion of submitting your first signal on Ounce24, you have received a welcome reward of <b>10 Gems 💎</b>!\n\n` +
      `<b>What are Gems used for?</b>\n` +
      `• <b>AI Analysis:</b> Scientifically evaluate the success chance of signals (Cost: 1 Gem) 📊\n` +
      `• <b>Smart Shield:</b> Protect your trades from unexpected market volatility (Cost: 1 Gem) 🛡️\n` +
      `• <b>AI Assistant:</b> Automatically generate the best trading signals tailored to your style (Cost: 2 Gems) 🤖\n\n` +
      `Click the button below to enter the Ounce24 Web App and explore these advanced AI features. 👇`,
    welcome: (count: number) => `
Hi, I'm Ounce24 🥇
Use the options below to get started.
If you get stuck, use the menu button.

We've launched a new app for a better experience.

Bot members: ${count}
`,
    welcomeSignalMenu: `/new_signal Create new signal

/my_signals Manage your signals

/my_closed_signals Closed signals list

/charts Gold chart

/leaderboard Overall leaderboard

/leaderboard_week Weekly leaderboard

/support Support & feedback

/bank - Register bank IBAN

/profile View profile & score

/language Change language

/reset_all_profile Reset signal history (start over)
`,
    joinChannelRequired: `
Please join the channel below to use the bot.

@Ounce24_signal
`,
    marketClosed: `⚠️ <b>Market is Closed</b>\n\nSignals cannot be registered or created while the gold market is closed.`,
    languageSelected: (lang: string) => `✅ Language changed to ${lang}`,
    selectLanguage: '🌐 Select your preferred language:',
    supportPrompt: `For support and feedback, please contact our support team directly on Telegram:`,
    supportSent: 'Your message was sent to the team. Thanks for your feedback.',
    ibanPrompt: 'Please enter your IBAN for rewards:',
    ibanInvalid: 'Invalid IBAN. Please enter a valid 24-digit IBAN:',
    ibanSaved: '✅ Your IBAN has been saved',
    searchPrompt: 'Please enter your search term\n/cancel',
    sendMessagePrompt: 'Please enter your message\n/cancel',
    podcastText: `Our weekly podcasts are ~20 minute audio files with a detailed review of the past week and outlook for the week ahead. 📈
      
Content is based on the latest trusted sources and analyzed with AI in a data-driven way. 🤖
      
Podcasts are published weekly on the official Ounce24 channel. Join the channel and check the Music section for the full list. 🎧`,
    podcastChannel: 'Ounce24 Channel',
    signalChannelPolicy: (minScore: string) =>
      `<b>📢 Signal Channel Policy</b>\n\nSignals from users with a score above <b>${minScore} points</b> (either total or weekly) are automatically published to our channel.\n\nFollow successful traders to copy their signals and improve your results. You can also build your performance to reach this level and have your signals published!`,
    joinSignalChannel: 'Join Signal Channel',
    riskWarning:
      `<b>⚠️ Risk Warning & Mission</b>\n\n` +
      `• <b>Risk Warning:</b> Please use this bot strictly for educational purposes and demo trading. Do <b>NOT</b> trade on a live/real account based on these signals.\n\n` +
      `• <b>Our Mission:</b> We aim to gather top-tier traders in one place to compete, share strategies, and learn from one another.`,
    aboutUs:
      `<b>ℹ️ About Us</b>\n\n` +
      `Ounce24 is a platform dedicated to gold trading analysis, competition, and education. We help traders share ideas, track performance, and grow in a data-driven environment.\n\n` +
      `Visit our website for more details: https://ounce24.com`,
    buttons: {
      webApp: '📱 Web App',
      signalChannel: '📢 Signal channel',
      liveMarket: '📈 Live market',
      newSignal: '➕ New signal',
      closedSignals: '🎯 Closed',
      mySignals: '⛳️▶️ My signals',
      leaderboard: 'Leaderboard',
      profileScore: 'Profile & score',
      myAlarms: 'My alarms',
      priceAlarm: '🔔 Price alarm',
      aiPodcast: '🎙️ AI analysis podcast',
      goldChart: 'Gold chart',
      missionRisk: '🎯 Mission & Risk',
      aboutUs: 'ℹ️ About us',
      support: 'Support',
      language: '🌐 Language',
    },
    pushNotifications: {
      aiShieldTitle: 'Smart Shield',
      signalStatusTitle: 'Signal Status Update',
      signalCreated: (type: string) => `➕ Gold ${type} signal has been created!`,
      signalCreatedByFollowing: (traderName: string, type: string) => `📢 Trader ${traderName} you follow posted a new Gold ${type} signal!`,
      signalActive: (type: string, price: string) => `🔔 Gold ${type} signal is now ACTIVE!\nTrigger price: $${price}`,
      signalClosed: (type: string, result: string) => `🎯 Gold ${type} signal is now CLOSED!\nResult: ${result}`,
      signalCanceled: (type: string) => `🚫 Gold ${type} signal has been CANCELED.`,
      buy: 'BUY',
      sell: 'SELL',
      makeRiskFree: '🛡️ Make Risk Free',
      closeSignal: '🎯 Close Signal',
      applyNewTp: (price: string) => `📈 Apply New TP ($${price})`,
      applyNewSl: (price: string) => `🛡️ Apply New SL ($${price})`,
      cancelSignal: '🚫 Cancel Signal',
      entryPrice: 'Entry Price',
      stopLoss: 'Stop Loss',
      takeProfit: 'Take Profit',
      owner: 'Trader',
      viewAndApply: '🔍 View & Apply Changes',
    },
  },

  fa: {
    firstSignalRewardMessage: `🎉 <b>خوش آمدید!</b>\n\n` +
      `به مناسبت ثبت اولین سیگنال شما در اونس۲۴، جایزه اولین ورود به مقدار <b>۱۰ الماس 💎</b> به شما تعلق گرفت!\n\n` +
      `<b>الماس‌ها چه کاربردی دارند؟</b>\n` +
      `• <b>تحلیل هوش مصنوعی:</b> بررسی علمی شانس موفقیت سیگنال‌ها (هزینه: ۱ الماس) 📊\n` +
      `• <b>سپر هوشمند:</b> محافظت از معاملات شما در برابر نوسانات شدید بازار (هزینه: ۱ الماس) 🛡️\n` +
      `• <b>دستیار معاملاتی:</b> ساخت خودکار بهترین سیگنال‌ها متناسب با سبک شما (هزینه: ۲ الماس) 🤖\n\n` +
      `با کلیک بر روی دکمه زیر وارد وب‌اپلیکیشن اونس۲۴ شوید و از امکانات پیشرفته هوش مصنوعی استفاده کنید. 👇`,
    welcome: (count: number) => `
سلام، من اونس۲۴ هستم 🥇
برای شروع از گزینه‌های زیر استفاده کن.
اگر گیر کردی، از دکمه منو استفاده کن.

اپ جدیدی برای تجربه بهتر راه‌اندازی کردیم.

تعداد اعضا: ${count}
`,
    welcomeSignalMenu: `/new_signal ثبت سیگنال جدید

/my_signals مدیریت سیگنال‌های من

/my_closed_signals لیست سیگنال‌های بسته شده

/charts نمودار طلا

/leaderboard جدول امتیازات کلی

/leaderboard_week جدول امتیازات هفتگی

/support پشتیبانی و بازخورد

/bank ثبت شماره شبا

/profile مشاهده پروفایل و امتیاز

/language تغییر زبان

/reset_all_profile بازنشانی سابقه سیگنال (شروع مجدد)
`,
    joinChannelRequired: `
لطفاً برای استفاده از ربات، کانال زیر را جوین کن.

@Ounce24_signal
`,
    marketClosed: `⚠️ <b>بازار بسته است</b>\n\nامکان ثبت سیگنال جدید در زمان بسته بودن بازار طلا وجود ندارد.`,
    languageSelected: (lang: string) => `✅ زبان به ${lang} تغییر کرد`,
    selectLanguage: '🌐 زبان مورد نظر خود را انتخاب کنید:',
    supportPrompt: `برای پشتیبانی و ارسال بازخورد، لطفاً مستقیماً با پشتیبانی ما در تلگرام در ارتباط باشید:`,
    supportSent: 'پیام شما به تیم ارسال شد. ممنون از بازخوردت.',
    ibanPrompt: 'لطفاً شماره شبای خود را برای دریافت جوایز وارد کنید:',
    ibanInvalid: 'شبا نامعتبر است. لطفاً یک شبای ۲۴ رقمی معتبر وارد کنید:',
    ibanSaved: '✅ شبا ذخیره شد',
    searchPrompt: 'لطفاً عبارت جستجو را وارد کنید\n/cancel',
    sendMessagePrompt: 'لطفاً پیام خود را وارد کنید\n/cancel',
    podcastText: `پادکست‌های هفتگی ما فایل‌های صوتی ~۲۰ دقیقه‌ای هستند با مرور دقیق هفته گذشته و چشم‌انداز هفته آینده. 📈
      
محتوا بر اساس آخرین منابع معتبر تحلیل شده با هوش مصنوعی است. 🤖
      
پادکست‌ها به صورت هفتگی در کانال رسمی اونس۲۴ منتشر می‌شوند. کانال را جوین کنید و برای لیست کامل قسمت موزیک را بررسی کنید. 🎧`,
    podcastChannel: 'کانال اونس۲۴',
    signalChannelPolicy: (minScore: string) =>
      `<b>📢 قوانین کانال سیگنال</b>\n\nسیگنال‌های کاربرانی که امتیاز بالاتر از <b>${minScore} امتیاز</b> دارند (کل یا هفتگی) به صورت خودکار در کانال ما منتشر می‌شوند.\n\nتریدرهای موفق را دنبال کنید تا سیگنال‌هایشان را کپی کنید. شما هم می‌توانید به این سطح برسید!`,
    joinSignalChannel: 'عضویت در کانال سیگنال',
    riskWarning:
      `<b>⚠️ هشدار ریسک و ماموریت</b>\n\n` +
      `• <b>هشدار ریسک:</b> لطفاً از این ربات فقط برای اهداف آموزشی و تریدینگ دمو استفاده کنید. بر اساس این سیگنال‌ها با حساب واقعی معامله <b>نکنید</b>.\n\n` +
      `• <b>ماموریت ما:</b> هدف ما جمع‌آوری بهترین تریدرها در یک مکان برای رقابت، اشتراک استراتژی و یادگیری از یکدیگر است.`,
    aboutUs:
      `<b>ℹ️ درباره ما</b>\n\n` +
      `اونس۲۴ پلتفرمی است برای تحلیل تریدینگ طلا، رقابت و آموزش. به تریدرها کمک می‌کنیم ایده‌ها را به اشتراک بگذارند، عملکرد را پیگیری کنند و در محیطی داده‌محور رشد کنند.\n\n` +
      `برای اطلاعات بیشتر وب‌سایت ما را ببینید: https://ounce24.com`,
    buttons: {
      webApp: '📱 وب اپ',
      signalChannel: '📢 کانال سیگنال',
      liveMarket: '📈 بازار زنده',
      newSignal: '➕ سیگنال جدید',
      closedSignals: '🎯 بسته شده',
      mySignals: '⛳️▶️ سیگنال‌های من',
      leaderboard: 'جدول امتیازات',
      profileScore: 'پروفایل و امتیاز',
      myAlarms: 'آلارم‌های من',
      priceAlarm: '🔔 آلارم قیمت',
      aiPodcast: '🎙️ پادکست تحلیل هوش مصنوعی',
      goldChart: 'نمودار طلا',
      missionRisk: '🎯 ماموریت و ریسک',
      aboutUs: 'ℹ️ درباره ما',
      support: 'پشتیبانی',
      language: '🌐 زبان',
    },
    pushNotifications: {
      aiShieldTitle: 'سپر هوشمند',
      signalStatusTitle: 'به‌روزرسانی وضعیت سیگنال',
      signalCreated: (type: string) => `➕ سیگنال ${type} طلا با موفقیت ثبت شد!`,
      signalCreatedByFollowing: (traderName: string, type: string) => `📢 تریدر ${traderName} که دنبال می‌کنید، یک سیگنال جدید ${type} طلا ثبت کرد!`,
      signalActive: (type: string, price: string) => `🔔 سیگنال ${type} طلا فعال شد!\nقیمت فعال‌سازی: $${price}`,
      signalClosed: (type: string, result: string) => `🎯 سیگنال ${type} طلا بسته شد!\nنتیجه: ${result}`,
      signalCanceled: (type: string) => `🚫 سیگنال ${type} طلا لغو گردید.`,
      buy: 'خرید',
      sell: 'فروش',
      makeRiskFree: '🛡️ ریسک فری کردن',
      closeSignal: '🎯 بستن سیگنال',
      applyNewTp: (price: string) => `📈 ثبت حد سود جدید ($${price})`,
      applyNewSl: (price: string) => `🛡️ ثبت حد ضرر جدید ($${price})`,
      cancelSignal: '🚫 لغو سیگنال',
      entryPrice: 'نقطه ورود',
      stopLoss: 'حد ضرر',
      takeProfit: 'حد سود',
      owner: 'تریدر',
      viewAndApply: '🔍 مشاهده و اعمال تغییرات',
    },
  },

  ar: {
    firstSignalRewardMessage: `🎉 <b>مرحباً بك!</b>\n\n` +
      `بمناسبة تقديم إشارتك الأولى على Ounce24، حصلت على مكافأة ترحيبية بقيمة <b>10 جواهر 💎</b>!\n\n` +
      `<b>فيمَ تستخدم الجواهر؟</b>\n` +
      `• <b>تحليل الذكاء الاصطناعي:</b> تقييم علمي لفرصة نجاح الإشارات (التكلفة: جوهرة واحدة) 📊\n` +
      `• <b>الدرع الذكي:</b> حماية صفقاتك من تقلبات السوق المفاجئة (التكلفة: جوهرة واحدة) 🛡️\n` +
      `• <b>مساعد الذكاء الاصطناعي:</b> توليد إشارات التداول المثلى تلقائياً (التكلفة: جوهرتان) 🤖\n\n` +
      `انقر على الزر أدناه للدخول إلى تطبيق ويب Ounce24 واستكشاف ميزات الذكاء الاصطناعي. 👇`,
    welcome: (count: number) => `
مرحباً، أنا Ounce24 🥇
استخدم الخيارات أدناه للبدء.
إذا واجهت مشكلة، استخدم زر القائمة.

لقد أطلقنا تطبيقاً جديداً لتجربة أفضل.

أعضاء البوت: ${count}
`,
    welcomeSignalMenu: `/new_signal إنشاء إشارة جديدة

/my_signals إدارة إشاراتي

/my_closed_signals قائمة الإشارات المغلقة

/charts مخطط الذهب

/leaderboard لوحة الصدارة العامة

/leaderboard_week لوحة الصدارة الأسبوعية

/support الدعم والملاحظات

/bank تسجيل رقم IBAN

/profile عرض الملف الشخصي والنقاط

/language تغيير اللغة

/reset_all_profile إعادة تعيين سجل الإشارات (بدء من جديد)
`,
    joinChannelRequired: `
يرجى الانضمام إلى القناة أدناه لاستخدام البوت.

@Ounce24_signal
`,
    marketClosed: `⚠️ <b>السوق مغلق</b>\n\nلا يمكن تسجيل إشارة جديدة أثناء إغلاق سوق الذهب.`,
    languageSelected: (lang: string) => `✅ تم تغيير اللغة إلى ${lang}`,
    selectLanguage: '🌐 اختر لغتك المفضلة:',
    supportPrompt: `للدعم وإرسال الملاحظات، يرجى التواصل مباشرة مع فريق الدعم لدينا على تيليجرام:`,
    supportSent: 'تم إرسال رسالتك إلى الفريق. شكراً على ملاحظاتك.',
    ibanPrompt: 'يرجى إدخال رقم IBAN الخاص بك للمكافآت:',
    ibanInvalid: 'IBAN غير صالح. يرجى إدخال IBAN صالح مكون من 24 رقماً:',
    ibanSaved: '✅ تم حفظ IBAN الخاص بك',
    searchPrompt: 'يرجى إدخال مصطلح البحث\n/cancel',
    sendMessagePrompt: 'يرجى إدخال رسالتك\n/cancel',
    podcastText: `بودكاستاتنا الأسبوعية هي ملفات صوتية مدتها ~20 دقيقة مع مراجعة مفصلة للأسبوع الماضي وتوقعات الأسبوع القادم. 📈
      
المحتوى مبني على أحدث المصادر الموثوقة ويُحلَّل بالذكاء الاصطناعي. 🤖
      
تُنشر البودكاستات أسبوعياً على القناة الرسمية لـ Ounce24. انضم إلى القناة وتحقق من قسم الموسيقى للحصول على القائمة الكاملة. 🎧`,
    podcastChannel: 'قناة Ounce24',
    signalChannelPolicy: (minScore: string) =>
      `<b>📢 سياسة قناة الإشارات</b>\n\nتُنشر إشارات المستخدمين الذين لديهم نقاط أعلى من <b>${minScore} نقطة</b> (إجمالية أو أسبوعية) تلقائياً على قناتنا.\n\nتابع المتداولين الناجحين لنسخ إشاراتهم وتحسين نتائجك. يمكنك أيضاً بناء أدائك للوصول إلى هذا المستوى!`,
    joinSignalChannel: 'الانضمام إلى قناة الإشارات',
    riskWarning:
      `<b>⚠️ تحذير المخاطر والمهمة</b>\n\n` +
      `• <b>تحذير المخاطر:</b> يرجى استخدام هذا البوت فقط للأغراض التعليمية والتداول التجريبي. لا <b>تتداول</b> بحساب حقيقي بناءً على هذه الإشارات.\n\n` +
      `• <b>مهمتنا:</b> نهدف إلى جمع أفضل المتداولين في مكان واحد للتنافس ومشاركة الاستراتيجيات والتعلم من بعضهم البعض.`,
    aboutUs:
      `<b>ℹ️ عن Ounce24</b>\n\n` +
      `Ounce24 هي منصة مخصصة لتحليل تداول الذهب والمنافسة والتعليم. نساعد المتداولين على مشاركة الأفكار وتتبع الأداء والنمو في بيئة قائمة على البيانات.\n\n` +
      `زوروا موقعنا لمزيد من التفاصيل: https://ounce24.com`,
    buttons: {
      webApp: '📱 تطبيق الويب',
      signalChannel: '📢 قناة الإشارات',
      liveMarket: '📈 السوق المباشر',
      newSignal: '➕ إشارة جديدة',
      closedSignals: '🎯 المغلقة',
      mySignals: '⛳️▶️ إشاراتي',
      leaderboard: 'لوحة الصدارة',
      profileScore: 'الملف الشخصي والنقاط',
      myAlarms: 'تنبيهاتي',
      priceAlarm: '🔔 تنبيه السعر',
      aiPodcast: '🎙️ بودكاست تحليل الذكاء الاصطناعي',
      goldChart: 'مخطط الذهب',
      missionRisk: '🎯 المهمة والمخاطر',
      aboutUs: 'ℹ️ عن Ounce24',
      support: 'الدعم',
      language: '🌐 اللغة',
    },
    pushNotifications: {
      aiShieldTitle: 'درع الذكاء الاصطناعي الذكي',
      signalStatusTitle: 'تحديث حالة الإشارة',
      signalCreated: (type: string) => `➕ تم إنشاء إشارة الذهب ${type} بنجاح!`,
      signalCreatedByFollowing: (traderName: string, type: string) => `📢 المتداول ${traderName} الذي تتابعه نشر إشارة ${type} ذهب جديدة!`,
      signalActive: (type: string, price: string) => `🔔 تم تفعيل إشارة الذهب ${type}!\nسعر التفعيل: $${price}`,
      signalClosed: (type: string, result: string) => `🎯 تم إغلاق إشارة الذهب ${type}!\nالنتيجة: ${result}`,
      signalCanceled: (type: string) => `🚫 تم إلغاء إشارة الذهب ${type}.`,
      buy: 'شراء',
      sell: 'بيع',
      makeRiskFree: '🛡️ جعلها خالية من المخاطر',
      closeSignal: '🎯 إغلاق الإشارة',
      applyNewTp: (price: string) => `📈 تطبيق حد أرباح جديد ($${price})`,
      applyNewSl: (price: string) => `🛡️ تطبيق وقف خسارة جديد ($${price})`,
      cancelSignal: '🚫 إلغاء الإشارة',
      entryPrice: 'سعر الدخول',
      stopLoss: 'وقف الخسارة',
      takeProfit: 'أخذ الأرباح',
      owner: 'المتداول',
      viewAndApply: '🔍 عرض وتطبيق التغييرات',
    },
  },

  tr: {
    firstSignalRewardMessage: `🎉 <b>Hoş geldiniz!</b>\n\n` +
      `Ounce24'te ilk sinyalinizi oluşturduğunuz için <b>10 Elmas 💎</b> hoş geldin ödülü kazandınız!\n\n` +
      `<b>Elmaslar ne işe yarar?</b>\n` +
      `• <b>YZ Analizi:</b> Sinyallerin başarı şansını bilimsel olarak değerlendirin (Maliyet: 1 Elmas) 📊\n` +
      `• <b>Akıllı Kalkan:</b> İşlemlerinizi ani piyasa dalgalanmalarından koruyun (Maliyet: 1 Elmas) 🛡️\n` +
      `• <b>YZ Asistanı:</b> Tarzınıza uygun en iyi işlem sinyallerini otomatik olarak oluşturun (Maliyet: 2 Elmas) 🤖\n\n` +
      `Gelişmiş yapay zeka özelliklerini keşfetmek için aşağıdaki düğmeye tıklayarak Ounce24 Web Uygulamasına girin. 👇`,
    welcome: (count: number) => `
Merhaba, ben Ounce24 🥇
Başlamak için aşağıdaki seçenekleri kullan.
Takıldıysan menü düğmesini kullan.

Daha iyi bir deneyim için yeni bir uygulama başlattık.

Bot üyeleri: ${count}
`,
    welcomeSignalMenu: `/new_signal Yeni sinyal oluştur

/my_signals Sinyallerimi yönet

/my_closed_signals Kapalı sinyaller listesi

/charts Altın grafiği

/leaderboard Genel liderlik tablosu

/leaderboard_week Haftalık liderlik tablosu

/support Destek ve geri bildirim

/bank Banka IBAN kaydı

/profile Profil ve puanı görüntüle

/language Dil değiştir

/reset_all_profile Sinyal geçmişini sıfırla (yeniden başla)
`,
    joinChannelRequired: `
Botu kullanmak için aşağıdaki kanala katıl.

@Ounce24_signal
`,
    marketClosed: `⚠️ <b>Piyasa Kapalı</b>\n\nAltın piyasası kapalıyken yeni sinyal kaydedilemez.`,
    languageSelected: (lang: string) => `✅ Dil ${lang} olarak değiştirildi`,
    selectLanguage: '🌐 Tercih ettiğiniz dili seçin:',
    supportPrompt: `Destek ve geri bildirim için lütfen doğrudan Telegram üzerinden destek ekibimizle iletişime geçin:`,
    supportSent: 'Mesajınız ekibe iletildi. Geri bildiriminiz için teşekkürler.',
    ibanPrompt: 'Lütfen ödüller için IBAN numaranızı girin:',
    ibanInvalid: 'Geçersiz IBAN. Lütfen geçerli bir 24 haneli IBAN girin:',
    ibanSaved: '✅ IBAN\'ınız kaydedildi',
    searchPrompt: 'Lütfen arama teriminizi girin\n/cancel',
    sendMessagePrompt: 'Lütfen mesajınızı girin\n/cancel',
    podcastText: `Haftalık podcast\'lerimiz geçen haftanın ayrıntılı değerlendirmesi ve önümüzdeki haftanın görünümünü içeren ~20 dakikalık ses dosyalarıdır. 📈
      
İçerik, yapay zeka ile analiz edilen en güncel güvenilir kaynaklara dayanmaktadır. 🤖
      
Podcast\'ler her hafta resmi Ounce24 kanalında yayınlanır. Tam liste için kanala katılın ve Müzik bölümüne göz atın. 🎧`,
    podcastChannel: 'Ounce24 Kanalı',
    signalChannelPolicy: (minScore: string) =>
      `<b>📢 Sinyal Kanalı Politikası</b>\n\n<b>${minScore} puanın</b> üzerinde puana sahip kullanıcıların (toplam veya haftalık) sinyalleri otomatik olarak kanalımızda yayınlanır.\n\nSinyallerini kopyalamak ve sonuçlarınızı iyileştirmek için başarılı yatırımcıları takip edin. Bu seviyeye ulaşmak için performansınızı da geliştirebilirsiniz!`,
    joinSignalChannel: 'Sinyal Sorumlusu',
    riskWarning:
      `<b>⚠️ Risk Uyarısı ve Misyon</b>\n\n` +
      `• <b>Risk Uyarısı:</b> Lütfen bu botu yalnızca eğitim amaçlı ve demo işlem için kullanın. Bu sinyallere dayanarak gerçek/canlı hesapta <b>işlem yapmayın</b>.\n\n` +
      `• <b>Misyonumuz:</b> En iyi yatırımcıları bir araya getirerek rekabet etmelerini, strateji paylaşmalarını ve birbirlerinden öğrenmelerini sağlamayı hedefliyoruz.`,
    aboutUs:
      `<b>ℹ️ Hakkımızda</b>\n\n` +
      `Ounce24, altın işlem analizine, rekabete ve eğitime adanmış bir platformdur. Yatırımcıların fikirleri paylaşmasına, performansı takip etmesine ve veri odaklı bir ortamda büyümesine yardımcı oluyoruz.\n\n` +
      `Daha fazla ayrıntı için web sitemizi ziyaret edin: https://ounce24.com`,
    buttons: {
      webApp: '📱 Web Uygulaması',
      signalChannel: '📢 Sinyal kanalı',
      liveMarket: '📈 Canlı piyasa',
      newSignal: '➕ Yeni sinyal',
      closedSignals: '🎯 Kapalı',
      mySignals: '⛳️▶️ Sinyallerim',
      leaderboard: 'Liderlik tablosu',
      profileScore: 'Profil ve puan',
      myAlarms: 'Alarmlarım',
      priceAlarm: '🔔 Fiyat alarmı',
      aiPodcast: '🎙️ YZ analiz podcast',
      goldChart: 'Altın grafiği',
      missionRisk: '🎯 Misyon ve Risk',
      aboutUs: 'ℹ️ Hakkımızda',
      support: 'Destek',
      language: '🌐 Dil',
    },
    pushNotifications: {
      aiShieldTitle: 'Yapay Zeka Akıllı Kalkan',
      signalStatusTitle: 'Sinyal Durumu Güncellemesi',
      signalCreated: (type: string) => `➕ Altın ${type} sinyali başarıyla oluşturuldu!`,
      signalCreatedByFollowing: (traderName: string, type: string) => `📢 Takip ettiğiniz yatırımcı ${traderName}, yeni bir Altın ${type} sinyali oluşturdu!`,
      signalActive: (type: string, price: string) => `🔔 Altın ${type} sinyali artık AKTİF!\nTetikleme fiyatı: $${price}`,
      signalClosed: (type: string, result: string) => `🎯 Altın ${type} sinyali KAPATILDI!\nSonuç: ${result}`,
      signalCanceled: (type: string) => `🚫 Altın ${type} sinyali İPTAL EDİLDİ.`,
      buy: 'AL',
      sell: 'SAT',
      makeRiskFree: '🛡️ Risksiz Yap',
      closeSignal: '🎯 Sinyali Kapat',
      applyNewTp: (price: string) => `📈 Yeni TP Uygula ($${price})`,
      applyNewSl: (price: string) => `🛡️ Yeni SL Uygula ($${price})`,
      cancelSignal: '🚫 Sinyali İptal Et',
      entryPrice: 'Giriş Fiyatı',
      stopLoss: 'Zarar Durdur',
      takeProfit: 'Kâr Al',
      owner: 'Yatırımcı',
      viewAndApply: '🔍 Görüntüle ve Değişiklikleri Uygula',
    },
  },
};

export const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  en: 'English',
  fa: 'فارسی',
  ar: 'العربية',
  tr: 'Türkçe',
};

export function getTranslation(lang?: string): BotTranslation {
  return BOT_TRANSLATIONS[lang || 'en'] || BOT_TRANSLATIONS['en'];
}
