# Expense Tracker (React Native & Expo)

A beautiful, performant, and localized mobile expense tracker built using React Native, Expo SDK 57, and Material Design 3. The app is fully customized for Indian Rupee (`₹`) formatting, handles responsive dark/light theme options, and includes advanced analytical visualizations and backup utilities.

---

## 🚀 Tech Stack & Core Libraries

1. **Framework**: Expo SDK 57 (React Native / TypeScript)
2. **UI & Components**: `react-native-paper` (Material Design 3)
3. **Database Layer**: `expo-sqlite` (Local, zero-dependency SQLite backend)
4. **Data Visualization**: `react-native-svg` (Custom vector line and bar charts)
5. **Reminders & Push**: `expo-notifications` (Local background daily alarm triggers)
6. **PDF Generation**: `expo-print` & `expo-sharing` (HTML to styled PDF compiling)
7. **Document Management**: `expo-document-picker` (SQLite backup restore utility)
8. **Date Helpers**: `date-fns` (Filtering, calculations, and localization formatting)

---

## 📂 File Architecture & Project Layout

```text
expense-tracker/
├── App.tsx                   # Main entry point, theme preferences context, navigation tabs setup
├── index.ts                  # App registry bootstrapper
├── app.json                  # Expo configurations (package identifier, permissions, icons metadata)
├── package.json              # App dependencies list
├── tsconfig.json             # TypeScript rules configuration
├── assets/                   # High-res app logos, adaptive launcher files, and splash screens
└── src/
    ├── db/
    │   └── database.ts       # Database bootstrap, seeds, speed indexing, and CRUD methods
    ├── utils/
    │   └── notifications.ts  # Notification permissions validation and daily alarm scheduler
    └── screens/
        ├── HomeScreen.tsx    # Dashboard metrics, budget progress bar, recent list, and category split
        ├── AddExpenseScreen.tsx # Manual entry, dynamic category picker, and description auto-suggestions
        ├── HistoryScreen.tsx # Multi-preset date bounds, category filters, CSV share list, and transaction removal
        ├── AnalyticsScreen.tsx # Month-by-month pagination, line/bar charts, insights, and PDF export
        └── SettingsScreen.tsx # Light/Dark theme radio buttons, reminder schedules, category editor, and file backups
```

---

## 🗄️ Database Schemas (SQLite)

The database file resides locally at `SQLite/expenses.db` and contains three tables:

### 1. `expenses` Table
Tracks individual expenditure entries.
* `id` (INTEGER, Primary Key, Autoincrement)
* `amount` (REAL, Not Null)
* `category` (TEXT, Not Null)
* `description` (TEXT)
* `date` (TEXT, Not Null, ISO 8601 String)

### 2. `categories` Table
Stores color-coded customizable expense buckets.
* `id` (INTEGER, Primary Key, Autoincrement)
* `name` (TEXT, Unique, Not Null)
* `color` (TEXT, Not Null, Hex Color Code)
* `icon` (TEXT, Not Null, Material Community Icon Name)

### 3. `settings` Table
Key-Value configuration pair table.
* `key` (TEXT, Primary Key)
* `value` (TEXT, Not Null)

### 💡 Optimization Indexes
To maintain instantaneous loading as transaction history grows, the database automatically provisions indices on query-heavy columns:
```sql
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category);
```

---

## ✨ Implemented Core Features

### 1. Custom Category Manager (CRUD)
- Manage transaction categories dynamically inside settings. Add names, choose colors from a curated theme palette, and pick icons from a set of common financial glyphs.
- Custom categories instantly sync to the Add Expense and Home Screen pages. Deleting a category safely cascades and reassigns its transactions to the fallback "Other" category.

### 2. Month-by-Month Analytics Pager
- Slide between months in the **Analytics** tab to view your past spending habits.
- Metric cards (Daily Average, Total Spent, Top Category) and charts automatically recalculate for the selected month.
- An expandable **Monthly Transactions Drawer** lists every item logged in that month.

### 3. Native SVG Charts & Dashboards
- **6-Month Trend Chart**: Area-filled SVG line graph charting your spending path.
- **Weekly Comparison Chart**: Side-by-side vertical bar chart comparing daily spending this week vs. last week.

### 4. Smart Description Auto-Suggest
- When entering a transaction, the app queries the database for the 5 most common historical descriptions under the selected category and presents them as one-tap suggestion chips.

### 5. Document Backup & Restore
- **Export**: Copy your local SQLite file safely to external storage or send it via email.
- **Import**: Pick a `.db` backup file to overwrite/restore all metrics instantly.

### 6. Styled PDF Export
- Compiles the selected month's metrics, category charts, and complete transaction lists into a print-ready HTML page, exports it to PDF, and triggers the share sheet.

---

## 🛠️ Local Android Compile Instructions (Windows)

To build the standalone `.apk` on a Windows machine utilizing native Gradle compiling:

1. **Prerequisites**: 
   - JDK 17 installed (normally at `C:\Program Files\Java\jdk-17`).
   - Android SDK Command-line Tools installed (normally at `C:\Users\<username>\AppData\Local\Android\Sdk`).

2. **Command Workflow**:
   Run these commands inside PowerShell from your project root:
   ```powershell
   # 1. Sync React Native icons and configs to android folder
   npx expo prebuild --platform android

   # 2. Navigate to native android directory
   cd android

   # 3. Load Java Development Kit paths for compiling
   $env:JAVA_HOME="C:\Program Files\Java\jdk-17"
   $env:Path+=";C:\Program Files\Java\jdk-17\bin"

   # 4. Compile the release app bundle APK
   .\gradlew assembleRelease
   ```

3. **Output Path**:
   Find the ready-to-install app installer at:
   `android/app/build/outputs/apk/release/app-release.apk`
