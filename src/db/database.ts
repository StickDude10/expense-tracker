import * as SQLite from 'expo-sqlite';

export interface Expense {
  id: number;
  amount: number;
  category: string;
  description: string;
  date: string; // ISO string
}

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
}

const db = SQLite.openDatabaseSync('expenses.db');

export const initDb = () => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      icon TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category);
  `);

  // Seed default categories if table is empty
  try {
    const countRow = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM categories');
    if (countRow && countRow.count === 0) {
      const defaults = [
        ['Food', '#FF9F43', 'silverware-fork-knife'],
        ['Transport', '#0984E3', 'car'],
        ['Shopping', '#E84393', 'cart'],
        ['Entertainment', '#6C5CE7', 'movie-roll'],
        ['Bills', '#00B894', 'file-document'],
        ['Other', '#636E72', 'tag']
      ];
      const stmt = db.prepareSync('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)');
      defaults.forEach(def => {
        stmt.executeSync(def);
      });
      stmt.finalizeSync();
    }
  } catch (e) {
    console.error('Failed to seed categories', e);
  }
};

export const addExpense = (amount: number, category: string, description: string, date: string) => {
  const statement = db.prepareSync('INSERT INTO expenses (amount, category, description, date) VALUES (?, ?, ?, ?)');
  try {
    const result = statement.executeSync([amount, category, description, date]);
    return result.lastInsertRowId;
  } finally {
    statement.finalizeSync();
  }
};

export const getExpenses = (): Expense[] => {
  return db.getAllSync<Expense>('SELECT * FROM expenses ORDER BY date DESC');
};

export const getRecentDescriptionsByCategory = (category: string, limit: number = 5): string[] => {
  const results = db.getAllSync<{ description: string }>(
    'SELECT DISTINCT description FROM expenses WHERE category = ? AND description IS NOT NULL AND description != "" ORDER BY date DESC LIMIT ?',
    [category, limit]
  );
  return results.map(row => row.description);
};

export const getExpensesForMonth = (yearMonth: string): Expense[] => {
  // yearMonth expected as 'YYYY-MM'
  return db.getAllSync<Expense>(
    'SELECT * FROM expenses WHERE date LIKE ? ORDER BY date DESC',
    [`${yearMonth}%`]
  );
};

export const deleteExpense = (id: number) => {
  const statement = db.prepareSync('DELETE FROM expenses WHERE id = ?');
  try {
    statement.executeSync([id]);
  } finally {
    statement.finalizeSync();
  }
};

export const setSetting = (key: string, value: string) => {
  const statement = db.prepareSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  try {
    statement.executeSync([key, value]);
  } finally {
    statement.finalizeSync();
  }
};

export const getSetting = (key: string): string | null => {
  try {
    const row = db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
    return row ? row.value : null;
  } catch (e) {
    console.error('Failed to get setting', e);
    return null;
  }
};

export const getCategories = (): Category[] => {
  return db.getAllSync<Category>('SELECT * FROM categories ORDER BY name ASC');
};

export const addCategory = (name: string, color: string, icon: string): number => {
  const statement = db.prepareSync('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)');
  try {
    const result = statement.executeSync([name, color, icon]);
    return result.lastInsertRowId;
  } finally {
    statement.finalizeSync();
  }
};

export const deleteCategory = (id: number, name: string) => {
  db.withTransactionSync(() => {
    // 1. Update expenses belonging to this category to 'Other'
    const updateStmt = db.prepareSync("UPDATE expenses SET category = 'Other' WHERE category = ?");
    updateStmt.executeSync([name]);
    updateStmt.finalizeSync();

    // 2. Delete the category
    const deleteStmt = db.prepareSync('DELETE FROM categories WHERE id = ?');
    deleteStmt.executeSync([id]);
    deleteStmt.finalizeSync();
  });
};

export const updateCategory = (id: number, oldName: string, newName: string, color: string, icon: string) => {
  db.withTransactionSync(() => {
    // 1. Update category details
    const categoryStmt = db.prepareSync('UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ?');
    categoryStmt.executeSync([newName, color, icon, id]);
    categoryStmt.finalizeSync();

    // 2. If name changed, update the expenses
    if (oldName !== newName) {
      const expenseStmt = db.prepareSync('UPDATE expenses SET category = ? WHERE category = ?');
      expenseStmt.executeSync([newName, oldName]);
      expenseStmt.finalizeSync();
    }
  });
};
