import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, ScrollView, Platform, Alert, Pressable } from 'react-native';
import {
  List,
  RadioButton,
  Switch,
  Button,
  TextInput,
  IconButton,
  Portal,
  Dialog,
  Text,
  useTheme,
  Card,
  Divider,
} from 'react-native-paper';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ThemeContext } from '../../App';
import {
  getCategories,
  addCategory,
  deleteCategory,
  updateCategory,
  getSetting,
  setSetting,
  Category,
} from '../db/database';
import { scheduleDailyReminder, cancelAllReminders } from '../utils/notifications';
import { format } from 'date-fns';

const PALETTE = [
  '#FF9F43', '#0984E3', '#E84393', '#6C5CE7', '#00B894', '#F53B57',
  '#3C40C6', '#05C46B', '#FFC048', '#575FCF', '#8C7AE6', '#636E72'
];

const ICONS = [
  'silverware-fork-knife', 'car', 'cart', 'movie-roll', 'file-document',
  'tag', 'home', 'gift', 'airplane', 'medical-bag', 'school', 'gamepad-variant',
  'dumbbell', 'heart', 'coffee'
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { themePreference, setThemePreference } = useContext(ThemeContext);

  // Reminders state
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Categories list state
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Category form state
  const [categoryName, setCategoryName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);

  useEffect(() => {
    loadSettings();
    loadCategoriesList();
  }, []);

  const loadSettings = () => {
    // Load reminders enabled
    const enabled = getSetting('reminders_enabled');
    setRemindersEnabled(enabled === 'true');

    // Load reminders time
    const savedTime = getSetting('reminders_time');
    if (savedTime) {
      setReminderTime(new Date(savedTime));
    } else {
      const defaultTime = new Date();
      defaultTime.setHours(21, 0, 0, 0); // 9:00 PM
      setReminderTime(defaultTime);
    }
  };

  const loadCategoriesList = () => {
    try {
      const list = getCategories();
      setCategories(list);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleReminders = async (val: boolean) => {
    setRemindersEnabled(val);
    setSetting('reminders_enabled', val ? 'true' : 'false');
    if (val) {
      const success = await scheduleDailyReminder(reminderTime.getHours(), reminderTime.getMinutes());
      if (!success) {
        setRemindersEnabled(false);
        setSetting('reminders_enabled', 'false');
        Alert.alert('Permission Denied', 'Please enable notification permissions in your phone settings to activate reminders.');
      }
    } else {
      await cancelAllReminders();
    }
  };

  const handleTimeChange = async (event: any, date?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (date) {
      setReminderTime(date);
      setSetting('reminders_time', date.toISOString());
      if (remindersEnabled) {
        await scheduleDailyReminder(date.getHours(), date.getMinutes());
      }
    }
  };

  const handleSaveCategory = () => {
    if (!categoryName.trim()) {
      Alert.alert('Error', 'Category name is required.');
      return;
    }

    try {
      if (editingCategory) {
        updateCategory(editingCategory.id, editingCategory.name, categoryName.trim(), selectedColor, selectedIcon);
      } else {
        addCategory(categoryName.trim(), selectedColor, selectedIcon);
      }
      setCategoryDialogOpen(false);
      loadCategoriesList();
      resetCategoryForm();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Category name must be unique.');
    }
  };

  const handleDeleteCategory = (cat: Category) => {
    if (cat.name === 'Other') {
      Alert.alert('Restricted', 'The "Other" category is required and cannot be deleted.');
      return;
    }

    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${cat.name}"? All associated expenses will be reassigned to "Other".`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteCategory(cat.id, cat.name);
              loadCategoriesList();
            } catch (e) {
              console.error(e);
            }
          },
        },
      ]
    );
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setSelectedColor(cat.color);
    setSelectedIcon(cat.icon);
    setCategoryDialogOpen(true);
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCategoryName('');
    setSelectedColor(PALETTE[0]);
    setSelectedIcon(ICONS[0]);
  };

  // Backup & Restore helpers
  const handleExportBackup = async () => {
    try {
      const dbPath = `${FileSystem.documentDirectory}SQLite/expenses.db`;
      const tempPath = `${FileSystem.cacheDirectory}expense_tracker_backup.db`;
      
      const fileInfo = await FileSystem.getInfoAsync(dbPath);
      if (!fileInfo.exists) {
        Alert.alert('Error', 'No data files found to back up.');
        return;
      }

      await FileSystem.copyAsync({ from: dbPath, to: tempPath });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(tempPath, {
          mimeType: 'application/octet-stream',
          dialogTitle: 'Export Backup Database',
        });
      } else {
        Alert.alert('Error', 'Sharing is not supported on this device.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to back up the database.');
    }
  };

  const handleImportBackup = async () => {
    Alert.alert(
      'Restore Backup',
      'WARNING: This will completely replace your current app data with the backup file. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: '*/*', // Accept all for flexibility, filter inside
                copyToCacheDirectory: true,
              });

              if (!result.canceled && result.assets && result.assets.length > 0) {
                const selectedFile = result.assets[0];
                const dbFolder = `${FileSystem.documentDirectory}SQLite`;
                const dbPath = `${dbFolder}/expenses.db`;

                // Ensure directory exists
                const folderInfo = await FileSystem.getInfoAsync(dbFolder);
                if (!folderInfo.exists) {
                  await FileSystem.makeDirectoryAsync(dbFolder, { intermediates: true });
                }

                await FileSystem.copyAsync({
                  from: selectedFile.uri,
                  to: dbPath,
                });
                
                Alert.alert('Success', 'Backup restored successfully! Please close and reopen the app to apply the data.');
              }
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'Failed to restore the database backup. Make sure you selected a valid .db file.');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Theme Preference section */}
      <List.Section>
        <List.Subheader>Theme Preference</List.Subheader>
        <Card style={styles.card}>
          <RadioButton.Group
            value={themePreference}
            onValueChange={(val: any) => {
              setThemePreference(val);
              setSetting('theme_preference', val);
            }}
          >
            <RadioButton.Item label="System Default" value="system" />
            <Divider />
            <RadioButton.Item label="Light Mode" value="light" />
            <Divider />
            <RadioButton.Item label="Dark Mode" value="dark" />
          </RadioButton.Group>
        </Card>
      </List.Section>

      {/* Daily Reminders section */}
      <List.Section>
        <List.Subheader>Daily Reminders</List.Subheader>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.switchRow}>
              <Text variant="bodyLarge">Enable Daily Reminder</Text>
              <Switch value={remindersEnabled} onValueChange={handleToggleReminders} />
            </View>
            {remindersEnabled && (
              <>
                <Divider style={{ marginVertical: 12 }} />
                <Pressable onPress={() => setShowTimePicker(true)}>
                  <View pointerEvents="none" style={styles.timePickerContainer}>
                    <Text variant="bodyLarge">Reminder Time</Text>
                    <Button mode="outlined">{format(reminderTime, 'hh:mm a')}</Button>
                  </View>
                </Pressable>
              </>
            )}
          </Card.Content>
        </Card>
      </List.Section>

      {showTimePicker && (
        <DateTimePicker
          value={reminderTime}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}

      {/* Category Manager section */}
      <List.Section>
        <View style={styles.sectionHeaderRow}>
          <List.Subheader>Manage Categories</List.Subheader>
          <Button
            mode="text"
            compact
            icon="plus"
            onPress={() => {
              resetCategoryForm();
              setCategoryDialogOpen(true);
            }}
          >
            Add New
          </Button>
        </View>
        <Card style={styles.card}>
          {categories.map((cat, index) => (
            <React.Fragment key={cat.id}>
              <List.Item
                title={cat.name}
                left={(props) => (
                  <IconButton
                    {...props}
                    icon={cat.icon}
                    iconColor="white"
                    size={24}
                    style={{ backgroundColor: cat.color, borderRadius: 8 }}
                  />
                )}
                right={(props) => (
                  <View style={styles.actionButtons}>
                    <IconButton
                      {...props}
                      icon="pencil-outline"
                      size={20}
                      onPress={() => openEditCategory(cat)}
                    />
                    {cat.name !== 'Other' && (
                      <IconButton
                        {...props}
                        icon="delete-outline"
                        iconColor={theme.colors.error}
                        size={20}
                        onPress={() => handleDeleteCategory(cat)}
                      />
                    )}
                  </View>
                )}
              />
              {index < categories.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </Card>
      </List.Section>

      {/* Backup and Restore section */}
      <List.Section style={{ marginBottom: 32 }}>
        <List.Subheader>Data Backup & Restore</List.Subheader>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.backupButtons}>
              <Button
                mode="contained-tonal"
                icon="cloud-upload-outline"
                style={{ flex: 1, marginRight: 8 }}
                onPress={handleExportBackup}
              >
                Export Backup
              </Button>
              <Button
                mode="outlined"
                icon="cloud-download-outline"
                style={{ flex: 1 }}
                onPress={handleImportBackup}
              >
                Import Backup
              </Button>
            </View>
          </Card.Content>
        </Card>
      </List.Section>

      {/* Dialog for Add/Edit Category */}
      <Portal>
        <Dialog
          visible={categoryDialogOpen}
          onDismiss={() => {
            setCategoryDialogOpen(false);
            resetCategoryForm();
          }}
        >
          <Dialog.Title>
            {editingCategory ? 'Edit Category' : 'Add Category'}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Category Name"
              value={categoryName}
              onChangeText={setCategoryName}
              mode="outlined"
              style={{ marginBottom: 16 }}
            />
            
            <Text variant="titleSmall" style={{ marginBottom: 8 }}>Select Color</Text>
            <View style={styles.colorPaletteGrid}>
              {PALETTE.map((color) => (
                <Pressable
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorOptionSelected,
                  ]}
                  onPress={() => setSelectedColor(color)}
                >
                  {selectedColor === color && (
                    <IconButton icon="check" iconColor="white" size={16} />
                  )}
                </Pressable>
              ))}
            </View>

            <Text variant="titleSmall" style={{ marginBottom: 8, marginTop: 12 }}>Select Icon</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.iconSelectionRow}
            >
              {ICONS.map((icon) => (
                <IconButton
                  key={icon}
                  icon={icon}
                  mode={selectedIcon === icon ? 'contained' : 'outlined'}
                  onPress={() => setSelectedIcon(icon)}
                  style={styles.iconOption}
                />
              ))}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setCategoryDialogOpen(false);
                resetCategoryForm();
              }}
            >
              Cancel
            </Button>
            <Button onPress={handleSaveCategory}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 8 },
  card: { marginHorizontal: 8, overflow: 'hidden' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backupButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  colorPaletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionSelected: {
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.3)',
  },
  iconSelectionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  iconOption: {
    margin: 0,
  },
});
