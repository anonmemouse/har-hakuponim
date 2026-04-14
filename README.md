# 🏔️ הר הקופונים

> אפליקציאת אופליין בעברית לחילוץ קודי שובר, כרטיסי מתנה, קופונים וגיפטקארדס מתוך SMS backup.

##

<div align="center">

[![🚀 פתח את האפליקציה](https://img.shields.io/badge/🚀%20פתח%20את%20האפליקציה-anonmemouse.github.io%2Fhar--hakuponim-7c3aed?style=for-the-badge&logo=github)](https://anonmemouse.github.io/har-hakuponim/)

**[🏔️ https://anonmemouse.github.io/har-hakuponim/](https://anonmemouse.github.io/har-hakuponim/)**

</div>

---

## ✨ תכונות
- 📋 **כל קוד שובר בשורה נפרדת** עם כפתור העתקה מהירה
- 📊 **גרפים עתידניים**: עמודות / דונאט / רדאר / קוטבי + בחירת ציר
- 🔍 **כרטיסי סטטיסטיקה לחיצים** שמסננים את הטבלה
- 🌐 **תמיכה**: HTML, XML (SMS Backup & Restore), CSV
- 🌙 **Dark Mode** Glassmorphism 2026
- 🇮🇱 **עברית מלאה** RTL
- ✈️ **אופליין 100%** — הנתונים לא עוזבים את הדפדפן
- 🔥 **עדיפות אוטומטית** דחוף / בינוני / נמוך
- ⏰ **זיהוי תוקף** ואזהרה לשוברים שפגו
- ✅ **שינוי סטטוס** דרך dropdown + פעולות בקבוצה (bulk)
- 🔗 **ספקים קליקים** לאתר הספק / בדיקת יתרה
- 📲 **PWA** — ניתן להתקין כאפליקציה על המכשיר
- 🧪 **קובץ דוגמה** מובנה לטעינה מיידית

## 🚀 שימוש מידי
1. פתח **[https://anonmemouse.github.io/har-hakuponim/](https://anonmemouse.github.io/har-hakuponim/)**
2. לחץ **"טען קובץ דוגמה"** לבדיקה מידית, או טען קובץ SMS אמיתי
3. האפליקציה מחלצת ומציגה את כל קודי השובר
4. לחץ 📋 ליד כל קוד כדי להעתיק מיידית

## 📁 מבנה
```
har-hakuponim/
├── index.html      ← מבנה הדף
├── style.css       ← עיצוב Glassmorphism
├── app.js          ← לוגיקה מלאה
├── manifest.json   ← PWA manifest
├── sw.js           ← Service Worker
├── demo.xml        ← קובץ דוגמה (20 שוברים)
└── icons/          ← אייקונים PWA
```

## 🔍 זיהוי קודים
| סוג | דוגמה |
|-----|-------|
| BuyMe | `1234-5678-9012-3456` |
| UUID | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| אלפאנומרי | `ABC123DEF` |
| מספרי | `123456789012` |

## 📜 License
MIT — עשה בו כרצונך 🎉
