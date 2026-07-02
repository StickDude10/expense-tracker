import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Text, Title, useTheme, List, Divider, ProgressBar, IconButton, Dialog, Portal, TextInput, Button } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { getExpenses, getSetting, setSetting, getCategories, Expense, Category } from '../db/database';
import { isToday, isThisWeek, isThisMonth, parseISO } from 'date-fns';
import { formatRupee } from './HistoryScreen';

export default function HomeScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budget, setBudget] = useState<number>(15000);
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const theme = useTheme();

  const loadExpenses = useCallback(() => {
    try {
      const data = getExpenses();
      setExpenses(data);
      
      const list = getCategories();
      setCategories(list);
      
      const savedBudget = getSetting('monthly_budget');
      if (savedBudget) {
        const parsed = parseFloat(savedBudget);
        if (!isNaN(parsed)) {
          setBudget(parsed);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useFocusEffect(loadExpenses);

  const handleSaveBudget = () => {
    const parsed = parseFloat(budgetInput);
    if (isNaN(parsed) || parsed <= 0) {
      alert('Please enter a valid budget amount');
      return;
    }
    try {
      setSetting('monthly_budget', parsed.toString());
      setBudget(parsed);
      setIsBudgetDialogOpen(false);
    } catch (e) {
      console.error(e);
      alert('Failed to save budget');
    }
  };

  const getCategoryDetails = (catName: string) => {
    const cat = categories.find(c => c.name === catName);
    return {
      color: cat ? cat.color : theme.colors.primary,
      icon: cat ? cat.icon : 'tag'
    };
  };

  const todayTotal = expenses
    .filter(e => isToday(parseISO(e.date)))
    .reduce((sum, e) => sum + e.amount, 0);

  const weekTotal = expenses
    .filter(e => isThisWeek(parseISO(e.date)))
    .reduce((sum, e) => sum + e.amount, 0);

  const monthTotal = expenses
    .filter(e => isThisMonth(parseISO(e.date)))
    .reduce((sum, e) => sum + e.amount, 0);

  const recentExpenses = expenses.slice(0, 5);

  const thisMonthExpenses = expenses.filter(e => isThisMonth(parseISO(e.date)));
  const totalMonthExpenses = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  const categoryBreakdown = categories.map(cat => {
    const amount = thisMonthExpenses
      .filter(e => e.category === cat.name)
      .reduce((sum, e) => sum + e.amount, 0);
    const percentage = totalMonthExpenses > 0 ? (amount / totalMonthExpenses) : 0;
    return { category: cat.name, color: cat.color, amount, percentage };
  })
    .filter(c => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={[styles.card, { marginBottom: 16 }]}>
        <Card.Content>
          <Text variant="titleMedium">Today's Expenses</Text>
          <Text variant="displayMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
            {formatRupee(todayTotal)}
          </Text>
        </Card.Content>
      </Card>
      
      <View style={styles.summaryContainer}>
        <Card style={styles.halfCard}>
          <Card.Content>
            <Text variant="titleMedium">This Week</Text>
            <Text variant="headlineSmall" style={{ color: theme.colors.primary }}>{formatRupee(weekTotal)}</Text>
          </Card.Content>
        </Card>
        <Card style={styles.halfCard}>
          <Card.Content>
            <Text variant="titleMedium">This Month</Text>
            <Text variant="headlineSmall" style={{ color: theme.colors.primary }}>{formatRupee(monthTotal)}</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Monthly Budget Card */}
      <Card style={[styles.card, { marginBottom: 16 }]}>
        <Card.Content>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Monthly Budget Progress</Text>
            <IconButton
              icon="pencil-outline"
              size={20}
              onPress={() => {
                setBudgetInput(budget.toString());
                setIsBudgetDialogOpen(true);
              }}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text variant="bodyMedium">Spent: {formatRupee(monthTotal)}</Text>
            <Text variant="bodyMedium">Budget: {formatRupee(budget)}</Text>
          </View>
          <ProgressBar
            progress={budget > 0 ? Math.min(monthTotal / budget, 1) : 0}
            color={
              monthTotal / budget > 0.9
                ? theme.colors.error
                : monthTotal / budget > 0.75
                ? '#FF9F43'
                : theme.colors.primary
            }
            style={{ height: 8, borderRadius: 4 }}
          />
          {budget > 0 && monthTotal > budget && (
            <Text style={{ color: theme.colors.error, marginTop: 8, fontSize: 12, fontWeight: 'bold' }}>
              ⚠️ You have exceeded your monthly budget by {formatRupee(monthTotal - budget)}!
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* Category Breakdown Card */}
      <Card style={[styles.card, { marginBottom: 16 }]}>
        <Card.Content>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 12 }}>
            Monthly Category Breakdown
          </Text>
          {categoryBreakdown.length === 0 ? (
            <Text style={styles.emptyText}>No expenses recorded this month.</Text>
          ) : (
            categoryBreakdown.map((item) => (
              <View key={item.category} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                    <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
                      {item.category} ({Math.round(item.percentage * 100)}%)
                    </Text>
                  </View>
                  <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>
                    {formatRupee(item.amount)}
                  </Text>
                </View>
                <ProgressBar
                  progress={item.percentage}
                  color={item.color}
                  style={{ height: 6, borderRadius: 3, marginTop: 6 }}
                />
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      <Text variant="titleLarge" style={styles.sectionTitle}>Recent Transactions</Text>
      <Card style={[styles.card, { marginBottom: 20 }]}>
        {recentExpenses.length === 0 ? (
          <Card.Content>
            <Text style={styles.emptyText}>No recent expenses.</Text>
          </Card.Content>
        ) : (
          recentExpenses.map((expense, index) => {
            const catDetails = getCategoryDetails(expense.category);
            return (
              <React.Fragment key={expense.id}>
                <List.Item
                  title={expense.category}
                  description={expense.description || 'No description'}
                  left={props => (
                    <View
                      style={{
                        backgroundColor: catDetails.color,
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        justifyContent: 'center',
                        alignItems: 'center',
                        alignSelf: 'center',
                        marginLeft: 16,
                      }}
                    >
                      <List.Icon {...props} icon={catDetails.icon} color="white" style={{ margin: 0 }} />
                    </View>
                  )}
                  right={props => <Text {...props} style={[styles.amount, { color: theme.colors.error }]}>-{formatRupee(expense.amount)}</Text>}
                />
                {index < recentExpenses.length - 1 && <Divider />}
              </React.Fragment>
            );
          })
        )}
      </Card>
      <Portal>
        <Dialog visible={isBudgetDialogOpen} onDismiss={() => setIsBudgetDialogOpen(false)}>
          <Dialog.Title>Set Monthly Budget</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Budget (₹)"
              value={budgetInput}
              onChangeText={setBudgetInput}
              keyboardType="numeric"
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsBudgetDialogOpen(false)}>Cancel</Button>
            <Button onPress={handleSaveBudget}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  summaryContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  card: { width: '100%' },
  halfCard: { flex: 1, marginHorizontal: 4 },
  sectionTitle: { marginBottom: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 10, color: 'gray' },
  amount: { alignSelf: 'center', fontWeight: 'bold', fontSize: 16 },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
});
