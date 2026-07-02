import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { TextInput, Button, useTheme, Text, Snackbar, Chip } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { addExpense, getCategories, Category, getRecentDescriptionsByCategory } from '../db/database';

export default function AddExpenseScreen({ navigation }: any) {
  const theme = useTheme();
  const [amount, setAmount] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const loadSuggestions = useCallback((cat: string) => {
    if (cat) {
      try {
        const list = getRecentDescriptionsByCategory(cat);
        setSuggestions(list);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  useEffect(() => {
    loadSuggestions(category);
  }, [category, loadSuggestions]);

  useFocusEffect(
    useCallback(() => {
      try {
        const list = getCategories();
        setCategories(list);
        if (list.length > 0) {
          if (!category || !list.some(c => c.name === category)) {
            setCategory(list[0].name);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }, [category])
  );

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const handleSave = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      addExpense(parsedAmount, category, description, date.toISOString());
      setSnackbarVisible(true);
      setAmount('');
      setDescription('');
      setDate(new Date()); // Reset to today
      loadSuggestions(category); // Reload suggestions
      // Optionally navigate back: navigation.goBack();
    } catch (e) {
      console.error(e);
      alert('Failed to save expense');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <TextInput
          label="Amount (₹)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          style={styles.input}
          mode="outlined"
          left={<TextInput.Affix text="₹" />}
        />

        <Text variant="titleMedium" style={styles.label}>Select Category</Text>
        <View style={styles.categoryContainer}>
          {categories.map(cat => (
            <Button
              key={cat.id}
              mode={category === cat.name ? 'contained' : 'outlined'}
              onPress={() => setCategory(cat.name)}
              style={styles.categoryButton}
              compact
            >
              {cat.name}
            </Button>
          ))}
        </View>

        <Pressable onPress={() => setShowDatePicker(true)}>
          <View pointerEvents="none">
            <TextInput
              label="Date"
              value={format(date, 'MMMM dd, yyyy')}
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="calendar" />}
              editable={false}
            />
          </View>
        </Pressable>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={onDateChange}
            maximumDate={new Date()}
          />
        )}

        <TextInput
          label="Description (Optional)"
          value={description}
          onChangeText={setDescription}
          style={styles.input}
          mode="outlined"
          multiline
          numberOfLines={3}
        />

        {suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <Text variant="bodySmall" style={styles.suggestionsTitle}>Recent descriptions:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
              {suggestions.map((sug) => (
                <Chip
                  key={sug}
                  onPress={() => setDescription(sug)}
                  style={styles.suggestionChip}
                  compact
                >
                  {sug}
                </Chip>
              ))}
            </ScrollView>
          </View>
        )}

        <Button 
          mode="contained" 
          onPress={handleSave} 
          style={styles.saveButton}
          contentStyle={{ paddingVertical: 8 }}
        >
          Save Expense
        </Button>
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
      >
        Expense saved successfully!
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  input: { marginBottom: 16 },
  label: { marginBottom: 8, fontWeight: 'bold' },
  categoryContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginBottom: 16,
    gap: 8
  },
  categoryButton: {
    marginRight: 4,
    marginBottom: 4
  },
  saveButton: {
    marginTop: 8,
    marginBottom: 32
  },
  suggestionsContainer: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  suggestionsTitle: {
    color: 'gray',
    marginBottom: 6,
  },
  suggestionsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  suggestionChip: {
    marginRight: 4,
  },
});
