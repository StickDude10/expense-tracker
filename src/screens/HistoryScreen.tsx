import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, FlatList, ScrollView, Pressable, Platform } from 'react-native';
import { List, Text, useTheme, IconButton, Divider, Searchbar, Chip, TextInput } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getExpenses, deleteExpense, Expense, getCategories, Category } from '../db/database';
import { format, parseISO, isToday, isThisWeek, isThisMonth, subMonths, isWithinInterval, startOfDay, endOfDay, isSameMonth } from 'date-fns';

export const formatRupee = (amount: number): string => {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
  return `₹${formatted}`;
};

export default function HistoryScreen({ navigation }: any) {
  const theme = useTheme();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Date range state
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month' | 'lastMonth' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const loadExpenses = useCallback(() => {
    try {
      const data = getExpenses();
      setExpenses(data);
      
      const list = getCategories();
      setCategories(list);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useFocusEffect(loadExpenses);

  const handleExportCSV = async () => {
    if (expenses.length === 0) {
      alert('No expenses to export');
      return;
    }

    try {
      let csvContent = 'ID,Date,Category,Amount,Description\n';
      expenses.forEach(e => {
        const formattedDate = format(parseISO(e.date), 'yyyy-MM-dd HH:mm:ss');
        const escapedDesc = e.description ? `"${e.description.replace(/"/g, '""')}"` : '';
        csvContent += `${e.id},"${formattedDate}","${e.category}",${e.amount},${escapedDesc}\n`;
      });

      const fileUri = `${FileSystem.documentDirectory}expenses_export.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Expenses',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        alert('Sharing is not available on this device');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to export CSV file');
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon="export-variant"
          onPress={handleExportCSV}
          iconColor={theme.colors.onSurface}
        />
      ),
    });
  }, [navigation, expenses, theme]);

  const handleDelete = (id: number) => {
    try {
      deleteExpense(id);
      loadExpenses();
    } catch (e) {
      console.error('Failed to delete expense', e);
    }
  };

  const filteredExpenses = expenses.filter(e => {
    const matchesCategory = selectedCategory === 'All' || e.category === selectedCategory;
    const matchesSearch = 
      e.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.description && e.description.toLowerCase().includes(searchQuery.toLowerCase()));
      
    let matchesDate = true;
    const expenseDate = parseISO(e.date);
    const now = new Date();
    
    if (dateRange === 'today') {
      matchesDate = isToday(expenseDate);
    } else if (dateRange === 'week') {
      matchesDate = isThisWeek(expenseDate);
    } else if (dateRange === 'month') {
      matchesDate = isThisMonth(expenseDate);
    } else if (dateRange === 'lastMonth') {
      const lastMonth = subMonths(now, 1);
      matchesDate = isSameMonth(expenseDate, lastMonth);
    } else if (dateRange === 'custom') {
      matchesDate = isWithinInterval(expenseDate, {
        start: startOfDay(customStartDate),
        end: endOfDay(customEndDate)
      });
    }
    
    return matchesCategory && matchesSearch && matchesDate;
  });

  const getCategoryDetails = (catName: string) => {
    const cat = categories.find(c => c.name === catName);
    return {
      color: cat ? cat.color : theme.colors.primary,
      icon: cat ? cat.icon : 'tag'
    };
  };

  const renderItem = ({ item }: { item: Expense }) => {
    const catDetails = getCategoryDetails(item.category);
    return (
      <List.Item
        title={item.category}
        description={`${format(parseISO(item.date), 'MMM dd, yyyy')}${item.description ? ` - ${item.description}` : ''}`}
        left={props => (
          <View
            style={{
              backgroundColor: catDetails.color,
              width: 40,
              height: 40,
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
        right={props => (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.amount, { color: theme.colors.error }]}>-{formatRupee(item.amount)}</Text>
            <IconButton icon="delete" iconColor={theme.colors.error} size={20} onPress={() => handleDelete(item.id)} />
          </View>
        )}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder="Search expenses"
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />
      
      {/* Category Filter Chips */}
      <View style={styles.chipsOuter}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.chipsContent}
        >
          {['All', ...categories.map(c => c.name)].map(cat => (
            <Chip
              key={cat}
              selected={selectedCategory === cat}
              onPress={() => setSelectedCategory(cat)}
              style={styles.chip}
              showSelectedOverlay
            >
              {cat}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {/* Date Range Presets */}
      <View style={[styles.chipsOuter, { marginBottom: 12 }]}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.chipsContent}
        >
          <Chip selected={dateRange === 'all'} onPress={() => setDateRange('all')} showSelectedOverlay>All Time</Chip>
          <Chip selected={dateRange === 'today'} onPress={() => setDateRange('today')} showSelectedOverlay>Today</Chip>
          <Chip selected={dateRange === 'week'} onPress={() => setDateRange('week')} showSelectedOverlay>This Week</Chip>
          <Chip selected={dateRange === 'month'} onPress={() => setDateRange('month')} showSelectedOverlay>This Month</Chip>
          <Chip selected={dateRange === 'lastMonth'} onPress={() => setDateRange('lastMonth')} showSelectedOverlay>Last Month</Chip>
          <Chip selected={dateRange === 'custom'} onPress={() => setDateRange('custom')} showSelectedOverlay>Custom Range</Chip>
        </ScrollView>
      </View>

      {/* Custom Date Picker Inputs */}
      {dateRange === 'custom' && (
        <View style={styles.customDateRow}>
          <Pressable style={{ flex: 1, marginRight: 8 }} onPress={() => setShowStartPicker(true)}>
            <View pointerEvents="none">
              <TextInput
                label="Start Date"
                value={format(customStartDate, 'MMM dd, yyyy')}
                mode="outlined"
                dense
                style={styles.dateInput}
                editable={false}
              />
            </View>
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => setShowEndPicker(true)}>
            <View pointerEvents="none">
              <TextInput
                label="End Date"
                value={format(customEndDate, 'MMM dd, yyyy')}
                mode="outlined"
                dense
                style={styles.dateInput}
                editable={false}
              />
            </View>
          </Pressable>
        </View>
      )}

      {showStartPicker && (
        <DateTimePicker
          value={customStartDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowStartPicker(Platform.OS === 'ios');
            if (date) setCustomStartDate(date);
          }}
          maximumDate={customEndDate}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={customEndDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowEndPicker(Platform.OS === 'ios');
            if (date) setCustomEndDate(date);
          }}
          minimumDate={customStartDate}
          maximumDate={new Date()}
        />
      )}

      {filteredExpenses.length === 0 ? (
        <Text style={styles.emptyText}>No matching expenses found.</Text>
      ) : (
        <FlatList
          data={filteredExpenses}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <Divider />}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchbar: {
    margin: 16,
    marginBottom: 8,
  },
  chipsOuter: {
    marginBottom: 8,
    height: 48,
  },
  chipsContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    marginRight: 4,
  },
  customDateRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  dateInput: {
    height: 48,
  },
  emptyText: { textAlign: 'center', marginTop: 50, color: 'gray' },
  amount: { fontWeight: 'bold', fontSize: 16, marginRight: 8 },
});
